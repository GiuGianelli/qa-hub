function esc(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderMd(raw) {
  if (!raw) return ''
  const escaped = esc(raw)
  function applyInline(text) {
    return text
      .replace(/`([^`\n]+)`/g, '<code style="background:#eee;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  }
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

function row(label, value) {
  return `<tr><td>${label}</td><td>${esc(value)}</td></tr>`
}

function rowRich(label, value) {
  const isHtml = /<[a-z][\s\S]*>/i.test(value || '')
  const content = isHtml ? value : renderMd(value)
  return `<tr><td>${label}</td><td>${content}</td></tr>`
}

module.exports = { esc, renderMd, row, rowRich }
