const path = require('node:path')
const fs = require('node:fs')
const { execSync } = require('node:child_process')
const { ROOT } = require('./env')

const SKIP_DIRS = new Set(['dotfiles', 'logs', 'monitoring_stack', '.git', '.github', '.idea', 'node_modules', 'target', 'build', 'dist'])

const PATTERNS_FILE = path.join(ROOT, '.qa-hub-patterns.json')

// ─── Learned patterns ─────────────────────────────────────────────────────────

function loadPatterns() {
  try {
    if (fs.existsSync(PATTERNS_FILE)) return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf-8'))
  } catch {}
  return {}
}

function savePatterns(patterns) {
  try { fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8') } catch {}
}

// Reinforce keyword → module associations from a real diff result.
// keywords: string[], touchedModules: string[] (relative paths like "core/billing")
function learnFromDiff(keywords, touchedModules) {
  if (!keywords.length || !touchedModules.length) return
  const patterns = loadPatterns()
  for (const kw of keywords) {
    if (!patterns[kw]) patterns[kw] = {}
    for (const mod of touchedModules) {
      patterns[kw][mod] = (patterns[kw][mod] || 0) + 1
    }
  }
  savePatterns(patterns)
}

// Return module paths that learned patterns associate with these keywords, sorted by score.
function learnedModulesFor(keywords) {
  const patterns = loadPatterns()
  const scores = {}
  for (const kw of keywords) {
    const mods = patterns[kw] || {}
    for (const [mod, count] of Object.entries(mods)) {
      scores[mod] = (scores[mod] || 0) + count
    }
  }
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([mod]) => mod)
}

// ─── Keyword extraction ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'of', 'to', 'for', 'with', 'is', 'are',
  'was', 'be', 'this', 'that', 'it', 'as', 'at', 'by', 'from', 'not', 'but', 'also',
  'should', 'will', 'when', 'then', 'given', 'feature', 'user', 'story', 'task',
  'ticket', 'issue', 'fix', 'add', 'update', 'change', 'create', 'remove', 'new',
  'want', 'since', 'more', 'have', 'size', 'time', 'into', 'that', 'which',
])

function splitCamelCase(word) {
  // "BillingService" → ["billing","service"], "riskFeature" → ["risk","feature"]
  const spaced = word
    .replace(/([A-Z][a-z])/g, ' $1')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
  return spaced.toLowerCase().split(/\s+/).filter(Boolean)
}

function extractKeywords(text, { components = [], labels = [] } = {}) {
  const rawWords = text
    .replace(/[^a-zA-Z0-9\s\-_]/g, ' ')
    .split(/[\s\-_]+/)
    .flatMap(w => splitCamelCase(w))
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))

  // Component names get highest priority — split them too and deduplicate
  const componentWords = components
    .flatMap(c => c.replace(/[^a-zA-Z0-9\s\-_]/g, ' ').split(/[\s\-_]+/).flatMap(splitCamelCase))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))

  const labelWords = labels
    .flatMap(l => l.replace(/[^a-zA-Z0-9\s\-_]/g, ' ').split(/[\s\-_]+/).flatMap(splitCamelCase))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))

  // Components and labels come first (they define the domain precisely)
  const ordered = [...componentWords, ...labelWords, ...rawWords]
  return [...new Set(ordered)].slice(0, 24)
}

// ─── Service root discovery ────────────────────────────────────────────────────

function expandToServiceRoots(dir, depth = 0) {
  const name = path.basename(dir)
  if (SKIP_DIRS.has(name)) return []
  try {
    const files = fs.readdirSync(dir)
    if (files.includes('pom.xml') || files.includes('package.json') || files.includes('src')) return [dir]
    if (depth >= 3) return [dir]
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .flatMap(e => expandToServiceRoots(path.join(dir, e.name), depth + 1))
  } catch { return [] }
}

// ─── File scoring ──────────────────────────────────────────────────────────────

function scoreFile(filePath, keywords, componentWords, reposBaseDir) {
  const lower = filePath.toLowerCase()
  const rel = filePath.replace(reposBaseDir + '/', '')
  let score = 0

  // All keywords contribute — but component words are weighted 3x
  for (const kw of keywords) { if (lower.includes(kw)) score += 1 }
  for (const cw of componentWords) { if (lower.includes(cw)) score += 3 }

  // Service-layer files are more relevant for QA analysis
  if (/service|controller|handler|usecase|facade|gateway|api/i.test(lower)) score += 2
  // Penalise test files and config
  if (/test|spec|mock/i.test(lower)) score -= 4
  if (/config|properties|yaml|yml|xml/i.test(lower)) score -= 1

  // Boost files whose parent module path matches component words
  const modulePart = rel.split('/')[0] || ''
  for (const cw of componentWords) { if (modulePart.toLowerCase().includes(cw)) score += 4 }

  return score
}

// ─── Contextual grep snippet ───────────────────────────────────────────────────

function expandHitLines(lines, pattern, contextLines) {
  const hitLines = new Set()
  lines.forEach((line, i) => {
    if (pattern.test(line)) {
      for (let j = Math.max(0, i - contextLines); j <= Math.min(lines.length - 1, i + contextLines); j++) {
        hitLines.add(j)
      }
    }
  })
  return hitLines
}

function groupContiguousBlocks(sorted) {
  const parts = []
  let block = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      block.push(sorted[i])
    } else {
      parts.push(block)
      block = [sorted[i]]
    }
  }
  parts.push(block)
  return parts
}

function contextualSnippet(filePath, keywords, contextLines = 8) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const pattern = new RegExp(keywords.slice(0, 10).join('|'), 'i')
    const hitLines = expandHitLines(lines, pattern, contextLines)
    if (hitLines.size === 0) return lines.slice(0, 50).join('\n')
    const sorted = [...hitLines].sort((a, b) => a - b)
    return groupContiguousBlocks(sorted)
      .map(b => b.map(i => lines[i]).join('\n'))
      .join('\n// ...\n')
  } catch { return '' }
}

// ─── Main search ──────────────────────────────────────────────────────────────

async function findRelevantCode(keywords, reposBaseDir, { components = [] } = {}) {
  if (!keywords.length || !reposBaseDir) return ''

  let searchRoots = expandToServiceRoots(reposBaseDir)
  if (!searchRoots.length) searchRoots = [reposBaseDir]

  // Component words for scoring (already extracted from caller)
  const componentWords = components
    .flatMap(c => c.replace(/[^a-zA-Z0-9\s\-_]/g, ' ').split(/[\s\-_]+/).flatMap(splitCamelCase))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))

  // Learned patterns boost: identify repos that historically appear with these keywords
  const learnedMods = learnedModulesFor(keywords)

  // Build roots list — learned-pattern modules first (if they exist on disk)
  const priorityRoots = []
  for (const mod of learnedMods.slice(0, 3)) {
    const candidate = path.join(reposBaseDir, mod)
    if (fs.existsSync(candidate)) priorityRoots.push(candidate)
  }
  const remainingRoots = searchRoots.filter(r => !priorityRoots.includes(r))
  const orderedRoots = [...priorityRoots, ...remainingRoots]

  const grepPattern = keywords.slice(0, 12).join('|')
  let candidateFiles = []

  for (const root of orderedRoots) {
    try {
      const result = execSync(
        `grep -rlE --include="*.java" --include="*.kt" --include="*.ts" --include="*.tsx" ` +
        `"${grepPattern}" "${root}" ` +
        `--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=target --exclude-dir=build --exclude-dir=dist ` +
        `2>/dev/null | head -20`,
        { encoding: 'utf-8', timeout: 8000, shell: '/bin/bash' }
      ).trim()
      if (result) {
        for (const f of result.split('\n').filter(Boolean)) {
          if (!candidateFiles.includes(f)) candidateFiles.push(f)
        }
      }
    } catch {}
  }

  if (!candidateFiles.length) return ''

  const scored = candidateFiles
    .map(f => ({ f, score: scoreFile(f, keywords, componentWords, reposBaseDir) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.f)

  const snippets = []
  for (const filePath of scored) {
    const snippet = contextualSnippet(filePath, keywords)
    if (!snippet) continue
    const rel = filePath.replace(reposBaseDir + '/', '')
    snippets.push(`// ${rel}\n${snippet}`)
  }

  if (!snippets.length) return ''
  console.log(`[codeSearch] ${scored.length} files, keywords: ${keywords.join(', ')}, componentWords: ${componentWords.join(', ')}`)
  return snippets.join('\n\n---\n\n')
}

module.exports = { expandToServiceRoots, extractKeywords, findRelevantCode, learnFromDiff }
