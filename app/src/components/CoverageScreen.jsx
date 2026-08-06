import React, { useState, useEffect } from 'react'

const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'found',      label: '✅ Found in code' },
  { key: 'gap',        label: '❌ Gap (automated, not found)' },
  { key: 'not_found',  label: 'Not found' },
  { key: 'deprecated', label: '🚫 Deprecated' },
]


function StatusBadge({ status, automatedStatus }) {
  if (status?.toLowerCase() === 'deprecated') {
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
        background: '#44444422', color: '#666', border: '1px solid #44444444',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>Deprecated</span>
    )
  }
  if (!automatedStatus) return <span style={{ color: '#4a5a7a', fontSize: 10 }}>—</span>
  const isAuto = automatedStatus === 'Automated'
  const isCandidate = automatedStatus === 'Candidate for Automation'
  const color = isAuto ? '#3ecf8e' : isCandidate ? '#e8c07f' : '#4a5a7a'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
      background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {isAuto ? 'Automated' : isCandidate ? 'Candidate' : 'Manual'}
    </span>
  )
}

function CodeBadge({ found }) {
  if (found === null) return <span style={{ color: '#4a5a7a', fontSize: 10 }}>—</span>
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: found ? '#3ecf8e' : '#e94560',
    }}>
      {found ? '✅' : '❌'}
    </span>
  )
}

function SummaryBar({ testCases, scanKeys }) {
  const deprecated = testCases.filter(tc => tc.status?.toLowerCase() === 'deprecated')
  const active = testCases.filter(tc => tc.status?.toLowerCase() !== 'deprecated')
  const total = active.length
  const automated = active.filter(tc => tc.automatedStatus === 'Automated')
  const found = active.filter(tc => scanKeys[tc.key])
  const gap = automated.filter(tc => !scanKeys[tc.key])
  const pct = total > 0 ? Math.round((found.length / total) * 100) : 0

  return (
    <div style={{ marginBottom: 16 }}>
      {deprecated.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: '#1a1a1a', border: '1px solid #333',
          borderRadius: 4, marginBottom: 8, fontSize: 11, color: '#666',
        }}>
          <span style={{ fontSize: 13 }}>🚫</span>
          <span><strong style={{ color: '#888' }}>{deprecated.length}</strong> deprecated test{deprecated.length !== 1 ? 's' : ''} excluded from coverage calculation</span>
        </div>
      )}
      <div style={{
        display: 'flex', gap: 24, padding: '10px 16px', background: '#0f1e3a',
        borderRadius: 6, flexWrap: 'wrap',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0' }}>{total}</div>
          <div style={{ fontSize: 10, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active TCs</div>
        </div>
        <div style={{ width: 1, background: '#0f3460', alignSelf: 'stretch' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3ecf8e' }}>{found.length}</div>
          <div style={{ fontSize: 10, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Found in code</div>
        </div>
        <div style={{ width: 1, background: '#0f3460', alignSelf: 'stretch' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0' }}>{pct}%</div>
          <div style={{ fontSize: 10, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coverage</div>
        </div>
        <div style={{ width: 1, background: '#0f3460', alignSelf: 'stretch' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3ecf8e' }}>{automated.length}</div>
          <div style={{ fontSize: 10, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Marked Automated</div>
        </div>
        <div style={{ width: 1, background: '#0f3460', alignSelf: 'stretch' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: gap.length > 0 ? '#e94560' : '#3ecf8e' }}>{gap.length}</div>
          <div style={{ fontSize: 10, color: '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gap (auto, no code)</div>
        </div>

        {/* progress bar */}
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ height: 6, background: '#0f3460', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct >= 80 ? '#3ecf8e' : pct >= 50 ? '#e8c07f' : '#e94560',
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#4a5a7a' }}>{pct}% of active test cases traced to code</div>
        </div>
      </div>
    </div>
  )
}

export default function CoverageScreen({ onBack }) {
  const [folders, setFolders] = useState([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState('')
  const [folderInput, setFolderInput] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(null) // { id, name }
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [step, setStep] = useState('idle') // idle | loading | done | error
  const [loadingZephyr, setLoadingZephyr] = useState(false)
  const [loadingScan, setLoadingScan] = useState(false)
  const [testCases, setTestCases] = useState([])
  const [scanKeys, setScanKeys] = useState({})
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  // Load folders on mount
  useEffect(() => {
    setFoldersLoading(true)
    window.api?.getZephyrFoldersForCoverage().then(res => {
      setFoldersLoading(false)
      if (res?.error) { setFoldersError(res.error); return }
      setFolders(res.folders || [])
    })
  }, [])

  // Filtered suggestions based on typed text
  const suggestions = folderInput.trim().length >= 1
    ? folders.filter(f => f.name.toLowerCase().includes(folderInput.toLowerCase())).slice(0, 10)
    : []

  function selectFolder(f) {
    setSelectedFolder(f)
    setFolderInput(f.name)
    setShowSuggestions(false)
  }

  function clearFolder() {
    setSelectedFolder(null)
    setFolderInput('')
  }

  // collect the selected folder + all its descendants
  function getDescendantIds(folderId) {
    if (!folderId) return []
    const ids = [folderId]
    const children = folders.filter(f => f.parentId === folderId)
    for (const c of children) ids.push(...getDescendantIds(c.id))
    return ids
  }

  async function analyze() {
    setStep('loading')
    setError('')
    setLoadingZephyr(true)
    setLoadingScan(true)

    // fetch TCs for the selected folder + all subfolders in parallel
    const folderIds = selectedFolder ? getDescendantIds(selectedFolder.id) : [undefined]

    const [zephyrResults, scanRes] = await Promise.all([
      Promise.all(folderIds.map(fid => window.api?.getFolderTestCases({ folderId: fid }))),
      window.api?.scanRepoKeys(),
    ])

    // merge & deduplicate by key
    const seenKeys = new Set()
    const allTCs = []
    for (const res of zephyrResults) {
      if (res?.error) { setError(res.error); setStep('error'); setLoadingZephyr(false); setLoadingScan(false); return }
      for (const tc of res?.testCases || []) {
        if (!seenKeys.has(tc.key)) { seenKeys.add(tc.key); allTCs.push(tc) }
      }
    }

    const zephyrRes = { testCases: allTCs }

    setLoadingZephyr(false)
    setLoadingScan(false)

    if (scanRes?.error) { setError(scanRes.error); setStep('error'); return }

    setTestCases(zephyrRes.testCases || [])
    setScanKeys(scanRes.keys || {})
    setStep('done')
    setActiveTab('all')
  }

  async function rescan() {
    await window.api?.clearScanCache()
    setScanKeys({})
    setTestCases([])
    setStep('idle')
  }

  // filter logic
  const filtered = testCases.filter(tc => {
    const inCode = !!scanKeys[tc.key]
    const isAuto = tc.automatedStatus === 'Automated'
    const isDeprecated = tc.status?.toLowerCase() === 'deprecated'
    const matchesSearch = search
      ? tc.key.toLowerCase().includes(search.toLowerCase()) || tc.name.toLowerCase().includes(search.toLowerCase())
      : true
    if (!matchesSearch) return false
    if (activeTab === 'deprecated') return isDeprecated
    if (isDeprecated) return activeTab === 'all'
    if (activeTab === 'found') return inCode
    if (activeTab === 'gap') return isAuto && !inCode
    if (activeTab === 'not_found') return !inCode
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #0f3460', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Coverage Analysis</h1>
          <span style={{ fontSize: 11, color: '#4a5a7a' }}>Zephyr test cases × automated tests in code</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Config panel */}
        <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7f8fb5', display: 'block', marginBottom: 6 }}>
              Folder {foldersLoading ? <span style={{ fontWeight: 400, color: '#4a5a7a' }}>— loading...</span> : <span style={{ fontWeight: 400, color: '#4a5a7a' }}>— type to filter</span>}
            </label>
            {foldersError && <div style={{ fontSize: 11, color: '#e94560', marginBottom: 4 }}>{foldersError}</div>}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  placeholder={foldersLoading ? 'Loading folders...' : 'Type folder name, or leave empty for all TCs'}
                  value={folderInput}
                  onChange={e => { setFolderInput(e.target.value); setSelectedFolder(null); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  disabled={step === 'loading' || foldersLoading}
                  style={{ width: '100%', marginBottom: 0, boxSizing: 'border-box',
                    borderColor: selectedFolder ? '#3ecf8e55' : undefined }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#16213e', border: '1px solid #0f3460', borderRadius: 4,
                    zIndex: 100, maxHeight: 220, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    {suggestions.map(f => (
                      <button
                        key={f.id}
                        onMouseDown={() => selectFolder(f)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 10px', fontSize: 12, color: '#c0c8d8',
                          cursor: 'pointer', borderBottom: '1px solid #0a1628',
                          background: 'transparent', border: 'none', borderRadius: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f3460'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {f.name}
                        <span style={{ fontSize: 10, color: '#4a5a7a', marginLeft: 8 }}>#{f.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedFolder && (
                <button className="secondary" style={{ fontSize: 11, padding: '4px 8px', flexShrink: 0 }} onClick={clearFolder}>✕</button>
              )}
            </div>
            {selectedFolder && (
              <div style={{ fontSize: 10, color: '#3ecf8e', marginTop: 4 }}>
                ✓ {selectedFolder.name} <span style={{ color: '#4a5a7a' }}>#{selectedFolder.id}</span>
              </div>
            )}
            {!selectedFolder && !folderInput && (
              <div style={{ fontSize: 10, color: '#4a5a7a', marginTop: 4 }}>Leave empty to fetch all test cases</div>
            )}
          </div>
          <button
            onClick={analyze}
            disabled={step === 'loading'}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {step === 'loading' ? 'Analyzing...' : '⎋ Analyze'}
          </button>
        </div>

        {/* Loading state */}
        {step === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', marginBottom: 16 }}>
            <LoadingRow label="Fetching test cases from Zephyr" done={!loadingZephyr} />
            <LoadingRow label="Scanning repos for DEV-T references" done={!loadingScan} />
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: '#e94560', margin: 0 }}>{error}</p>}

        {/* Results */}
        {step === 'done' && (
          <>
            <SummaryBar testCases={testCases} scanKeys={scanKeys} />

            {/* Tabs + search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {TABS.map(t => (
                  <button
                    key={t.key}
                    className={activeTab === t.key ? '' : 'secondary'}
                    style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                placeholder="Search by key or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: 0, flex: 1, minWidth: 180, fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: '#4a5a7a', whiteSpace: 'nowrap' }}>{filtered.length} shown</span>
            </div>

            {/* Table */}
            <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 6, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 90px 60px 1fr',
                gap: 0, padding: '6px 12px',
                background: '#0f1e3a', borderBottom: '1px solid #0f3460',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: '#4a5a7a',
              }}>
                <span>Key</span>
                <span>Name</span>
                <span>Zephyr Status</span>
                <span>In code</span>
                <span>File reference</span>
              </div>

              {/* Rows */}
              {filtered.length === 0 && (
                <div style={{ padding: '20px 12px', fontSize: 12, color: '#4a5a7a', textAlign: 'center' }}>
                  No test cases match this filter.
                </div>
              )}
              {filtered.map((tc, i) => {
                const codeHit = scanKeys[tc.key]
                const isDeprecated = tc.status?.toLowerCase() === 'deprecated'
                const isGap = !isDeprecated && tc.automatedStatus === 'Automated' && !codeHit
                let rowBg = 'transparent'
                if (isDeprecated) rowBg = '#111'
                else if (isGap) rowBg = '#2a0a0a'
                const textColor = isDeprecated ? '#555' : '#c0c8d8'
                const keyColor = isDeprecated ? '#555' : '#e94560'
                let codeBadgeFound = null
                if (!isDeprecated && codeHit) codeBadgeFound = true
                const firstFile = !isDeprecated && codeHit?.files?.[0]
                let fileLabel = '—'
                if (firstFile) {
                  const extra = codeHit.files.length > 1 ? ` +${codeHit.files.length - 1}` : ''
                  fileLabel = truncatePath(codeHit.files[0]) + extra
                }
                return (
                  <div key={tc.key} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 90px 60px 1fr',
                    gap: 0, padding: '7px 12px',
                    borderBottom: i < filtered.length - 1 ? '1px solid #0a1628' : 'none',
                    background: rowBg,
                    alignItems: 'center',
                    opacity: isDeprecated ? 0.6 : 1,
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: keyColor, fontWeight: 700 }}>
                      {tc.key}
                    </span>
                    <span style={{ fontSize: 11, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} title={tc.name}>
                      {tc.name || '—'}
                    </span>
                    <StatusBadge status={tc.status} automatedStatus={tc.automatedStatus} />
                    <CodeBadge found={codeBadgeFound} />
                    <span style={{ fontSize: 10, color: '#4a6a8a', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={codeHit?.files?.[0] || ''}>
                      {fileLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #0f3460', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
        {step === 'done' && (
          <button className="secondary" onClick={rescan}>↺ Re-scan repos</button>
        )}
      </div>
    </div>
  )
}

function LoadingRow({ label, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        background: done ? '#3ecf8e' : '#e94560',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: '#fff', fontWeight: 700,
      }}>
        {done ? '✓' : '·'}
      </div>
      <span style={{ fontSize: 12, color: done ? '#3ecf8e' : '#7f8fb5' }}>{label}</span>
      {!done && <span style={{ fontSize: 11, color: '#4a5a7a' }}>running...</span>}
    </div>
  )
}

function truncatePath(path) {
  const parts = path.split('/')
  if (parts.length <= 4) return path
  return `.../${parts.slice(-3).join('/')}`
}
