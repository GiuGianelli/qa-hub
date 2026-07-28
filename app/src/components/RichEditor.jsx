import React, { useRef } from 'react'

function applyInline(text) {
  return text
    .replace(/`([^`\n]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
}

export function renderMd(raw) {
  if (!raw) return ''
  const escaped = String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = escaped.split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul style="margin:2px 0;padding-left:16px">'; inList = true }
      html += `<li>${applyInline(line.slice(2))}</li>`
    } else {
      if (inList) { html += '</ul>'; inList = false }
      html += applyInline(line) + (line ? '<br/>' : '<br/>')
    }
  }
  if (inList) html += '</ul>'
  return html.replace(/(<br\/>)+$/, '')
}

function fmtWrap(el, value, onChange, before, after) {
  const s = el.selectionStart
  const e = el.selectionEnd
  const selected = value.slice(s, e)
  const newVal = value.slice(0, s) + before + selected + after + value.slice(e)
  onChange(newVal)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(s + before.length, e + before.length)
  })
}

function fmtBullet(el, value, onChange) {
  const s = el.selectionStart
  const lineStart = value.lastIndexOf('\n', s - 1) + 1
  if (value.slice(lineStart, lineStart + 2) === '- ') {
    const newVal = value.slice(0, lineStart) + value.slice(lineStart + 2)
    onChange(newVal)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(Math.max(s - 2, lineStart), Math.max(s - 2, lineStart)) })
  } else {
    const newVal = value.slice(0, lineStart) + '- ' + value.slice(lineStart)
    onChange(newVal)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 2, s + 2) })
  }
}

function ToolbarBtn({ label, title, onAction }) {
  return (
    <button
      type="button"
      className="secondary"
      title={title}
      style={{ padding: '1px 7px', fontSize: 11, minWidth: 0, fontStyle: label === 'I' ? 'italic' : 'normal', fontWeight: label === 'B' ? 700 : 400 }}
      onMouseDown={e => { e.preventDefault(); onAction() }}
    >
      {label}
    </button>
  )
}

export function Toolbar({ textareaRef, value, onChange, showBullet = true }) {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
      <ToolbarBtn label="B" title="Bold (**text**)" onAction={() => fmtWrap(textareaRef.current, value, onChange, '**', '**')} />
      <ToolbarBtn label="I" title="Italic (*text*)" onAction={() => fmtWrap(textareaRef.current, value, onChange, '*', '*')} />
      <ToolbarBtn label="`" title="Inline code" onAction={() => fmtWrap(textareaRef.current, value, onChange, '`', '`')} />
      {showBullet && <ToolbarBtn label="•" title="Bullet point" onAction={() => fmtBullet(textareaRef.current, value, onChange)} />}
    </div>
  )
}

export function RichTextArea({ value, onChange, placeholder, style, rows }) {
  const ref = useRef(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: style?.flex, minHeight: 0 }}>
      <Toolbar textareaRef={ref} value={value} onChange={onChange} showBullet />
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...style, resize: 'none' }}
      />
    </div>
  )
}
