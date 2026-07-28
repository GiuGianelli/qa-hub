import React, { useState, useEffect, useRef } from 'react'

const ALL_FAMILIES = ['dae', 'bac', 'over']

export default function FeatureWriterScreen({ onBack }) {
  const [selectedFamilies, setSelectedFamilies] = useState([...ALL_FAMILIES])
  const [running, setRunning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [creatingSentinels, setCreatingSentinels] = useState(false)
  const [output, setOutput] = useState('')
  const [lastRunSuccess, setLastRunSuccess] = useState(null)
  const outputRef = useRef(null)

  useEffect(() => {
    if (!window.api) return
    window.api.onFeatureWriterOutput((data) => setOutput(prev => prev + data))
    return () => window.api.offFeatureWriterOutput()
  }, [])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  function toggleFamily(fam) {
    setSelectedFamilies(prev =>
      prev.includes(fam) ? prev.filter(f => f !== fam) : [...prev, fam]
    )
  }

  async function handleRun() {
    if (running || !selectedFamilies.length) return
    setOutput('')
    setLastRunSuccess(null)
    setRunning(true)
    const result = await window.api?.featureWriterRun({ families: selectedFamilies })
    setRunning(false)
    setLastRunSuccess(result?.success ?? false)
  }

  async function handleCreateBucket() {
    if (running || syncing) return
    setOutput(prev => prev + '\nCreating S3 bucket...\n')
    await window.api?.featureWriterCreateBucket()
  }

  async function handleSync() {
    if (syncing || running) return
    setSyncing(true)
    setOutput(prev => prev + '\nSyncing to S3...\n')
    await window.api?.featureWriterSyncS3({})
    setSyncing(false)
  }

  async function handleCreateSentinels() {
    if (creatingSentinels || running || !selectedFamilies.length) return
    setCreatingSentinels(true)
    await window.api?.featureWriterCreateSentinels({ families: selectedFamilies })
    setCreatingSentinels(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, padding: 16, display: 'flex', gap: 16, minHeight: 0 }}>

        {/* Left: controls */}
        <div className="panel" style={{ width: 280, flexShrink: 0 }}>
          <h2>Feature Writer</h2>
          <p style={{ fontSize: 12, color: '#7f8fb5', marginBottom: 16 }}>
            Generates JSONL feature records with randomized IDs in a Hive-style partition structure.
          </p>

          <label style={{ marginBottom: 8, display: 'block' }}>Feature Families</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {ALL_FAMILIES.map(fam => (
              <label key={fam} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selectedFamilies.includes(fam)}
                  onChange={() => toggleFamily(fam)}
                  style={{ accentColor: '#e94560' }}
                />
                <span style={{ fontFamily: 'monospace', color: '#c0c8d8' }}>{fam}</span>
                {fam === 'over' && (
                  <span style={{ fontSize: 10, color: '#7f8fb5' }}>(oversized)</span>
                )}
              </label>
            ))}
          </div>

          <button
            onClick={handleRun}
            disabled={running || !selectedFamilies.length}
            style={{ width: '100%', marginBottom: 8 }}
          >
            {running ? 'Running...' : 'Run Feature Writer'}
          </button>

          {lastRunSuccess === true && (
            <p style={{ fontSize: 11, color: '#3ecf8e', marginBottom: 12 }}>✓ Features generated successfully</p>
          )}
          {lastRunSuccess === false && (
            <p style={{ fontSize: 11, color: '#e94560', marginBottom: 12 }}>✗ Script exited with error — see output</p>
          )}

          <div style={{ borderTop: '1px solid #0f3460', paddingTop: 14, marginTop: 4 }}>
            <p style={{ fontSize: 11, color: '#7f8fb5', marginBottom: 10 }}>
              S3 Persistence (LocalStack)
            </p>
            <button
              className="secondary"
              onClick={handleCreateBucket}
              disabled={running || syncing}
              style={{ width: '100%', marginBottom: 8, fontSize: 12 }}
            >
              Create S3 Bucket
            </button>
            <button
              className="secondary"
              onClick={handleSync}
              disabled={running || syncing || creatingSentinels}
              style={{ width: '100%', fontSize: 12 }}
            >
              {syncing ? 'Syncing...' : 'Sync to S3'}
            </button>
            <button
              className="secondary"
              onClick={handleCreateSentinels}
              disabled={running || syncing || creatingSentinels || !selectedFamilies.length}
              style={{ width: '100%', fontSize: 12, marginTop: 8 }}
            >
              {creatingSentinels ? 'Creating...' : 'Create Sentinel Files'}
            </button>
            <p style={{ fontSize: 10, color: '#4a5a7a', marginTop: 8 }}>
              Endpoint: http://localhost:14566
            </p>
          </div>
        </div>

        {/* Right: output */}
        <div className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <h2>Output</h2>
          {!output && (
            <p style={{ fontSize: 12, color: '#4a5a7a' }}>Run the script to see output here.</p>
          )}
          {output && (
            <pre ref={outputRef} style={{
              flex: 1, background: '#0a0a1a', border: '1px solid #0f3460',
              borderRadius: 4, padding: '10px 12px', fontSize: 11,
              overflowY: 'auto', color: '#7fcfaf', whiteSpace: 'pre-wrap', margin: 0,
            }}>
              {output}
            </pre>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid #0f3460' }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
      </div>
    </div>
  )
}
