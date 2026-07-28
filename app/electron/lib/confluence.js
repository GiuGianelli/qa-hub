const https = require('https')

const pageCache = {}

async function fetchConfluencePage(pageId, jiraBaseUrl, jiraEmail, jiraApiToken) {
  if (pageCache[pageId]) return pageCache[pageId]
  const hostname = jiraBaseUrl.replace(/^https?:\/\//, '')
  const basicAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
  const raw = await new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: `/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage`,
      method: 'GET',
      headers: { 'Authorization': 'Basic ' + basicAuth, 'Accept': 'application/json' },
    }
    const req = https.request(options, (r) => {
      let b = ''
      r.on('data', c => b += c)
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(JSON.parse(b))
        else reject(new Error(`Confluence HTTP ${r.statusCode}: ${b.slice(0, 200)}`))
      })
    })
    req.on('error', reject)
    req.end()
  })
  const html = raw?.body?.storage?.value || ''
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6000)
  pageCache[pageId] = text
  return text
}

module.exports = { fetchConfluencePage }
