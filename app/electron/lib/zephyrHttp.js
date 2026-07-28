const https = require('https')

function zephyrRequest(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'api.zephyrscale.smartbear.com',
      path: '/v2' + urlPath,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const req = https.request(options, (r) => {
      let b = ''
      r.on('data', c => b += c)
      r.on('end', () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(b ? JSON.parse(b) : {})
        else reject(new Error(`HTTP ${r.statusCode}: ${b}`))
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

module.exports = { zephyrRequest }
