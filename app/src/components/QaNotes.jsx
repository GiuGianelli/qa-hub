import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Toolbar, renderMd } from './RichEditor'

function SkillSuggestNotes({ issueContext, onAccept, onClose }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(new Set())

  useEffect(() => { run() }, [])

  async function run() {
    setLoading(true)
    setError('')
    setSuggestions(null)
    const prompt = 'You are a senior QA engineer. Based on the issue context below, generate concise and actionable QA notes.\n\n' +
      'Issue context:\n' + issueContext + '\n\n' +
      'Respond with a plain numbered list, one note per line, like:\n' +
      '1. Note one here\n2. Note two here\n\n' +
      'Generate 4-6 notes. No headers, no markdown, no JSON. Just the numbered list.'
    const res = await window.api?.runSkill({ prompt })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    const raw = (res.text || '').trim()
    const lines = raw.split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(l => l.length > 0)
    if (!lines.length) { setError('No suggestions returned.'); return }
    setSuggestions(lines)
  }

  function toggle(i) {
    setAccepted(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function accept() {
    onAccept(suggestions.filter((_, i) => accepted.has(i)))
  }

  return (
    <div style={{
      background: '#0f1e3a', border: '1px solid #1a4a7a', borderRadius: 6,
      padding: '12px 14px', marginBottom: 10,
      display: 'flex', flexDirection: 'column', maxHeight: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7fb3e8', flex: 1 }}>✨ AI Skill — Suggest QA Notes</span>
        <button className="secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={onClose}>✕</button>
      </div>
      {!suggestions && !loading && (
        <button onClick={run} style={{ fontSize: 11, padding: '4px 14px' }}>
          Generate suggestions
        </button>
      )}
      {loading && <p style={{ fontSize: 11, color: '#7f8fb5', margin: 0 }}>Calling Claude AI...</p>}
      {error && <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>}
      {suggestions && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: '#4a5a7a', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginRight: 4 }}>
              {accepted.size > 0 ? accepted.size + ' selected' : 'Select to add'}
            </span>
            <button onClick={accept} disabled={accepted.size === 0} style={{ fontSize: 10, padding: '2px 10px' }}>
              Add selected
            </button>
            <button className="secondary" style={{ fontSize: 10, padding: '2px 10px' }} onClick={() => onAccept(suggestions)}>
              Add all
            </button>
            <button className="secondary" onClick={run} style={{ fontSize: 10, padding: '2px 10px' }}>
              Regenerate
            </button>
            <button className="secondary" onClick={onClose} style={{ fontSize: 10, padding: '2px 10px', marginLeft: 'auto', color: '#e94560' }}>
              Discard
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>
            {suggestions.map((note, i) => (
              <div
                key={i}
                onClick={() => toggle(i)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px',
                  background: accepted.has(i) ? '#0a2a1a' : '#16213e',
                  border: '1px solid ' + (accepted.has(i) ? '#3ecf8e' : '#1a4a7a'),
                  borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 12, color: accepted.has(i) ? '#3ecf8e' : '#4a5a7a', flexShrink: 0, marginTop: 1 }}>
                  {accepted.has(i) ? '✓' : '○'}
                </span>
                <span style={{ fontSize: 11, color: '#c0c8d8', lineHeight: 1.5 }}>{note}</span>
              </div>
            ))}
          </div>
        </>
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
          Learn about QA workflow and QA Notes
        </span>
      )}
    </span>
  )
}

export default function QaNotes({ value, onChange, issueInfo, cases }) {
  const [input, setInput] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [showSkill, setShowSkill] = useState(false)
  const [helpUrl, setHelpUrl] = useState('')
  const inputRef = useRef(null)
  const editRef = useRef(null)

  useEffect(() => {
    window.api?.readEnv().then(env => setHelpUrl(env?.confluenceQaNotesUrl || ''))
  }, [])

  const issueContext = [
    issueInfo?.issue ? 'Issue key: ' + issueInfo.issue : null,
    issueInfo?.dev ? 'Developer: ' + issueInfo.dev : null,
    issueInfo?.qa ? 'QA: ' + issueInfo.qa : null,
    cases?.length ? 'Test cases planned: ' + cases.map(c => c.name).join(', ') : null,
    value?.length ? 'Existing QA notes: ' + value.map(n => typeof n === 'string' ? n : (n?.text || '')).join(' | ') : null,
  ].filter(Boolean).join('\n') || '(no context available)'

  function add() {
    const trimmed = input.trim()
    if (!trimmed) return
    onChange([...value, trimmed])
    setInput('')
  }

  function startEdit(i) {
    setEditingIndex(i)
    setEditingText(value[i])
  }

  function saveEdit(i) {
    const trimmed = editingText.trim()
    if (!trimmed) return
    const updated = [...value]
    updated[i] = trimmed
    onChange(updated)
    setEditingIndex(null)
  }

  function cancelEdit() {
    setEditingIndex(null)
    setEditingText('')
  }

  function remove(i) {
    if (editingIndex === i) cancelEdit()
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="panel">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        QA Notes
        <HelpIcon url={helpUrl} />
        <button
          className="secondary"
          style={{ fontSize: 10, padding: '2px 8px', marginLeft: 'auto', color: '#7fb3e8', borderColor: '#1a4a7a' }}
          onClick={() => setShowSkill(v => !v)}
        >
          ✨ Suggest
        </button>
      </h2>
      {showSkill && (
        <SkillSuggestNotes
          issueContext={issueContext}
          onAccept={notes => { onChange([...value, ...notes]); setShowSkill(false) }}
          onClose={() => setShowSkill(false)}
        />
      )}
      <div style={{ marginBottom: 10 }}>
        <Toolbar textareaRef={inputRef} value={input} onChange={setInput} showBullet />
        <div className="row" style={{ gap: 6 }}>
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="Add a note..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
            style={{ flex: 1, resize: 'none', marginBottom: 0 }}
          />
          <button onClick={add} style={{ alignSelf: 'flex-end' }}>ADD</button>
        </div>
      </div>
      <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {value.map((note, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#e94560', marginTop: editingIndex === i ? 7 : 4 }}>•</span>
            {editingIndex === i ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Toolbar textareaRef={editRef} value={editingText} onChange={setEditingText} showBullet />
                <div style={{ display: 'flex', gap: 6 }}>
                  <textarea
                    ref={editRef}
                    autoFocus
                    rows={2}
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(i) } if (e.key === 'Escape') cancelEdit() }}
                    style={{ flex: 1, resize: 'none', marginBottom: 0 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => saveEdit(i)}>✓</button>
                    <button className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={cancelEdit}>✕</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <span
                  style={{ flex: 1, color: '#c0c8d8', fontSize: 12, lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: renderMd(note) }}
                />
                <button className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => startEdit(i)}>✎</button>
                <button className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => remove(i)}>✕</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
