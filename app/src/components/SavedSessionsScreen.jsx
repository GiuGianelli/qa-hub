import React, { useState, useEffect, useRef } from 'react'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function resolveStep(workflowStep) {
  return workflowStep ?? 1
}

function toSkillTeamsArray(skillTeam) {
  if (Array.isArray(skillTeam)) return skillTeam
  if (skillTeam) return [skillTeam]
  return []
}

const STEPS = [
  { n: 1, label: 'Import' },
  { n: 2, label: 'Test Cycle' },
  { n: 3, label: 'Report' },
]

function MiniStepper({ step = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8 }}>
      {STEPS.map((s, i) => {
        const done = s.n < step
        const active = s.n === step
        let circleBg = '#1a3a5a'
        if (active) circleBg = '#e94560'
        if (done) circleBg = '#3ecf8e'
        let labelColor = '#7f8fb5'
        if (active) labelColor = '#e0e0e0'
        if (done) labelColor = '#3ecf8e'
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: !active && !done ? 0.3 : 1 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700,
                background: circleBg,
                color: '#fff',
              }}>
                {done ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                color: labelColor,
              }}>
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ flex: 1, height: 1, background: '#0f3460', margin: '0 6px', minWidth: 8 }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const LAYER_LABELS = { unit: 'Unit Tests', acceptance: 'Acceptance / Integration Tests', e2e: 'E2E Tests' }
const LAYER_COLORS = { unit: '#7fb3e8', acceptance: '#7ecfaf', e2e: '#e8c07f' }

function renderCoverageGap(gap, dismissedGaps, setDismissedGaps, setSaved) {
  let riskColor = '#7f8fb5'
  if (gap.risk === 'High') riskColor = '#e94560'
  else if (gap.risk === 'Medium') riskColor = '#e8c07f'
  const gapKey = gap.area + gap.file
  return (
    <div key={gapKey} style={{
      background: '#0f1e3a', borderRadius: 4, padding: '7px 10px',
      borderLeft: `2px solid ${riskColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e0e0e0', flex: 1 }}>{gap.area}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
          background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}44`,
        }}>
          {gap.risk}
        </span>
        <button
          onClick={() => { setDismissedGaps((prev) => new Set([...prev, gapKey])); setSaved(false) }}
          title="Dismiss gap"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#7f8fb5', fontSize: 13, lineHeight: 1, padding: '0 0 0 4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: 10, color: '#c0c8d8', margin: '0 0 2px', fontFamily: 'monospace' }}>{gap.file}</p>
      <p style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 4px' }}>{gap.change}</p>
      <p style={{ fontSize: 11, color: '#e8c07f', margin: 0 }}>→ {gap.suggestion}</p>
    </div>
  )
}

function renderCoverageGaps(gaps, dismissedGaps, setDismissedGaps, setSaved) {
  const visible = gaps.filter((gap) => !dismissedGaps.has(gap.area + gap.file))
  return (
    <div style={{ background: '#16213e', borderRadius: 4, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#e8c07f', margin: 0 }}>
          Coverage Gaps
        </p>
        <span style={{
          fontSize: 10, background: '#16213e', border: '1px solid #e8c07f33',
          borderRadius: 10, padding: '1px 7px', color: '#e8c07f',
        }}>
          {visible.length}
        </span>
      </div>
      {visible.length === 0
        ? <p style={{ fontSize: 11, color: '#7f8fb5', margin: 0 }}>All gaps dismissed.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map((gap) => renderCoverageGap(gap, dismissedGaps, setDismissedGaps, setSaved))}
          </div>
      }
    </div>
  )
}

function MissingItem({ item, validated, na, onCycle }) {
  let checkBg = 'transparent'
  let checkBorder = '#4a5a7a'
  let rowBg = 'transparent'
  let textColor = '#7f8fb5'
  let checkMark = ''
  let badge = null

  if (validated) {
    checkBg = '#3ecf8e'
    checkBorder = '#3ecf8e'
    rowBg = '#3ecf8e11'
    textColor = '#3ecf8e'
    checkMark = '✓'
    badge = <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#3ecf8e', opacity: 0.8 }}>Manually validated</span>
  } else if (na) {
    checkBg = '#7f8fb5'
    checkBorder = '#7f8fb5'
    rowBg = '#ffffff08'
    textColor = '#4a5a7a'
    checkMark = '—'
    badge = <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#7f8fb5', opacity: 0.8 }}>Not applicable</span>
  }

  return (
    <button
      onClick={() => onCycle(item)}
      title="Click to cycle: unchecked → Manually Validated → Not Applicable"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '4px 6px', borderRadius: 4, marginBottom: 2,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        background: rowBg, border: 'none',
      }}
    >
      <div style={{
        flexShrink: 0, marginTop: 1,
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${checkBorder}`,
        background: checkBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: '#0f1e3a', fontWeight: 900,
        transition: 'all 0.15s',
      }}>
        {checkMark}
      </div>
      <span style={{
        fontSize: 11, color: textColor,
        textDecoration: validated || na ? 'line-through' : 'none',
        lineHeight: 1.4,
      }}>
        {item}{badge}
      </span>
    </button>
  )
}

function BranchAnalysisPanel({ session, onClose, onSessionSaved }) {
  const prior = session.branchAnalysis
  const [branch, setBranch] = useState(prior?.branch || '')
  const [prDescription, setPrDescription] = useState(prior?.prDescription || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(prior?.result || null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(!!prior)
  const [manuallyValidated, setManuallyValidated] = useState(() => new Set(prior?.manuallyValidated || []))
  const [notApplicable, setNotApplicable] = useState(() => new Set(prior?.notApplicable || []))
  const [dismissedGaps, setDismissedGaps] = useState(() => new Set(prior?.dismissedGaps || []))
  const inputRef = useRef(null)

  function cycleItemState(item) {
    const isValidated = manuallyValidated.has(item)
    const isNA = notApplicable.has(item)
    if (!isValidated && !isNA) {
      setManuallyValidated(prev => { const n = new Set(prev); n.add(item); return n })
    } else if (isValidated) {
      setManuallyValidated(prev => { const n = new Set(prev); n.delete(item); return n })
      setNotApplicable(prev => { const n = new Set(prev); n.add(item); return n })
    } else {
      setNotApplicable(prev => { const n = new Set(prev); n.delete(item); return n })
    }
    setSaved(false)
  }

  useEffect(() => { inputRef.current?.focus() }, [])

  async function analyze() {
    const b = branch.trim()
    if (!b || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    setSaved(false)
    const res = await window.api?.analyzeBranch({ branch: b, prDescription, session })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    setResult(res?.result || null)
  }

  async function saveAnalysis() {
    const updated = { ...session, branchAnalysis: { branch: branch.trim(), prDescription, result, manuallyValidated: [...manuallyValidated], notApplicable: [...notApplicable], dismissedGaps: [...dismissedGaps], savedAt: new Date().toISOString() } }
    await window.api?.updateSession(updated)
    setSaved(true)
    onSessionSaved(updated)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') analyze()
    if (e.key === 'Escape') onClose()
  }

  const scoreColor = { High: '#3ecf8e', Medium: '#e8c07f', Low: '#e94560' }

  return (
    <div style={{
      marginTop: 12, background: '#0f1e3a', border: '1px solid #1a4a7a',
      borderRadius: 6, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7fb3e8', flex: 1 }}>Branch Analysis</span>
        <button className="secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          ref={inputRef}
          placeholder="feature/PAY-1234-minha-branch"
          value={branch}
          onChange={e => setBranch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, marginBottom: 0, fontSize: 12 }}
          disabled={loading}
        />
        <button
          onClick={analyze}
          disabled={!branch.trim() || loading}
          style={{ whiteSpace: 'nowrap', fontSize: 12 }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      <textarea
        placeholder="PR Description (optional) — paste here the description written by the developer on GitHub/Bitbucket..."
        value={prDescription}
        onChange={e => setPrDescription(e.target.value)}
        disabled={loading}
        rows={3}
        style={{ width: '100%', fontSize: 11, resize: 'vertical', marginBottom: 12 }}
      />

      {loading && (
        <p style={{ fontSize: 11, color: '#7f8fb5', margin: 0 }}>
          Fetching diff and calling Claude AI...
        </p>
      )}

      {error && (
        <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {saved ? (
              <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600 }}>✓ Analysis saved</span>
            ) : (
              <button className="secondary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={saveAnalysis}>
                Save Analysis
              </button>
            )}
          </div>
          {/* Automated tests by layer */}
          {['unit', 'acceptance', 'e2e'].map(layer => {
            const items = result.automatedTests?.[layer] || []
            return (
              <div key={layer}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: LAYER_COLORS[layer],
                  }}>
                    {LAYER_LABELS[layer]}
                  </span>
                  <span style={{
                    fontSize: 10, background: '#16213e', border: `1px solid ${LAYER_COLORS[layer]}33`,
                    borderRadius: 10, padding: '1px 7px', color: LAYER_COLORS[layer],
                  }}>
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#4a5a7a', margin: 0 }}>No tests found in this layer.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map((item) => (
                      <div key={item.file} style={{
                        background: '#16213e', borderRadius: 4, padding: '6px 10px',
                        borderLeft: `2px solid ${LAYER_COLORS[layer]}`,
                      }}>
                        <p style={{ fontSize: 11, color: '#c0c8d8', margin: 0, fontFamily: 'monospace' }}>{item.file}</p>
                        <p style={{ fontSize: 11, color: '#7f8fb5', margin: '2px 0 0' }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Coverage assessment */}
          {result.coverageAssessment && (
            <div style={{ background: '#16213e', borderRadius: 4, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f8fb5', margin: '0 0 4px' }}>
                Overall coverage
              </p>
              <p style={{ fontSize: 11, color: '#c0c8d8', margin: 0, lineHeight: 1.5 }}>{result.coverageAssessment}</p>
            </div>
          )}

          {/* Coverage gaps */}
          {result.coverageGaps?.length > 0 && renderCoverageGaps(result.coverageGaps, dismissedGaps, setDismissedGaps, setSaved)}

          {/* Adherence to original plan */}
          {result.adherence && (
            <div style={{ background: '#16213e', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7f8fb5', margin: 0 }}>
                  Plan adherence
                </p>
                {result.adherence.score && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                    background: (scoreColor[result.adherence.score] || '#7f8fb5') + '22',
                    color: scoreColor[result.adherence.score] || '#7f8fb5',
                    border: `1px solid ${scoreColor[result.adherence.score] || '#7f8fb5'}44`,
                  }}>
                    {result.adherence.score}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#c0c8d8', margin: '0 0 8px', lineHeight: 1.5 }}>{result.adherence.summary}</p>
              {result.adherence.covered?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 10, color: '#3ecf8e', fontWeight: 700, margin: '0 0 3px' }}>Covered</p>
                  {result.adherence.covered.map((item) => (
                    <p key={item} style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 2px', paddingLeft: 8 }}>• {item}</p>
                  ))}
                </div>
              )}
              {result.adherence.missing?.length > 0 && (
                <div>
                  {(() => {
                    const unresolved = result.adherence.missing.filter(item => !notApplicable.has(item))
                    return (
                      <p style={{ fontSize: 10, color: '#e94560', fontWeight: 700, margin: '0 0 6px' }}>
                        Missing / Not tested{unresolved.length < result.adherence.missing.length ? ` (${unresolved.length} remaining)` : ''}
                      </p>
                    )
                  })()}
                  {result.adherence.missing.map((item) => {
                    const validated = manuallyValidated.has(item)
                    const na = notApplicable.has(item)
                    return <MissingItem key={item} item={item} validated={validated} na={na} onCycle={cycleItemState} />
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SavedSessionsScreen({ onBack, onLoadSession, onGenerateReport }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [exportingId, setExportingId] = useState(null)
  const [exportingDocxId, setExportingDocxId] = useState(null)
  const [exportingPdfId, setExportingPdfId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [activeTab, setActiveTab] = useState('working')
  const [search, setSearch] = useState('')

  async function previewReport(s) {
    if (exportingId) return
    setExportingId(s.id)
    await window.api?.generateReport({
      issueInfo: s.issueInfo,
      configNotes: s.configNotes,
      qaNotes: s.qaNotes,
      impacts: s.impacts,
      cases: s.cases,
    })
    setExportingId(null)
  }

  async function exportDocx(s) {
    if (exportingDocxId) return
    setExportingDocxId(s.id)
    await window.api?.generateDocxReport({
      issueInfo: s.issueInfo,
      configNotes: s.configNotes,
      qaNotes: s.qaNotes,
      impacts: s.impacts,
      cases: s.cases,
    })
    setExportingDocxId(null)
  }

  async function exportPdf(s) {
    if (exportingPdfId) return
    setExportingPdfId(s.id)
    const res = await window.api?.generateReport({
      issueInfo: s.issueInfo,
      configNotes: s.configNotes,
      qaNotes: s.qaNotes,
      impacts: s.impacts,
      cases: s.cases,
    })
    if (res?.path) {
      await window.api?.exportPdf({ htmlPath: res.path })
    }
    setExportingPdfId(null)
  }

  useEffect(() => {
    window.api?.loadSessions().then(s => { setSessions(s || []); setLoading(false) })
  }, [])

  async function deleteSession(id) {
    await window.api?.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (analyzingId === id) setAnalyzingId(null)
  }

  async function markMerged(s) {
    const updated = { ...s, merged: true, mergedAt: new Date().toISOString() }
    await window.api?.updateSession(updated)
    setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))
    setActiveTab('merged')
  }

  function handleSessionSaved(updated) {
    setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))
  }

  const searchLower = search.trim().toLowerCase()
  const workingSessions = sessions.filter(s => !s.merged)
  const mergedSessions = sessions.filter(s => s.merged)
  const tabSessions = activeTab === 'working' ? workingSessions : mergedSessions
  const visibleSessions = searchLower
    ? tabSessions.filter(s => (s.issueInfo?.issue || '').toLowerCase().includes(searchLower) || (s.issueInfo?.dev || '').toLowerCase().includes(searchLower) || (s.issueInfo?.qa || '').toLowerCase().includes(searchLower))
    : tabSessions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #0f3460', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', margin: 0, flex: 1 }}>My Sessions</h1>
          <input
            placeholder="Search by issue, dev or QA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220, marginBottom: 0, fontSize: 11, padding: '4px 8px' }}
          />
        </div>
        <p style={{ fontSize: 11, color: '#7f8fb5', marginTop: 0, marginBottom: 12 }}>
          {sessions.length} session{sessions.length === 1 ? '' : 's'} saved locally
        </p>
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { key: 'working', label: 'Working', count: workingSessions.length },
            { key: 'merged', label: 'Merged', count: mergedSessions.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 16px',
                borderRadius: 0, border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: activeTab === tab.key ? '#e0e0e0' : '#4a5a7a',
                borderBottom: activeTab === tab.key ? '2px solid #e94560' : '2px solid transparent',
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 8,
                background: activeTab === tab.key ? '#e9456022' : '#1a2a4a',
                color: activeTab === tab.key ? '#e94560' : '#4a5a7a',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading && (
          <p style={{ fontSize: 12, color: '#4a5a7a' }}>Loading...</p>
        )}
        {!loading && visibleSessions.length === 0 && (
          <p style={{ fontSize: 12, color: '#4a5a7a', marginTop: 20, textAlign: 'center' }}>
            {activeTab === 'working'
              ? 'No sessions saved yet. Finish a QA session and click "Save Session".'
              : 'No merged sessions yet. Use the ⤵ button to move a finished story here.'}
          </p>
        )}
        {visibleSessions.map(s => (
          <div key={s.id} style={{
            background: '#16213e', border: '1px solid #0f3460', borderRadius: 6,
            padding: '12px 16px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* LEFT: issue info */}
              <div style={{ width: 300, flexShrink: 0, minWidth: 0 }}>
                {/* Row 1: issue key + badge — never wraps */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e94560', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {s.issueInfo?.issue || '—'}
                  </span>
                  {s.source === 'imported' && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                      background: '#a78bfa22', color: '#a78bfa',
                      border: '1px solid #a78bfa55', letterSpacing: '0.06em',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      ↓ imported
                    </span>
                  )}
                  {toSkillTeamsArray(s.skillTeam).map(team => (
                    <span key={team} style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                      background: '#c87fff22', color: '#c87fff',
                      border: '1px solid #c87fff55', letterSpacing: '0.06em',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      ⚡ {team}
                    </span>
                  ))}
                </div>
                {/* Row 2: dev / qa — separate line, truncates if long */}
                {(s.issueInfo?.dev || s.issueInfo?.qa) && (
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#7f8fb5', marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {s.issueInfo?.dev && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>dev: {s.issueInfo.dev}</span>
                    )}
                    {s.issueInfo?.qa && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>qa: {s.issueInfo.qa}</span>
                    )}
                  </div>
                )}
                {/* Row 3: date · counts */}
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#4a5a7a', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{formatDate(s.savedAt)}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{s.cases?.length ?? 0} test case{s.cases?.length === 1 ? '' : 's'}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{s.qaNotes?.length ?? 0} QA note{s.qaNotes?.length === 1 ? '' : 's'}</span>
                </div>
                {/* Row 4: branch (only when present) */}
                {s.branchAnalysis && (
                  <div style={{ marginTop: 3 }}>
                    <button
                      onClick={() => setAnalyzingId(prev => prev === s.id ? null : s.id)}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                        background: analyzingId === s.id ? '#7fb3e844' : '#7fb3e822',
                        color: '#7fb3e8', border: '1px solid #7fb3e844',
                        cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', maxWidth: 280, display: 'block',
                      }}
                      title={s.branchAnalysis.branch}
                    >
                      ⎇ {s.branchAnalysis.branch}
                    </button>
                  </div>
                )}
              </div>

              {/* MIDDLE: stepper */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <MiniStepper step={resolveStep(s.workflowStep)} />
              </div>

              {/* RIGHT: buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '4px 12px' }}
                  onClick={() => onLoadSession(s)}
                >
                  Load
                </button>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '4px 12px', color: '#3ecf8e', borderColor: '#1a5a3a' }}
                  disabled={exportingId === s.id}
                  onClick={() => previewReport(s)}
                >
                  {exportingId === s.id ? 'Loading...' : 'Preview'}
                </button>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '4px 12px', color: '#7fb3e8', borderColor: '#1a4a7a' }}
                  disabled={exportingDocxId === s.id}
                  onClick={() => exportDocx(s)}
                >
                  {exportingDocxId === s.id ? 'Exporting...' : '↓ DOCX'}
                </button>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '4px 12px', color: '#e94560', borderColor: '#4a1a1a' }}
                  disabled={exportingPdfId === s.id}
                  onClick={() => exportPdf(s)}
                >
                  {exportingPdfId === s.id ? 'Exporting...' : '↓ PDF'}
                </button>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '4px 12px', color: '#7fb3e8', borderColor: '#1a4a7a' }}
                  onClick={() => setAnalyzingId(prev => prev === s.id ? null : s.id)}
                >
                  Branch Analysis
                </button>
                {!s.merged && (
                  <button
                    className="secondary"
                    title="Mark as merged"
                    style={{ fontSize: 13, padding: '4px 10px', color: '#3ecf8e', borderColor: '#1a5a3a' }}
                    onClick={() => markMerged(s)}
                  >
                    ⤵
                  </button>
                )}
                {confirmDeleteId === s.id ? (
                  <>
                    <span style={{ fontSize: 11, color: '#e0e0e0', whiteSpace: 'nowrap' }}>
                      Delete {s.issueInfo?.issue || 'this session'}?
                    </span>
                    <button
                      style={{ fontSize: 11, padding: '4px 10px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      onClick={() => { setConfirmDeleteId(null); deleteSession(s.id) }}
                    >
                      Yes, delete
                    </button>
                    <button
                      className="secondary"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary"
                    style={{ fontSize: 11, padding: '4px 10px', color: '#e94560' }}
                    onClick={() => setConfirmDeleteId(s.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {analyzingId === s.id && (
              <BranchAnalysisPanel
                session={s}
                onClose={() => setAnalyzingId(null)}
                onSessionSaved={handleSessionSaved}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid #0f3460', flexShrink: 0 }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
      </div>
    </div>
  )
}
