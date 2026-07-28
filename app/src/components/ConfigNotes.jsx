import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function ConfigNotes({ value, onChange }) {
  const fields = Array.isArray(value) ? value : []
  const [nameInput, setNameInput] = useState('')
  const [nextId, setNextId] = useState(() => Date.now())
  const [showAddRow, setShowAddRow] = useState(false)
  const nameInputRef = useRef(null)
  const textareaRefs = useRef({})

  useEffect(() => {
    if (showAddRow) nameInputRef.current?.focus()
  }, [showAddRow])

  function addField() {
    const name = nameInput.trim()
    if (!name) return
    const id = nextId
    onChange([...fields, { id, name, value: '' }])
    setNextId(n => n + 1)
    setNameInput('')
    setShowAddRow(false)
    // focus the new textarea after render
    setTimeout(() => textareaRefs.current[id]?.focus(), 0)
  }

  function updateValue(i, val) {
    onChange(fields.map((f, idx) => idx === i ? { ...f, value: val } : f))
  }

  function removeField(i) {
    onChange(fields.filter((_, idx) => idx !== i))
  }

  const setTextareaRef = useCallback((id, el) => {
    if (el) textareaRefs.current[id] = el
    else delete textareaRefs.current[id]
  }, [])

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Additional Information</h2>
        {!showAddRow && (
          <button
            className="secondary"
            style={{ fontSize: 11, padding: '3px 12px', whiteSpace: 'nowrap' }}
            onClick={() => setShowAddRow(true)}
          >
            + Add Field
          </button>
        )}
      </div>

      {fields.map((f, i) => (
        <div key={f.id ?? f.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
              {f.name}
            </span>
            <button className="secondary" style={{ fontSize: 10, padding: '1px 7px' }} onClick={() => removeField(i)}>✕</button>
          </div>
          <textarea
            ref={el => setTextareaRef(f.id, el)}
            value={f.value}
            onChange={e => updateValue(i, e.target.value)}
            placeholder={`Value for "${f.name}"...`}
            rows={2}
            style={{ resize: 'vertical', fontSize: 12, marginBottom: 0 }}
          />
        </div>
      ))}

      {showAddRow && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addField()
              if (e.key === 'Escape') { setShowAddRow(false); setNameInput('') }
            }}
            placeholder='Custom field name, e.g. "Environment"'
            style={{ flex: 1, marginBottom: 0, fontSize: 12 }}
          />
          <button
            className="secondary"
            style={{ fontSize: 12, padding: '4px 12px', whiteSpace: 'nowrap' }}
            onClick={addField}
            disabled={!nameInput.trim()}
          >
            + Add Field
          </button>
        </div>
      )}
    </div>
  )
}
