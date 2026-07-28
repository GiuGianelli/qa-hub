import React, { useState, useEffect } from 'react'
import { renderMd } from './RichEditor'

const STATUS_OPTIONS = ['Draft', 'Approved', 'Deprecated']
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical']
const REGRESSION_OPTIONS = ['Yes', 'No']

function Tag({ children, color = '#3ecf8e' }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700,
    }}>{children}</span>
  )
}

function EditableList({ items, onChange, placeholder }) {
  const [input, setInput] = useState('')

  function add() {
    const t = input.trim()
    if (!t) return
    onChange([...items, t])
    setInput('')
  }

  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          style={{ flex: 1, marginBottom: 0 }}
        />
        <button className="secondary" onClick={add} disabled={!input.trim()}>Add</button>
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: '#e94560', marginTop: 3 }}>•</span>
            <span
              style={{ flex: 1, color: '#c0c8d8', fontSize: 12, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: renderMd(item) }}
            />
            <button className="secondary" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => remove(i)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CaseCard({ tc, index, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(false)

  function field(key, value) {
    onChange({ ...tc, [key]: value })
  }

  return (
    <div style={{
      border: '1px solid #1a4a7a', borderRadius: 6, marginBottom: 10, overflow: 'hidden',
    }}>
      <div
        style={{ background: '#0f3460', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ color: '#7f8fb5', fontSize: 11, fontFamily: 'monospace', minWidth: 18 }}>{index + 1}.</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>{tc.name || 'Unnamed'}</span>
        <Tag color={tc.priority === 'High' || tc.priority === 'Critical' ? '#e94560' : '#3ecf8e'}>{tc.priority}</Tag>
        <button
          className="secondary"
          style={{ padding: '1px 8px', fontSize: 11 }}
          onClick={e => { e.stopPropagation(); onRemove() }}
        >✕</button>
        <span style={{ color: '#7f8fb5', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* BDD always visible */}
      {tc.scenario && !expanded && (
        <div style={{ padding: '8px 14px', background: '#0a0a1a', borderTop: '1px solid #1a4a7a' }}>
          <pre style={{ margin: 0, color: '#7fcfaf', fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{tc.scenario}</pre>
        </div>
      )}

      {expanded && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ marginBottom: 4 }}>Name</label>
            <input value={tc.name} onChange={e => field('name', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ marginBottom: 4 }}>Status</label>
              <select value={tc.status} onChange={e => field('status', e.target.value)} style={{ marginBottom: 0 }}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Priority</label>
              <select value={tc.priority} onChange={e => field('priority', e.target.value)} style={{ marginBottom: 0 }}>
                {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Regression?</label>
              <select value={tc.regressionTests} onChange={e => field('regressionTests', e.target.value)} style={{ marginBottom: 0 }}>
                {REGRESSION_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ marginBottom: 4 }}>Objective</label>
            <textarea rows={2} value={tc.objective} onChange={e => field('objective', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ marginBottom: 4 }}>Precondition</label>
            <textarea rows={2} value={tc.precondition} onChange={e => field('precondition', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ marginBottom: 4 }}>BDD Scenario</label>
            <textarea
              rows={5}
              value={tc.scenario}
              onChange={e => field('scenario', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ marginBottom: 4 }}>Product Component</label>
              <input value={tc.productComponent} onChange={e => field('productComponent', e.target.value)} />
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Squad / Team</label>
              <input value={tc.squadTeam} onChange={e => field('squadTeam', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const STEPS = [
  { label: 'Fetching Jira issue', duration: 3000 },
  { label: 'Calling Claude AI', duration: Infinity },
]

function LoadingProgress() {
  const [step, setStep] = useState(0)
  const [fill, setFill] = useState(0)

  useEffect(() => {
    let start = null
    let raf

    function tick(ts) {
      if (!start) start = ts
      const elapsed = ts - start
      const current = STEPS[step]

      if (current.duration === Infinity) {
        // pulse between 60–90% indefinitely
        const pct = 60 + 15 * Math.abs(Math.sin(elapsed / 900))
        setFill(pct)
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
    <div style={{ marginTop: 10 }}>
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
          height: '100%',
          width: `${fill}%`,
          background: 'linear-gradient(90deg, #e94560, #c73652)',
          borderRadius: 2,
          transition: 'width 0.1s linear',
          boxShadow: '0 0 6px #e9456088',
        }} />
      </div>
    </div>
  )
}

export default function AISessionScreen({ onBack, onUseSession }) {
  const [issueKey, setIssueKey] = useState('')
  const [useCodeContext, setUseCodeContext] = useState(true)
  const [createSubtask, setCreateSubtask] = useState(false)
  const [keywords, setKeywords] = useState([])
  const [keywordInput, setKeywordInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [subtaskResult, setSubtaskResult] = useState(null)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(null)

  // editable fields after generation
  const [qaNotes, setQaNotes] = useState([])
  const [impacts, setImpacts] = useState([])
  const [cases, setCases] = useState([])

  const canGenerate = issueKey.trim() && !loading

  function addKeyword() {
    const kw = keywordInput.trim()
    if (!kw || keywords.length >= 3) return
    setKeywords(prev => [...prev, kw])
    setKeywordInput('')
  }

  async function generate() {
    if (!canGenerate) return
    setLoading(true)
    setError('')
    setGenerated(null)
    setSubtaskResult(null)
    try {
      const res = await window.api?.aiGenerateSession({
        issueKey: issueKey.trim().toUpperCase(),
        useCodeContext,
        manualKeywords: keywords,
      })
      if (res?.error) {
        setError(res.error)
      } else {
        setGenerated({ issueKey: res.issueKey, summary: res.summary })
        setQaNotes(res.result.qaNotes || [])
        setImpacts(res.result.impacts || [])
        setCases(res.result.cases || [])
        if (createSubtask) {
          const sub = await window.api?.createQaSubtask({
            issueKey: res.issueKey,
            issueSummary: res.summary || res.issueKey,
          })
          setSubtaskResult(sub)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function updateCase(i, updated) {
    setCases(prev => prev.map((c, idx) => idx === i ? updated : c))
  }

  function removeCase(i) {
    setCases(prev => prev.filter((_, idx) => idx !== i))
  }

  function addCase() {
    setCases(prev => [...prev, {
      name: '',
      status: 'Draft',
      priority: 'Normal',
      objective: '',
      precondition: '',
      scenario: '',
      productComponent: '',
      squadTeam: '',
      regressionTests: 'No',
    }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top row: issue input + summary side by side */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 12, flexShrink: 0, maxHeight: '45vh', minHeight: 0 }}>
        {/* Left: title + input */}
        <div className="panel" style={{ flex: '0 0 380px', overflow: 'visible', padding: 16, alignSelf: 'start' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', marginBottom: 2 }}>
            New QA Session <em style={{ fontSize: 11, fontWeight: 400, color: '#7f8fb5' }}>powered by AI</em>
          </h1>
          <p style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 12px' }}>
            Enter a Jira issue key to generate a QA session plan.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="e.g. DEV-12345"
              value={issueKey}
              onChange={e => setIssueKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              disabled={loading}
              style={{ flex: 1, marginBottom: 0 }}
              autoFocus
            />
            <button onClick={generate} disabled={!canGenerate} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {loading ? '...' : '✦ Generate'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={useCodeContext}
              onChange={e => setUseCodeContext(e.target.checked)}
              disabled={loading}
              style={{ width: 13, height: 13, accentColor: '#3ecf8e', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: useCodeContext ? '#3ecf8e' : '#4a5a7a' }}>
              Use code as source of truth
            </span>
          </label>
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, color: '#4a5a7a', margin: '0 0 5px' }}>
              Keywords <span style={{ color: '#2a3a5a' }}>— optional, up to 3</span>
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                placeholder="e.g. collectionRate"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                disabled={loading || keywords.length >= 3}
                style={{ flex: 1, marginBottom: 0, fontSize: 11 }}
              />
              <button
                className="secondary"
                style={{ fontSize: 11, padding: '3px 10px' }}
                disabled={!keywordInput.trim() || keywords.length >= 3 || loading}
                onClick={addKeyword}
              >
                Add
              </button>
            </div>
            {keywords.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {keywords.map((kw, i) => (
                  <span key={i} style={{
                    background: '#e8c07f22', color: '#e8c07f', border: '1px solid #e8c07f44',
                    borderRadius: 4, padding: '1px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    {kw}
                    <button
                      onClick={() => setKeywords(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: '#e8c07f', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={createSubtask}
              onChange={e => setCreateSubtask(e.target.checked)}
              disabled={loading}
              style={{ width: 13, height: 13, accentColor: '#7fb3e8', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: createSubtask ? '#7fb3e8' : '#4a5a7a' }}>
              Create subtask [QA Test Creation] in Jira
            </span>
          </label>

          {loading && <LoadingProgress />}
          {error && <p style={{ fontSize: 11, color: '#e94560', marginTop: 8, marginBottom: 0 }}>{error}</p>}
          {generated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Tag>{generated.issueKey}</Tag>
              <span style={{ fontSize: 11, color: '#7f8fb5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{generated.summary}</span>
            </div>
          )}
          {subtaskResult && !subtaskResult.error && (
            <p style={{ fontSize: 11, color: '#7fb3e8', marginTop: 6, marginBottom: 0 }}>
              ✓ Subtask created: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{subtaskResult.key}</span>
            </p>
          )}
          {subtaskResult?.error && (
            <p style={{ fontSize: 11, color: '#e8c07f', marginTop: 6, marginBottom: 0 }}>
              ⚠ Subtask: {subtaskResult.error}
            </p>
          )}
        </div>

        {/* Right: QA Notes + Possible Impacts side by side */}
        {generated ? (
          <div style={{ flex: 1, display: 'flex', gap: 12, minWidth: 0, minHeight: 0 }}>
            <div className="panel" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              <h2>QA Notes</h2>
              <EditableList items={qaNotes} onChange={setQaNotes} placeholder="Add a note..." />
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              <h2>Possible Impacts</h2>
              <EditableList items={impacts} onChange={setImpacts} placeholder="Add an impact..." />
            </div>
          </div>
        ) : (
          <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <span style={{ color: '#2a3a5a', fontSize: 12, fontFamily: 'monospace' }}>Results will appear here</span>
          </div>
        )}
      </div>

      {/* Bottom: Flow diagram (before generation) or Test Cases (after generation) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!generated ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
            <svg viewBox="0 0 860 260" style={{ width: '100%', maxWidth: 960, opacity: 0.85 }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L7,3.5 z" fill="#2a4a7a"/>
                </marker>
              </defs>

              {/* title */}
              <text x="430" y="22" textAnchor="middle" fill="#2a3a5a" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="2">AI SESSION GENERATION FLOW</text>

              {/* ── JIRA ISSUE ── */}
              <rect x="10" y="80" width="140" height="100" rx="7" fill="#0f2040" stroke="#1a4a7a" strokeWidth="1.5"/>
              <text x="80" y="104" textAnchor="middle" fill="#7fb3e8" fontSize="11" fontWeight="700" fontFamily="monospace">JIRA ISSUE</text>
              <line x1="20" y1="110" x2="140" y2="110" stroke="#1a4a7a" strokeWidth="1"/>
              <text x="80" y="126" textAnchor="middle" fill="#c0c8d8" fontSize="10" fontFamily="monospace">DEV-12345</text>
              <text x="80" y="142" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">summary</text>
              <text x="80" y="156" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">description</text>
              <text x="80" y="170" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">type · priority</text>

              <line x1="150" y1="130" x2="174" y2="130" stroke="#2a4a7a" strokeWidth="1.5" markerEnd="url(#arr)"/>

              {/* ── FETCH ── */}
              <rect x="174" y="80" width="130" height="100" rx="7" fill="#0f2040" stroke="#1a4a7a" strokeWidth="1.5"/>
              <text x="239" y="104" textAnchor="middle" fill="#7fb3e8" fontSize="11" fontWeight="700" fontFamily="monospace">FETCH</text>
              <line x1="184" y1="110" x2="294" y2="110" stroke="#1a4a7a" strokeWidth="1"/>
              <text x="239" y="127" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">Jira REST API</text>
              <text x="239" y="143" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">Confluence BDD page</text>
              <text x="239" y="159" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">issue metadata</text>

              <line x1="304" y1="130" x2="328" y2="130" stroke="#2a4a7a" strokeWidth="1.5" markerEnd="url(#arr)"/>

              {/* ── KEYWORDS ── */}
              <rect x="328" y="70" width="140" height="120" rx="7" fill="#16213e" stroke="#e8c07f66" strokeWidth="1.5"/>
              <text x="398" y="94" textAnchor="middle" fill="#e8c07f" fontSize="11" fontWeight="700" fontFamily="monospace">KEYWORDS</text>
              <line x1="338" y1="100" x2="458" y2="100" stroke="#e8c07f33" strokeWidth="1"/>
              <text x="398" y="118" textAnchor="middle" fill="#7a6a4a" fontSize="9" fontFamily="monospace">auto-extracted</text>
              <text x="398" y="132" textAnchor="middle" fill="#7a6a4a" fontSize="9" fontFamily="monospace">from issue text</text>
              <rect x="338" y="142" width="120" height="22" rx="4" fill="#e8c07f22"/>
              <text x="398" y="157" textAnchor="middle" fill="#e8c07f" fontSize="10" fontWeight="700" fontFamily="monospace">+ manual (you)</text>
              <text x="398" y="178" textAnchor="middle" fill="#7a6a4a" fontSize="8" fontFamily="monospace">up to 3 keywords</text>

              <line x1="468" y1="130" x2="492" y2="130" stroke="#2a4a7a" strokeWidth="1.5" markerEnd="url(#arr)"/>

              {/* ── CODE SEARCH ── */}
              <rect x="492" y="70" width="140" height="120" rx="7" fill="#0f2040" stroke="#3ecf8e44" strokeWidth="1.5"/>
              <text x="562" y="94" textAnchor="middle" fill="#3ecf8e" fontSize="11" fontWeight="700" fontFamily="monospace">CODE SEARCH</text>
              <line x1="502" y1="100" x2="622" y2="100" stroke="#3ecf8e22" strokeWidth="1"/>
              <text x="562" y="118" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">grep repos</text>
              <text x="562" y="132" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">service classes</text>
              <text x="562" y="146" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">test files</text>
              <text x="562" y="160" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">config · feature flags</text>
              <text x="562" y="176" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">relevant snippets</text>

              <line x1="632" y1="130" x2="656" y2="130" stroke="#2a4a7a" strokeWidth="1.5" markerEnd="url(#arr)"/>

              {/* ── CLAUDE AI ── */}
              <rect x="656" y="70" width="130" height="120" rx="7" fill="#1a0f20" stroke="#e9456066" strokeWidth="1.5"/>
              <text x="721" y="94" textAnchor="middle" fill="#e94560" fontSize="11" fontWeight="700" fontFamily="monospace">CLAUDE AI</text>
              <line x1="666" y1="100" x2="776" y2="100" stroke="#e9456033" strokeWidth="1"/>
              <text x="721" y="118" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">issue context</text>
              <text x="721" y="132" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">BDD standards</text>
              <text x="721" y="146" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">code snippets</text>
              <text x="721" y="160" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">keywords</text>
              <text x="721" y="176" textAnchor="middle" fill="#4a5a7a" fontSize="9" fontFamily="monospace">generates plan</text>

              {/* lines from claude to outputs */}
              <line x1="786" y1="105" x2="806" y2="91" stroke="#1a3a5a" strokeWidth="1" strokeDasharray="4,2" markerEnd="url(#arr)"/>
              <line x1="786" y1="130" x2="806" y2="130" stroke="#1a3a5a" strokeWidth="1" strokeDasharray="4,2" markerEnd="url(#arr)"/>
              <line x1="786" y1="155" x2="806" y2="170" stroke="#1a3a5a" strokeWidth="1" strokeDasharray="4,2" markerEnd="url(#arr)"/>

              {/* ── OUTPUTS ── */}
              <rect x="806" y="58" width="48" height="46" rx="5" fill="#0f2040" stroke="#3ecf8e66" strokeWidth="1.5"/>
              <text x="830" y="79" textAnchor="middle" fill="#3ecf8e" fontSize="10" fontWeight="700" fontFamily="monospace">QA</text>
              <text x="830" y="93" textAnchor="middle" fill="#3ecf8e" fontSize="10" fontWeight="700" fontFamily="monospace">Notes</text>

              <rect x="806" y="107" width="48" height="46" rx="5" fill="#0f2040" stroke="#7fb3e866" strokeWidth="1.5"/>
              <text x="830" y="128" textAnchor="middle" fill="#7fb3e8" fontSize="10" fontWeight="700" fontFamily="monospace">Im-</text>
              <text x="830" y="142" textAnchor="middle" fill="#7fb3e8" fontSize="10" fontWeight="700" fontFamily="monospace">pacts</text>

              <rect x="806" y="156" width="48" height="46" rx="5" fill="#0f2040" stroke="#e8c07f66" strokeWidth="1.5"/>
              <text x="830" y="177" textAnchor="middle" fill="#e8c07f" fontSize="10" fontWeight="700" fontFamily="monospace">BDD</text>
              <text x="830" y="191" textAnchor="middle" fill="#e8c07f" fontSize="10" fontWeight="700" fontFamily="monospace">Cases</text>
            </svg>
          </div>
        ) : (
          <div className="panel" style={{ overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Test Cases ({cases.length})</h2>
              <button className="secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={addCase}>+ Add Case</button>
            </div>
            {cases.map((tc, i) => (
              <CaseCard key={i} tc={tc} index={i} onChange={u => updateCase(i, u)} onRemove={() => removeCase(i)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #0f3460', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
        {generated && (
          <button
            onClick={() => onUseSession({
              issueInfo: { issue: generated.issueKey, dev: '', qa: '' },
              configNotes: '',
              qaNotes,
              impacts,
              cases,
            })}
          >
            Use This Session →
          </button>
        )}
      </div>
    </div>
  )
}
