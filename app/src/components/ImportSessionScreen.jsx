import React, { useState } from 'react'

const STEPS = [
  { label: 'Reading report', duration: 2000 },
  { label: 'Extracting with Claude AI', duration: Infinity },
]

function LoadingProgress() {
  const [step, setStep] = useState(0)
  const [fill, setFill] = useState(0)

  React.useEffect(() => {
    let start = null
    let raf
    function tick(ts) {
      if (!start) start = ts
      const elapsed = ts - start
      const current = STEPS[step]
      if (current.duration === Infinity) {
        setFill(60 + 15 * Math.abs(Math.sin(elapsed / 900)))
      } else {
        const pct = Math.min((elapsed / current.duration) * 100, 100)
        setFill(pct)
        if (pct >= 100 && step < STEPS.length - 1) {
          setStep(s => s + 1)
          start = null
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        {STEPS.map((s, i) => (
          <span key={i} style={{
            fontSize: 10,
            color: i === step ? '#e94560' : i < step ? '#3ecf8e' : '#4a5a7a',
            fontWeight: i === step ? 700 : 400,
            transition: 'color 0.3s',
          }}>
            {i < step ? '✓ ' : i === step ? '› ' : ''}{s.label}
          </span>
        ))}
      </div>
      <div style={{ height: 4, background: '#0f3460', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${fill}%`,
          background: 'linear-gradient(90deg, #e94560, #c73652)',
          borderRadius: 2, transition: 'width 0.1s linear',
          boxShadow: '0 0 6px #e9456088',
        }} />
      </div>
    </div>
  )
}

function PreviewSection({ title, color, items }) {
  if (!items?.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color, margin: '0 0 6px' }}>
        {title} ({items.length})
      </p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: '#c0c8d8', paddingLeft: 10, borderLeft: `2px solid ${color}55` }}>
            {typeof item === 'string' ? item : item.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ImportSessionScreen({ onBack, onImport }) {
  const [reportText, setReportText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleImport() {
    if (!reportText.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    const res = await window.api?.importQaReport({ reportText })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    setResult(res.result)
  }

  function handleUse() {
    if (!result) return
    onImport({
      issueInfo: result.issueInfo || { issue: '', dev: '', qa: '' },
      configNotes: [],
      qaNotes: result.qaNotes || [],
      impacts: result.impacts || [],
      cases: (result.cases || []).map(c => ({
        name: c.name || '',
        status: c.status || 'Draft',
        priority: c.priority || 'Normal',
        objective: c.objective || '',
        precondition: c.precondition || '',
        scenario: c.scenario || '',
        productComponent: c.productComponent || '',
        squadTeam: c.squadTeam || '',
        regressionTests: c.regressionTests || 'No',
      })),
    })
  }

  function handleBack() {
    if (result || reportText.trim()) {
      if (!window.confirm('Are you sure you want to go back? The imported data will be lost.')) return
    }
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #0f3460', flexShrink: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
          Import QA Session <em style={{ fontSize: 11, fontWeight: 400, color: '#7f8fb5' }}>powered by AI</em>
        </h1>
        <p style={{ fontSize: 11, color: '#7f8fb5', marginTop: 4 }}>
          Paste the output of any QA skill, agent report, or document — Claude will extract QA Notes, Impacts and Test Cases automatically.
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0 }}>

        {/* Left: paste area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, borderRight: '1px solid #0f3460', minHeight: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7f8fb5', marginBottom: 6 }}>
            Report / Skill Output
          </label>
          <textarea
            autoFocus
            placeholder="Paste here the output from your QA skill, agent report, Confluence page, or any document describing the feature and its test plan..."
            value={reportText}
            onChange={e => { setReportText(e.target.value); setResult(null); setError('') }}
            disabled={loading}
            style={{
              flex: 1, resize: 'none', fontSize: 12, lineHeight: 1.6,
              fontFamily: 'inherit', background: '#0f1e3a',
              border: '1px solid #1a4a7a', borderRadius: 4,
              color: '#c0c8d8', padding: '10px 12px',
            }}
          />
          {loading && <LoadingProgress />}
          {error && (
            <p style={{ fontSize: 11, color: '#e94560', marginTop: 8, marginBottom: 0 }}>{error}</p>
          )}
        </div>

        {/* Right: preview */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto' }}>
          {!result && !loading && (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 12, color: '#2a3a5a', fontFamily: 'monospace', textAlign: 'center' }}>
                Extracted session<br />will appear here
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Issue info */}
              {(result.issueInfo?.issue || result.issueInfo?.dev || result.issueInfo?.qa) && (
                <div style={{ background: '#0f1e3a', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {result.issueInfo.issue && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e94560', fontFamily: 'monospace' }}>{result.issueInfo.issue}</div>
                  )}
                  {result.issueInfo.dev && (
                    <div style={{ fontSize: 11, color: '#7f8fb5' }}>dev: {result.issueInfo.dev}</div>
                  )}
                  {result.issueInfo.qa && (
                    <div style={{ fontSize: 11, color: '#7f8fb5' }}>qa: {result.issueInfo.qa}</div>
                  )}
                </div>
              )}

              <PreviewSection title="QA Notes" color="#7fb3e8" items={result.qaNotes} />
              <PreviewSection title="Possible Impacts" color="#e8c07f" items={result.impacts} />
              <PreviewSection title="Test Cases" color="#3ecf8e" items={result.cases} />
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #0f3460', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <button className="secondary" onClick={handleBack}>← Menu</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {result && (
            <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600 }}>
              ✓ {result.cases?.length || 0} test cases · {result.qaNotes?.length || 0} notes · {result.impacts?.length || 0} impacts
            </span>
          )}
          {!result ? (
            <button onClick={handleImport} disabled={!reportText.trim() || loading}>
              {loading ? '...' : '✦ Extract Session'}
            </button>
          ) : (
            <>
              <button className="secondary" onClick={() => { setResult(null) }}>
                ← Re-extract
              </button>
              <button onClick={handleUse}>
                Use This Session →
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
