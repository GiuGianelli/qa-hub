import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RichTextArea } from './RichEditor'

// ─── AI Skills panel ──────────────────────────────────────────────────────────

const TC_SKILLS = [
  {
    id: 'missing',
    label: 'Suggest Missing',
    icon: '🔍',
    buildPrompt: ({ issueContext, casesContext }) =>
      'You are a senior QA engineer. Analyze the test cases below and suggest missing scenarios.\n\n' +
      'Issue context:\n' + issueContext + '\n\nExisting test cases:\n' + casesContext + '\n\n' +
      'Return JSON (no markdown):\n{"suggestions":[{"name":"short name","objective":"one sentence","scenario":"Given ...\\nWhen ...\\nThen ..."}]}',
    renderResult: (r, onAdd) => (r.suggestions || []).map((s, i) => (
      <SkillResultCard key={s.name + i} title={s.name} onAdd={() => onAdd(s)}>
        <p style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 4px' }}>{s.objective}</p>
        <pre style={{ fontSize: 11, color: '#c0c8d8', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>{s.scenario}</pre>
      </SkillResultCard>
    )),
  },
  {
    id: 'review',
    label: 'Review Quality',
    icon: '🔬',
    buildPrompt: ({ casesContext }) =>
      'You are a QA coach. Review these test cases for clarity, completeness, and BDD best practices.\n\n' +
      'Test cases:\n' + casesContext + '\n\n' +
      'Return JSON (no markdown):\n{"overallScore":"Excellent|Good|Fair|Poor","reviews":[{"testCase":"name","score":"Excellent|Good|Fair|Poor","issues":["..."],"suggestions":["..."]}]}',
    renderResult: (r, { onAccept, onConvertOutline, convertingOutline, onApplySuggestions, applyingCase }) => {
      const scoreColor = { Excellent: '#3ecf8e', Good: '#7fb3e8', Fair: '#e8c07f', Poor: '#e94560' }
      return (
        <>
          {r.overallScore && (
            <div style={{ marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                background: (scoreColor[r.overallScore] || '#7f8fb5') + '22',
                color: scoreColor[r.overallScore] || '#7f8fb5',
                border: '1px solid ' + (scoreColor[r.overallScore] || '#7f8fb5') + '44',
              }}>Overall: {r.overallScore}</span>
            </div>
          )}
          {(r.reviews || []).map((rev, i) => {
            const suggestionsText = (rev.suggestions || []).join(' ').toLowerCase()
            const hasOutlineSuggestion = /outline|merge|scenario outline/.test(suggestionsText)
            const isConverting = convertingOutline?.[rev.testCase]
            const isApplying = applyingCase?.[rev.testCase]
            const hasFeedback = (rev.issues || []).length > 0 || (rev.suggestions || []).length > 0
            return (
              <SkillResultCard key={rev.testCase + i} title={rev.testCase} badge={rev.score} badgeColor={scoreColor[rev.score] || '#7f8fb5'}>
                {(rev.issues || []).length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <p style={{ fontSize: 10, color: '#e94560', fontWeight: 700, margin: '0 0 2px' }}>Issues</p>
                    {rev.issues.map((iss) => <p key={iss} style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 2px', paddingLeft: 8 }}>• {iss}</p>)}
                  </div>
                )}
                {(rev.suggestions || []).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 10, color: '#3ecf8e', fontWeight: 700, margin: '0 0 2px' }}>Suggestions</p>
                    {rev.suggestions.map((sug) => <p key={sug} style={{ fontSize: 11, color: '#7f8fb5', margin: '0 0 2px', paddingLeft: 8 }}>→ {sug}</p>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    className="secondary"
                    style={{ fontSize: 10, padding: '2px 10px', color: '#7fb3e8', borderColor: '#1a4a7a' }}
                    onClick={() => onAccept(rev.testCase)}
                  >
                    ✎ Edit Case
                  </button>
                  {hasFeedback && (
                    <button
                      className="secondary"
                      style={{ fontSize: 10, padding: '2px 10px', color: '#3ecf8e', borderColor: '#1a5a3a' }}
                      disabled={isApplying}
                      onClick={() => onApplySuggestions(rev.testCase, rev.issues || [], rev.suggestions || [])}
                    >
                      {isApplying ? 'Applying...' : '✓ Apply'}
                    </button>
                  )}
                  {hasOutlineSuggestion && (
                    <button
                      className="secondary"
                      style={{ fontSize: 10, padding: '2px 10px', color: '#e8c07f', borderColor: '#4a3a1a' }}
                      disabled={isConverting}
                      onClick={() => onConvertOutline(rev.testCase, rev.suggestions)}
                    >
                      {isConverting ? 'Converting...' : '⇄ Scenario Outline'}
                    </button>
                  )}
                </div>
              </SkillResultCard>
            )
          })}
        </>
      )
    },
  },
]

function SkillResultCard({ title, badge, badgeColor = '#7f8fb5', onAdd, children }) {
  return (
    <div style={{
      background: '#16213e', borderRadius: 4, padding: '8px 10px', marginBottom: 6,
      borderLeft: '2px solid ' + (badgeColor),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', flex: 1 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
            background: badgeColor + '22', color: badgeColor, border: '1px solid ' + badgeColor + '44',
          }}>{badge}</span>
        )}
        {onAdd && (
          <button
            className="secondary"
            style={{ fontSize: 10, padding: '2px 8px', color: '#3ecf8e', borderColor: '#1a5a3a' }}
            onClick={onAdd}
          >
            + Add
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function SkillsPanel({ issueInfo, cases, onAddCase, onEditCase, onUpdateCase, onClose }) {
  const [activeSkill, setActiveSkill] = useState(TC_SKILLS[0].id)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [convertingOutline, setConvertingOutline] = useState({})
  const [applyingCase, setApplyingCase] = useState({})

  const skill = TC_SKILLS.find(s => s.id === activeSkill)

  const issueContext = issueInfo
    ? 'Key: ' + (issueInfo.issue || '—') + '\nDev: ' + (issueInfo.dev || '—')
    : '(no issue info)'

  const casesContext = cases.length
    ? cases.map((c, i) => (i + 1) + '. ' + c.name + (c.objective ? ' — ' + c.objective : '') + (c.scenario ? '\n' + c.scenario : '')).join('\n\n')
    : '(no test cases yet)'

  function switchSkill(id) {
    setActiveSkill(id)
    setResult(null)
    setError('')
  }

  async function run() {
    if (!skill || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    const prompt = skill.buildPrompt({ issueContext, casesContext })
    const res = await window.api?.runSkill({ prompt })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    try {
      const text = res.text || ''
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      const match = start !== -1 && end > start ? [text.slice(start, end + 1)] : null
      setResult(JSON.parse(match[0]))
    } catch { setError('Unexpected response from Claude.') }
  }

  function handleAdd(suggestion) {
    onAddCase({
      ...EMPTY_FORM,
      name: suggestion.name || '',
      objective: suggestion.objective || '',
      scenario: suggestion.scenario || '',
    })
  }

  function handleAccept(caseName) {
    const idx = cases.findIndex(c => c.name === caseName)
    if (idx !== -1) onEditCase(idx)
  }

  async function handleApplySuggestions(caseName, issues, suggestions) {
    const tc = cases.find(c => c.name === caseName)
    if (!tc) return
    setApplyingCase(prev => ({ ...prev, [caseName]: true }))
    const prompt =
      'You are a QA coach. Improve the following test case by applying the given issues and suggestions.\n\n' +
      'Test case name: ' + caseName + '\n' +
      'Objective: ' + (tc.objective || '') + '\n' +
      'Current scenario:\n' + (tc.scenario || '') + '\n\n' +
      'Issues to fix:\n' + issues.map(i => '- ' + i).join('\n') + '\n\n' +
      'Suggestions to apply:\n' + suggestions.map(s => '- ' + s).join('\n') + '\n\n' +
      'Return JSON (no markdown):\n{"name":"improved test case name","objective":"improved one-sentence objective","scenario":"improved Gherkin scenario"}'
    const res = await window.api?.runSkill({ prompt })
    setApplyingCase(prev => ({ ...prev, [caseName]: false }))
    if (res?.error || !res?.text) return
    try {
      const text = res.text || ''
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end <= start) return
      const improved = JSON.parse(text.slice(start, end + 1))
      onUpdateCase(caseName, tc => ({
        ...tc,
        ...(improved.name ? { name: improved.name } : {}),
        ...(improved.objective ? { objective: improved.objective } : {}),
        ...(improved.scenario ? { scenario: improved.scenario } : {}),
      }))
    } catch { /* silently ignore parse error */ }
  }

  async function handleConvertOutline(caseName, suggestions) {
    const tc = cases.find(c => c.name === caseName)
    if (!tc) return
    setConvertingOutline(prev => ({ ...prev, [caseName]: true }))
    const prompt =
      'Convert the following Gherkin scenario into Scenario Outline format by identifying repeating patterns and extracting them into an Examples table.\n\n' +
      'Test case name: ' + caseName + '\n' +
      'Current scenario:\n' + (tc.scenario || '') + '\n\n' +
      'Review suggestions for context:\n' + suggestions.join('\n') + '\n\n' +
      'Return ONLY the raw Gherkin text (Scenario Outline: ... + Examples: table), no markdown fences, no explanation.'
    const res = await window.api?.runSkill({ prompt })
    setConvertingOutline(prev => ({ ...prev, [caseName]: false }))
    if (res?.error || !res?.text) return
    const outline = res.text.trim()
    onUpdateCase(caseName, tc => ({ ...tc, scenario: outline }))
  }

  const renderOpts = activeSkill === 'review'
    ? { onAccept: handleAccept, onConvertOutline: handleConvertOutline, convertingOutline, onApplySuggestions: handleApplySuggestions, applyingCase }
    : handleAdd

  return (
    <div style={{ background: '#0f1e3a', border: '1px solid #1a4a7a', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7fb3e8', flex: 1 }}>✨ AI Skills — Test Cases</span>
        <button className="secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={onClose}>✕</button>
      </div>

      {/* Skill tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {TC_SKILLS.map(s => (
          <button
            key={s.id}
            className="secondary"
            style={{
              fontSize: 10, padding: '3px 10px',
              background: activeSkill === s.id ? '#1a4a7a' : 'transparent',
              borderColor: activeSkill === s.id ? '#7fb3e8' : '#1a4a7a',
              color: activeSkill === s.id ? '#e0e0e0' : '#7f8fb5',
            }}
            onClick={() => switchSkill(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Run button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={run} disabled={loading} style={{ fontSize: 11, padding: '4px 14px' }}>
          {loading ? 'Running...' : skill.icon + ' Run'}
        </button>
      </div>

      {error && <p style={{ fontSize: 11, color: '#e94560', margin: '0 0 8px' }}>{error}</p>}

      {result && !loading && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {skill.renderResult(result, renderOpts)}
        </div>
      )}
    </div>
  )
}

function HelpIcon({ url }) {
  const [pos, setPos] = useState(null)

  const handleMouseEnter = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top })
  }, [])

  return (
    <span
      style={{ cursor: 'pointer', display: 'inline-flex', textTransform: 'none', letterSpacing: 0 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setPos(null)}
      onClick={() => url && window.api?.openExternal(url)}
    >
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#0f3460', border: '1px solid #7f8fb5', color: '#7f8fb5', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
      {pos && (
        <span style={{
          position: 'fixed', left: pos.x, top: pos.y - 36, transform: 'translateX(-50%)',
          background: '#0f3460', border: '1px solid #1a4a7a', color: '#c0c8d8',
          fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap', padding: '5px 10px',
          borderRadius: 4, pointerEvents: 'none', zIndex: 9999,
        }}>
          Learn Gherkin best practices
        </span>
      )}
    </span>
  )
}

const EMPTY_FORM = {
  name: '', objective: '', precondition: '',
  preconditionImages: [],
  status: 'Approved', priority: 'High',
  productComponent: '', squadTeam: '', regressionTests: 'No',
  testAutomation: 'No', testType: 'BDD',
  labels: '', scenario: '', folderId: '', assignee: ''
}

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Required'
  if (!form.productComponent.trim()) errors.productComponent = 'Required'
  if (!form.squadTeam.trim()) errors.squadTeam = 'Required'
  return errors
}

// ─── Precondition image upload ────────────────────────────────────────────────

function PreconditionImages({ images, onChange }) {
  const inputRef = useRef(null)

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => onChange([...images, { name: file.name, data: e.target.result }])
      reader.readAsDataURL(file)
    })
  }

  function remove(i) {
    onChange(images.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          className="secondary"
          style={{ fontSize: 10, padding: '2px 10px' }}
          onClick={() => inputRef.current?.click()}
        >
          + Add Image
        </button>
        <span style={{ fontSize: 10, color: '#4a5a7a', fontStyle: 'italic' }}>
          Images appear in the report only — not sent to Zephyr.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>
      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {images.map((img, i) => (
            <div key={img.name + i} style={{ position: 'relative' }}>
              <img
                src={img.data}
                alt={img.name}
                style={{ height: 56, width: 'auto', maxWidth: 120, borderRadius: 4, border: '1px solid #1a4a7a', objectFit: 'cover', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#e94560', border: 'none', color: '#fff',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add Existing modal ───────────────────────────────────────────────────────

function AddExistingModal({ onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResults(null)
    const res = await window.api?.zephyrSearchTestCases({ query: q })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    setResults(res.cases || [])
  }

  function pick(tc) {
    onAdd({
      name: tc.name,
      zephyrKey: tc.key,
      existingCase: true,
      status: tc.status || 'Approved',
      priority: tc.priority || 'High',
      objective: tc.objective || '',
      precondition: tc.precondition || '',
      productComponent: tc.productComponent || '',
      squadTeam: tc.squadTeam || '',
      regressionTests: 'No',
      testAutomation: 'No',
      testType: 'BDD',
      labels: '',
      scenario: '',
      folderId: tc.folderId || '',
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#16213e', border: '1px solid #0f3460', borderRadius: 8,
        padding: 20, width: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Add Existing Test Case</p>
          <button className="secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: 11, color: '#4a5a7a', margin: 0 }}>
          Search Zephyr by key (e.g. <span style={{ fontFamily: 'monospace', color: '#7f8fb5' }}>DEV-T123</span>) or name. The test case will appear in your session and report but won't be re-imported.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="DEV-T123 or test case name..."
            style={{ flex: 1, marginBottom: 0, fontSize: 12 }}
          />
          <button onClick={search} disabled={!query.trim() || loading} style={{ flexShrink: 0 }}>
            {loading ? '...' : 'Search'}
          </button>
        </div>

        {error && <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>}

        {results !== null && (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {results.length === 0 && (
              <p style={{ fontSize: 12, color: '#4a5a7a', margin: 0 }}>No test cases found.</p>
            )}
            {results.map(tc => (
              <button
                key={tc.key}
                onClick={() => pick(tc)}
                style={{
                  background: '#0f1e3a', border: '1px solid #1a4a7a', borderRadius: 4,
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                  width: '100%', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#e94560'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1a4a7a'}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#e94560', flexShrink: 0, minWidth: 80, paddingTop: 1 }}>{tc.key}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: '#e0e0e0', margin: '0 0 2px', fontWeight: 600 }}>{tc.name}</p>
                  {tc.status && <p style={{ fontSize: 11, color: '#4a5a7a', margin: 0 }}>{tc.status}{tc.priority ? ' · ' + tc.priority : ''}</p>}
                </div>
                <span style={{ fontSize: 10, color: '#3ecf8e', flexShrink: 0, paddingTop: 2 }}>+ Add</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TestCases({ cases, onChange, issueInfo, style }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [editingIndex, setEditingIndex] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showExisting, setShowExisting] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [folders, setFolders] = useState([])
  const [folderSearch, setFolderSearch] = useState('')
  const [folderOpen, setFolderOpen] = useState(false)
  const [helpUrl, setHelpUrl] = useState('')

  useEffect(() => {
    window.api?.getFolders({ folderType: 'TEST_CASE' }).then(f => setFolders(f || []))
    window.api?.readEnv().then(env => setHelpUrl(env?.confluenceGherkinUrl || ''))
  }, [])

  const FILL_ALL_FIELDS = ['assignee', 'productComponent', 'squadTeam', 'folderId']

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function addCase() {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (editingIndex !== null) {
      const updated = cases.map((c, i) => {
        if (i === editingIndex) return { ...form }
        const patched = { ...c }
        FILL_ALL_FIELDS.forEach(f => { if (!c[f] && form[f]) patched[f] = form[f] })
        return patched
      })
      onChange(updated)
      setEditingIndex(null)
    } else {
      const saved = { ...form }
      const patched = cases.map(c => {
        const p = { ...c }
        FILL_ALL_FIELDS.forEach(f => { if (!c[f] && saved[f]) p[f] = saved[f] })
        return p
      })
      onChange([...patched, saved])
    }
    setForm(EMPTY_FORM)
    setFolderSearch('')
    setShowForm(false)
  }

  function editCase(i) {
    const c = cases[i]
    setForm({ ...c })
    setEditingIndex(i)
    setShowForm(true)
    if (c.folderId) {
      const byId = Object.fromEntries(folders.map(f => [f.id, f]))
      function getPath(f) {
        const parts = []
        let cur = f
        while (cur) { parts.unshift(cur.name); cur = cur.parentId ? byId[cur.parentId] : null }
        return parts.join(' / ')
      }
      const found = folders.find(f => String(f.id) === String(c.folderId))
      setFolderSearch(found ? getPath(found) : '')
    } else {
      setFolderSearch('')
    }
  }

  function cancelEdit() {
    setForm(EMPTY_FORM)
    setErrors({})
    setEditingIndex(null)
    setShowForm(false)
    setFolderSearch('')
  }

  function removeCase(i) {
    if (editingIndex === i) cancelEdit()
    onChange(cases.filter((_, idx) => idx !== i))
  }

  return (
    <div className="panel" style={{ gap: 0, ...style }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Test Cases
        <HelpIcon url={helpUrl} />
        <button
          className="secondary"
          style={{ fontSize: 10, padding: '2px 8px', marginLeft: 'auto', color: '#7fb3e8', borderColor: '#1a4a7a' }}
          onClick={() => setShowSkills(v => !v)}
        >
          ✨ AI Skills
        </button>
      </h2>

      {showSkills && (
        <SkillsPanel
          issueInfo={issueInfo}
          cases={cases}
          onAddCase={tc => onChange([...cases, tc])}
          onEditCase={editCase}
          onUpdateCase={(name, updater) => {
            const idx = cases.findIndex(c => c.name === name)
            if (idx === -1) return
            const updated = [...cases]
            updated[idx] = updater(updated[idx])
            onChange(updated)
          }}
          onClose={() => setShowSkills(false)}
        />
      )}

      {cases.length > 0 && (
        <ul style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', overflowY: 'auto', flexShrink: showForm ? 0 : 1, flex: showForm ? '0 0 auto' : '1 1 0', maxHeight: showForm ? 120 : undefined, minHeight: 0 }}>
          {cases.map((tc, i) => {
            const rowBg = editingIndex === i ? '#1a4a7a' : '#0f3460'
            let rowBorder = 'transparent'
            if (editingIndex === i) rowBorder = '#e94560'
            else if (tc._importResult?.ok === false) rowBorder = '#e9456066'
            return (
            <li key={tc.name + i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: rowBg, borderRadius: 4, padding: '5px 8px', border: `1px solid ${rowBorder}` }}>
              <span style={{ color: '#e94560', fontSize: 11, fontWeight: 600 }}>{i + 1}</span>
              <span style={{ flex: 1, color: '#c0c8d8', fontSize: 12 }}>{tc.name}</span>
              {tc._importResult?.ok === true && (
                <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 700, flexShrink: 0 }} title="Imported">✓</span>
              )}
              {tc._importResult?.ok === false && (
                <span style={{ fontSize: 11, color: '#e94560', fontWeight: 700, flexShrink: 0 }} title="Import failed">✗</span>
              )}
              {(tc.existingCase || tc._importResult?.ok === true) && tc.zephyrKey && (
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#3ecf8e', background: '#0a2a1a', border: '1px solid #1a5a3a', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
                  {tc.zephyrKey}
                </span>
              )}
              {!tc.existingCase && tc._importResult?.ok !== true && (
                <button className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => editCase(i)}>✎</button>
              )}
              <button className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeCase(i)}>✕</button>
            </li>
            )
          })}
        </ul>
      )}

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginBottom: 10 }}>
          <button
            className="secondary"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => {
              if (cases.length > 0) {
                const last = cases[cases.length - 1]
                const prefill = {}
                FILL_ALL_FIELDS.forEach(f => { if (last[f]) prefill[f] = last[f] })
                setForm(prev => ({ ...prev, ...prefill }))
                if (last.folderId) {
                  const byId = Object.fromEntries(folders.map(fo => [fo.id, fo]))
                  function getPath(fo) {
                    const parts = []
                    let cur = fo
                    while (cur) { parts.unshift(cur.name); cur = cur.parentId ? byId[cur.parentId] : null }
                    return parts.join(' / ')
                  }
                  const found = folders.find(fo => String(fo.id) === String(last.folderId))
                  if (found) setFolderSearch(getPath(found))
                }
              }
              setShowForm(true)
            }}
          >
            + Add Test Case
          </button>
          <button
            className="secondary"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => setShowExisting(true)}
          >
            + Add Existing
          </button>
        </div>
      )}

      {showForm && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Name *</label>
          <input placeholder="Test case name" value={form.name} onChange={e => set('name', e.target.value)} style={errors.name ? { borderColor: '#e94560' } : {}} />
          {errors.name && <span style={{ color: '#e94560', fontSize: 11 }}>{errors.name}</span>}
        </div>
        <div>
          <label>Objective</label>
          <input placeholder="What is being tested" value={form.objective} onChange={e => set('objective', e.target.value)} />
        </div>
        <div>
          <label>Assignee</label>
          <input placeholder="e.g. John Smith" value={form.assignee} onChange={e => set('assignee', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Precondition</label>
          <RichTextArea
            value={form.precondition}
            onChange={v => set('precondition', v)}
            placeholder="Prerequisites, initial state, required data..."
            rows={3}
          />
          <PreconditionImages
            images={form.preconditionImages || []}
            onChange={imgs => set('preconditionImages', imgs)}
          />
        </div>
        <div>
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Draft</option>
            <option>Approved</option>
            <option>Deprecated</option>
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option>Low</option>
            <option>Normal</option>
            <option>High</option>
          </select>
        </div>
        <div>
          <label>Product Component *</label>
          <input placeholder="e.g. Risk Engine" value={form.productComponent} onChange={e => set('productComponent', e.target.value)} style={errors.productComponent ? { borderColor: '#e94560' } : {}} />
          {errors.productComponent && <span style={{ color: '#e94560', fontSize: 11 }}>{errors.productComponent}</span>}
        </div>
        <div>
          <label>Squad / Team *</label>
          <input placeholder="e.g. Risk" value={form.squadTeam} onChange={e => set('squadTeam', e.target.value)} style={errors.squadTeam ? { borderColor: '#e94560' } : {}} />
          {errors.squadTeam && <span style={{ color: '#e94560', fontSize: 11 }}>{errors.squadTeam}</span>}
        </div>
        <div>
          <label>Regression Tests?</label>
          <select value={form.regressionTests} onChange={e => set('regressionTests', e.target.value)}>
            <option>No</option>
            <option>Sanity</option>
            <option>Regression</option>
          </select>
        </div>
        <div>
          <label>Test Automation</label>
          <select value={form.testAutomation} onChange={e => set('testAutomation', e.target.value)}>
            <option>No</option>
            <option>Can be Automated</option>
            <option>In Progress</option>
            <option>Automated</option>
          </select>
        </div>
        <div>
          <label>Test Type</label>
          <select value={form.testType} onChange={e => set('testType', e.target.value)}>
            <option>BDD</option>
            <option>Positive</option>
            <option>Negative</option>
          </select>
        </div>
        <div>
          <label>Labels</label>
          <input placeholder="Optional" value={form.labels} onChange={e => set('labels', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Folder</label>
          <input
            placeholder="Search folder..."
            value={folderSearch}
            onChange={e => { setFolderSearch(e.target.value); set('folderId', ''); setFolderOpen(true) }}
            onFocus={() => setFolderOpen(true)}
            style={{ marginBottom: 4 }}
          />
          {folderSearch.trim() && folderOpen && (
            <div style={{ background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: 4, maxHeight: 180, overflowY: 'auto' }}>
              {(() => {
                const byId = Object.fromEntries(folders.map(f => [f.id, f]))
                function getPath(f) {
                  const parts = []
                  let cur = f
                  while (cur) {
                    parts.unshift(cur.name)
                    cur = cur.parentId ? byId[cur.parentId] : null
                  }
                  return parts.join(' / ')
                }
                const term = folderSearch.toLowerCase()
                const matched = folders
                  .map(f => ({ f, path: getPath(f) }))
                  .filter(({ path }) => path.toLowerCase().includes(term))
                  .slice(0, 40)
                if (!matched.length) return <div style={{ padding: '6px 10px', fontSize: 12, color: '#7f8fb5' }}>No folders found</div>
                return matched.map(({ f, path }) => (
                  <div
                    key={f.id}
                    onClick={() => { set('folderId', String(f.id)); setFolderSearch(path); setFolderOpen(false) }}
                    style={{
                      padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                      color: form.folderId === String(f.id) ? '#3ecf8e' : '#c0c8d8',
                      borderBottom: '1px solid #1a4a7a',
                      background: form.folderId === String(f.id) ? '#0a2040' : 'transparent',
                    }}
                  >
                    {path}
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>BDD Scenario (Gherkin steps)</label>
          <textarea
            rows={4}
            style={{ resize: 'none' }}
            placeholder={"Given ...\nWhen ...\nThen ..."}
            value={form.scenario}
            onChange={e => set('scenario', e.target.value)}
          />
        </div>
      </div>}

      {showForm && (
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={cancelEdit}>Cancel</button>
          <button className="secondary" onClick={addCase} disabled={!form.name.trim()}>
            {editingIndex !== null ? 'SAVE' : 'ADD'}
          </button>
        </div>
      )}

      {showExisting && (
        <AddExistingModal
          onAdd={tc => onChange([...cases, tc])}
          onClose={() => setShowExisting(false)}
        />
      )}
    </div>
  )
}
