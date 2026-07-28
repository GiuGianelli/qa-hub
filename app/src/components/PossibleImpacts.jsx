import React, { useState, useRef } from 'react'
import { Toolbar, renderMd } from './RichEditor'

export default function PossibleImpacts({ value, onChange }) {
  const [input, setInput] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingText, setEditingText] = useState('')
  const inputRef = useRef(null)
  const editRef = useRef(null)

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
      <h2>Possible Impacts</h2>
      <div style={{ marginBottom: 10 }}>
        <Toolbar textareaRef={inputRef} value={input} onChange={setInput} showBullet />
        <div className="row" style={{ gap: 6 }}>
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="Add a possible impact..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
            style={{ flex: 1, resize: 'none', marginBottom: 0 }}
          />
          <button onClick={add} style={{ alignSelf: 'flex-end' }}>ADD</button>
        </div>
      </div>
      <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {value.map((impact, i) => (
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
                  dangerouslySetInnerHTML={{ __html: renderMd(impact) }}
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
