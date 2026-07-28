import React, { useState, useRef, useEffect } from 'react'

// ─── Jira helpers ────────────────────────────────────────────────────────────

const JIRA_SUGGESTIONS = [
  'How many tickets are on hold due to dependency from another team this sprint?',
  'How many tickets were moved because of priority changes?',
  'How many tickets were reopened due to problems found during testing?',
  'How many tickets are blocked due to missing information?',
]

const STATUS_COLORS = {
  'To Do': '#7f8fb5', 'In Progress': '#7fb3e8',
  'Done': '#3ecf8e', 'On Hold': '#e8c07f', 'Blocked': '#e94560',
}
function statusColor(s) { return STATUS_COLORS[s] || '#7f8fb5' }

// ─── Jira metrics ────────────────────────────────────────────────────────────

function JiraTab() {
  const [prompt, setPrompt] = useState('')
  const [step, setStep] = useState('idle')
  const [metric, setMetric] = useState(null)
  const [jqlResult, setJqlResult] = useState(null)
  const [savedFilter, setSavedFilter] = useState(null)
  const [error, setError] = useState('')
  const [editingJql, setEditingJql] = useState(false)
  const [jqlDraft, setJqlDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    window.api?.readEnv().then(env => setJiraBaseUrl(env?.jiraBaseUrl || ''))
  }, [])

  function openInJira(jql) {
    if (!jiraBaseUrl || !jql) return
    const url = jiraBaseUrl.replace(/\/$/, '') + '/issues/?jql=' + encodeURIComponent(jql)
    window.api?.openExternal(url)
  }

  function reset() {
    setPrompt(''); setStep('idle'); setMetric(null); setJqlResult(null)
    setSavedFilter(null); setError(''); setEditingJql(false); setJqlDraft(''); setSaving(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function generate() {
    const p = prompt.trim()
    if (!p || step === 'generating') return
    setStep('generating'); setError(''); setMetric(null); setJqlResult(null); setSavedFilter(null)
    const res = await window.api?.metricsGenerate({ prompt: p })
    if (res?.error) { setError(res.error); setStep('error'); return }
    setMetric(res.metric); setJqlDraft(res.metric.jql); setStep('preview')
  }

  async function runQuery() {
    const jql = metric?.jql
    if (!jql) return
    setStep('running'); setError(''); setJqlResult(null)
    const res = await window.api?.metricsRunJql({ jql })
    if (res?.error) { setError(res.error); setStep('error'); return }
    setJqlResult(res); setStep('done')
  }

  function applyJqlEdit() { setMetric(prev => ({ ...prev, jql: jqlDraft })); setEditingJql(false) }

  async function saveFilter() {
    if (!metric || saving) return
    setSaving(true)
    const res = await window.api?.metricsSaveFilter({ name: metric.filterName || metric.name, jql: metric.jql, description: metric.description })
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setSavedFilter(res)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Input */}
      <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, padding: '14px 16px' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
          Describe your metric
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() } }}
            placeholder="e.g. How many tickets were put on hold this sprint due to dependency from another team?"
            rows={2}
            disabled={step === 'generating' || step === 'running'}
            style={{ flex: 1, fontSize: 12, resize: 'none', marginBottom: 0 }}
            autoFocus
          />
          <button onClick={generate} disabled={!prompt.trim() || step === 'generating' || step === 'running'} style={{ whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
            {step === 'generating' ? 'Thinking...' : 'Generate'}
          </button>
        </div>
        {step === 'idle' && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 10, color: '#4a5a7a', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggestions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {JIRA_SUGGESTIONS.map((s, i) => (
                <button key={i} className="secondary" style={{ fontSize: 11, padding: '4px 10px', textAlign: 'left' }} onClick={() => setPrompt(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {step === 'error' && error && (
        <div style={{ background: '#2a1a1a', border: '1px solid #e9456044', borderRadius: 6, padding: '12px 16px' }}>
          <p style={{ fontSize: 12, color: '#e94560', margin: 0 }}>{error}</p>
          <button className="secondary" style={{ marginTop: 8, fontSize: 11 }} onClick={reset}>Try Again</button>
        </div>
      )}

      {metric && step !== 'idle' && step !== 'generating' && (
        <div style={{ background: '#16213e', border: '1px solid #1a4a7a', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={metric.name} onChange={e => setMetric(prev => ({ ...prev, name: e.target.value }))}
                style={{ fontSize: 14, fontWeight: 700, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', color: '#e0e0e0', marginBottom: 0, width: '100%' }}
                onFocus={e => { e.target.style.borderColor = '#1a4a7a' }} onBlur={e => { e.target.style.borderColor = 'transparent' }} />
              <input value={metric.description} onChange={e => setMetric(prev => ({ ...prev, description: e.target.value }))}
                style={{ fontSize: 12, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', color: '#7f8fb5', marginBottom: 0, width: '100%' }}
                onFocus={e => { e.target.style.borderColor = '#1a4a7a' }} onBlur={e => { e.target.style.borderColor = 'transparent' }} />
            </div>
            <button className="secondary" style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }} onClick={reset}>New metric</button>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>JQL Query</p>
              {!editingJql && <button className="secondary" style={{ fontSize: 10, padding: '1px 8px' }} onClick={() => { setJqlDraft(metric.jql); setEditingJql(true) }}>Edit</button>}
            </div>
            {editingJql ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={jqlDraft} onChange={e => setJqlDraft(e.target.value)} rows={3} style={{ fontSize: 11, fontFamily: 'monospace', resize: 'vertical', marginBottom: 0 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ fontSize: 11 }} onClick={applyJqlEdit}>Apply</button>
                  <button className="secondary" style={{ fontSize: 11 }} onClick={() => setEditingJql(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <pre style={{ background: '#0f1e3a', border: '1px solid #1a4a7a', borderRadius: 4, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: '#7fb3e8', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {metric.jql}
              </pre>
            )}
            <p style={{ fontSize: 10, color: '#4a5a7a', margin: '6px 0 0' }}>{metric.explanation}</p>
          </div>

          {(step === 'preview' || step === 'done') && (
            <button onClick={runQuery} style={{ alignSelf: 'flex-start' }} disabled={step === 'running'}>
              {jqlResult ? 'Re-run Query' : 'Run Query in Jira'}
            </button>
          )}
          {step === 'running' && <p style={{ fontSize: 11, color: '#7f8fb5', margin: 0 }}>Querying Jira...</p>}
        </div>
      )}

      {jqlResult && step === 'done' && (
        <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#e9456022', border: '1px solid #e9456044', borderRadius: 8, padding: '10px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: '#e94560', margin: 0, lineHeight: 1 }}>{jqlResult.total}</p>
              <p style={{ fontSize: 10, color: '#7f8fb5', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>tickets</p>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', margin: '0 0 2px' }}>{metric.name}</p>
              <p style={{ fontSize: 11, color: '#7f8fb5', margin: 0 }}>{metric.description}</p>
            </div>
          </div>

          {jqlResult.issues?.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                Sample issues {jqlResult.total > 10 ? '(showing 10 of ' + jqlResult.total + ')' : ''}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {jqlResult.issues.map(issue => (
                  <div key={issue.key} style={{ background: '#0f1e3a', borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e94560', fontFamily: 'monospace', flexShrink: 0, minWidth: 90 }}>{issue.key}</span>
                    <span style={{ fontSize: 11, color: '#c0c8d8', flex: 1 }}>{issue.summary}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, flexShrink: 0, background: statusColor(issue.status) + '22', color: statusColor(issue.status), border: '1px solid ' + statusColor(issue.status) + '44' }}>{issue.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {jqlResult.total === 0 && <p style={{ fontSize: 12, color: '#4a5a7a', margin: 0 }}>No tickets matched this query.</p>}

          <div style={{ borderTop: '1px solid #0f3460', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jiraBaseUrl && (
              <button className="secondary" style={{ alignSelf: 'flex-start', fontSize: 11 }} onClick={() => openInJira(metric?.jql)}>
                Open in Jira Issue Navigator ↗
              </button>
            )}
            {savedFilter ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#3ecf8e', fontWeight: 600 }}>✓ Filter saved in Jira</span>
                <span style={{ fontSize: 11, color: '#7f8fb5' }}>"{savedFilter.filterName}"</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={saveFilter} disabled={saving}>{saving ? 'Saving...' : 'Save Filter to Jira'}</button>
                <p style={{ fontSize: 11, color: '#4a5a7a', margin: 0 }}>Creates a saved filter in Jira you can add to dashboards</p>
              </div>
            )}
            {error && !savedFilter && <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Root screen ──────────────────────────────────────────────────────────────

export default function MetricsScreen({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #0f3460', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', margin: '0 0 12px' }}>Quality Metrics</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <JiraTab />
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid #0f3460', flexShrink: 0 }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
      </div>
    </div>
  )
}
