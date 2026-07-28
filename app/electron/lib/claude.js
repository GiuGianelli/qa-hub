const path = require('path')
const fs = require('fs')
const { execSync, spawn } = require('child_process')

function findClaudeBinary() {
  try { return execSync('which claude', { encoding: 'utf-8' }).trim() } catch {}
  const candidates = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(process.env.HOME || '', '.local/bin/claude'),
    path.join(process.env.HOME || '', '.npm-global/bin/claude'),
  ]
  return candidates.find(p => fs.existsSync(p)) || 'claude'
}

function runClaude(prompt, { anthropicKey, anthropicBaseUrl, timeoutMs = 300000 }) {
  const claudePath = findClaudeBinary()
  return new Promise((resolve, reject) => {
    const proc = spawn(claudePath, ['--print', '--output-format', 'json', '--dangerously-skip-permissions'], {
      env: { ...process.env, ANTHROPIC_AUTH_TOKEN: anthropicKey, ANTHROPIC_BASE_URL: anthropicBaseUrl },
    })
    let out = '', err = ''

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Claude timed out after ${timeoutMs / 1000}s — the diff may be too large or the CLI is unresponsive.`))
    }, timeoutMs)

    proc.stdout.on('data', d => out += d)
    proc.stderr.on('data', d => err += d)
    proc.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) { reject(new Error(err || out.slice(0, 500) || `claude exited with code ${code}`)); return }

      const lines = out.trim().split('\n').filter(Boolean)

      // Log token usage
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          const usage = json.usage || json.usage_info || {}
          if (usage.input_tokens || usage.output_tokens) {
            const cost = json.total_cost_usd != null ? ` | cost: $${json.total_cost_usd.toFixed(6)}` : ''
            console.log(`[claude] tokens — input: ${usage.input_tokens ?? '?'}, output: ${usage.output_tokens ?? '?'}${cost}`)
            break
          }
        } catch {}
      }

      // Extract result text from JSONL
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const json = JSON.parse(lines[i])
          if (json.type === 'result' && typeof json.result === 'string') { resolve(json.result); return }
          if (json.role === 'assistant') {
            const content = Array.isArray(json.content) ? json.content.map(c => c.text || '').join('') : (json.content || '')
            if (content) { resolve(content); return }
          }
        } catch {}
      }

      // Fallback: single JSON object
      try {
        const json = JSON.parse(out.trim())
        if (typeof json.result === 'string') { resolve(json.result); return }
      } catch {}

      resolve(out)
    })
    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

module.exports = { runClaude }
