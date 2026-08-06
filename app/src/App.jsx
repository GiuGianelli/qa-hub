import React, { useState, useEffect, useRef } from 'react'
import Menu from './components/Menu'
import IssueInfo from './components/IssueInfo'
import ConfigNotes from './components/ConfigNotes'
import QaNotes from './components/QaNotes'
import PossibleImpacts from './components/PossibleImpacts'
import TestCases from './components/TestCases'
import AISessionScreen from './components/AISessionScreen'
import ImportSessionScreen from './components/ImportSessionScreen'
import CoverageScreen from './components/CoverageScreen'
import SavedSessionsScreen from './components/SavedSessionsScreen'
import FeatureWriterScreen from './components/FeatureWriterScreen'
import MetricsScreen from './components/MetricsScreen'

const EMPTY_STATE = {
  issueInfo: { issue: '', dev: '', qa: '' },
  configNotes: [],
  qaNotes: [],
  impacts: [],
  cases: [],
}

function CycleModal({ importedKeys, onClose, inline, defaultIssueKey = '', sessionData = null }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const today = new Date().toLocaleDateString('en-CA')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [done, setDone] = useState(false)
  const [createdCycleKey, setCreatedCycleKey] = useState('')
  const [issueInput, setIssueInput] = useState(defaultIssueKey)
  const [linking, setLinking] = useState(false)
  const [keys, setKeys] = useState([...importedKeys])
  const [addInput, setAddInput] = useState('')
  const [folders, setFolders] = useState([])
  const [folderId, setFolderId] = useState('')

  useEffect(() => {
    window.api?.getFolders({ folderType: 'TEST_CYCLE' }).then(f => setFolders(f || []))
  }, [])

  useEffect(() => {
    if (!defaultIssueKey) return
    const issueKey = defaultIssueKey.split('/').pop()
    window.api?.fetchIssueSummary({ issueKey }).then(res => {
      if (res?.summary) setName(res.summary)
      else setName(issueKey)
    })
  }, [defaultIssueKey])

  useEffect(() => {
    setKeys(prev => {
      const next = [...prev]
      for (const k of importedKeys) if (!next.includes(k)) next.push(k)
      return next
    })
  }, [importedKeys])
  const outputRef = useRef(null)

  useEffect(() => {
    if (!window.api) return
    window.api.onCycleOutput((data) => setOutput(prev => prev + data))
    return () => window.api.offCycleOutput()
  }, [])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  function addKey() {
    const id = addInput.trim().toUpperCase()
    if (!id || keys.includes(id)) return
    setKeys(prev => [...prev, id])
    setAddInput('')
  }

  function removeKey(k) {
    setKeys(prev => prev.filter(x => x !== k))
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter') addKey()
  }

  async function create() {
    if (!name.trim() || running || keys.length === 0) return
    setOutput('')
    setRunning(true)
    const result = await window.api?.createCycle({
      cycleName: name.trim(),
      description: description.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      testCaseKeys: keys,
      folderId: folderId ? Number(folderId) : undefined,
    })
    setRunning(false)
    setDone(true)
    if (result?.cycleKey) setCreatedCycleKey(result.cycleKey)
  }

  async function linkToIssue() {
    const key = issueInput.trim().toUpperCase()
    if (!key || !createdCycleKey || linking) return
    setLinking(true)
    setOutput(prev => prev + `\nLinking ${createdCycleKey} to ${key}...`)
    try {
      const result = await window.api?.linkCycleToIssue({ cycleKey: createdCycleKey, issueKey: key })
      if (result?.error) {
        setOutput(prev => prev + `\nERROR: ${result.error}`)
      } else {
        setOutput(prev => prev + `\nOK: ${createdCycleKey} linked to ${key}`)
        setIssueInput('')
      }
    } catch (e) {
      setOutput(prev => prev + `\nERROR: ${e.message}`)
    } finally {
      setLinking(false)
    }
  }

  const inner = (
      <div style={{
        background: '#16213e', border: inline ? 'none' : '1px solid #0f3460', borderRadius: inline ? 0 : 8,
        padding: 24, width: inline ? '100%' : 460, display: 'flex', flexDirection: 'column', gap: 0,
        maxHeight: inline ? '100%' : '90vh', overflowY: 'auto', flex: inline ? 1 : undefined,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', marginBottom: 16, paddingBottom: 0, border: 'none', textTransform: 'none', letterSpacing: 0 }}>
          Create Test Cycle
        </h2>

        <label style={{ marginBottom: 4 }}>Test Cases ({keys.length})</label>
        <div style={{
          background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: 4,
          maxHeight: 130, overflowY: 'auto', marginBottom: 8,
        }}>
          {keys.length === 0 && (
            <p style={{ margin: 0, padding: '8px 10px', fontSize: 11, color: '#7f8fb5' }}>No test cases. Add by ID below.</p>
          )}
          {keys.map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #1a4a7a' }}>
              <span style={{ flex: 1, fontSize: 12, color: '#c0c8d8', fontFamily: 'monospace' }}>{k}</span>
              {!running && !done && (
                <button className="secondary" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => removeKey(k)}>✕</button>
              )}
            </div>
          ))}
        </div>
        {!running && !done && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              placeholder="Add by ID, e.g. DEV-T12345"
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={handleAddKeyDown}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button className="secondary" style={{ whiteSpace: 'nowrap' }} onClick={addKey} disabled={!addInput.trim()}>Add</button>
          </div>
        )}

        <label>Cycle Name *</label>
        <input
          placeholder="e.g. Sprint 42 – Risk Engine"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={running || done}
        />

        <label>Description</label>
        <input
          placeholder="Optional"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={running || done}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={running || done} />
          </div>
          <div>
            <label>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={running || done} />
          </div>
        </div>

        {folders.length > 0 && (
          <>
            <label>Folder</label>
            <select value={folderId} onChange={e => setFolderId(e.target.value)} disabled={running || done}>
              <option value=''>None</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </>
        )}

        {output && (
          <pre ref={outputRef} style={{
            marginTop: 12, background: '#0a0a1a', border: '1px solid #0f3460',
            borderRadius: 4, padding: 8, fontSize: 11, overflowY: 'auto',
            maxHeight: 140, color: '#7fcfaf', whiteSpace: 'pre-wrap',
          }}>
            {output}
          </pre>
        )}

        {done && createdCycleKey && (
          <div style={{ marginTop: 14, borderTop: '1px solid #0f3460', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label htmlFor="cycle-link-issue" style={{ margin: 0 }}>Link Cycle to Jira Issue</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3ecf8e', fontFamily: 'monospace' }}>{createdCycleKey}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="cycle-link-issue"
                placeholder="e.g. DEV-12345"
                value={issueInput}
                onChange={e => setIssueInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && linkToIssue()}
                style={{ marginBottom: 0 }}
              />
              <button
                className="secondary"
                style={{ whiteSpace: 'nowrap', minWidth: 52 }}
                onClick={linkToIssue}
                disabled={!issueInput.trim() || linking}
              >
                {linking ? '...' : 'Link'}
              </button>
            </div>
          </div>
        )}

        {!inline && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="secondary" onClick={() => onClose(done)}>{done ? 'Close' : 'Cancel'}</button>
            {done && createdCycleKey && (
              <button
                onClick={() => sessionData
                  ? window.api?.generateFullReport({ ...sessionData, cycleKey: createdCycleKey })
                  : window.api?.generateCycleReport({ cycleKey: createdCycleKey })}
              >
                {sessionData ? 'Full Report' : 'Generate Report'}
              </button>
            )}
            {!done && (
              <button onClick={create} disabled={!name.trim() || running || keys.length === 0}>
                {running ? 'Creating...' : 'Create'}
              </button>
            )}
          </div>
        )}
        {inline && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            {done && <button className="secondary" onClick={() => { setDone(false); setCreatedCycleKey(''); setIssueInput('') }}>New Cycle</button>}
            {done && createdCycleKey && (
              <button
                onClick={() => sessionData
                  ? window.api?.generateFullReport({ ...sessionData, cycleKey: createdCycleKey })
                  : window.api?.generateCycleReport({ cycleKey: createdCycleKey })}
              >
                {sessionData ? 'Full Report' : 'Generate Report'}
              </button>
            )}
            {!done && (
              <button onClick={create} disabled={!name.trim() || running || keys.length === 0}>
                {running ? 'Creating...' : 'Create Cycle'}
              </button>
            )}
          </div>
        )}
      </div>
  )

  if (inline) return inner

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      {inner}
    </div>
  )
}

const TEXTAREA_STYLE = { width: '100%', boxSizing: 'border-box', background: '#0f1e3a', border: '1px solid #1a4a7a', borderRadius: 4, color: '#c0c8d8', fontSize: 12, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }

function BugField({ label, value, onChange, rows = 3, disabled }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: '#7f8fb5', marginBottom: 4, display: 'block' }}>{label}</label>
      {rows === 1
        ? <input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ width: '100%', boxSizing: 'border-box' }} />
        : <textarea value={value} onChange={e => onChange(e.target.value)} disabled={disabled} rows={rows} style={TEXTAREA_STYLE} />
      }
    </div>
  )
}

function CreateBugModal({ execution, cycleKey, onClose }) {
  const [step, setStep] = useState('prompt')  // 'prompt' | 'generating' | 'review' | 'creating' | 'done'
  const [whatWentWrong, setWhatWentWrong] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [expectedResult, setExpectedResult] = useState('')
  const [parentKey, setParentKey] = useState('')
  const [createdKey, setCreatedKey] = useState('')
  const [error, setError] = useState('')
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')

  useEffect(() => {
    window.api?.readEnv().then(env => setJiraBaseUrl(env?.jiraBaseUrl || ''))
  }, [])

  async function generate() {
    if (!whatWentWrong.trim()) return
    setStep('generating')
    setError('')
    const res = await window.api?.aiGenerateBug({
      testCaseKey: execution.testCaseKey,
      testCaseName: execution.testCaseName || execution.testCaseKey,
      cycleKey,
      whatWentWrong: whatWentWrong.trim(),
    })
    if (res?.error) { setError(res.error); setStep('prompt'); return }
    setSummary(res.summary || '')
    setDescription(res.description || '')
    setStepsToReproduce(res.stepsToReproduce || '')
    setExpectedResult(res.expectedResult || '')
    setStep('review')
  }

  async function create() {
    if (!summary.trim() || step === 'creating' || !parentKey.trim()) return
    setStep('creating')
    setError('')
    const res = await window.api?.createJiraBug({
      summary: summary.trim(),
      description: description.trim(),
      stepsToReproduce: stepsToReproduce.trim(),
      expectedResult: expectedResult.trim(),
      testCaseKey: execution.testCaseKey,
      cycleKey,
      type: 'subtask',
      parentKey: parentKey.trim().toUpperCase(),
    })
    if (res?.error) { setError(res.error); setStep('review'); return }
    setCreatedKey(res.key)
    setStep('done')
  }

  function openInJira() {
    if (!jiraBaseUrl || !createdKey) return
    window.api?.openExternal(jiraBaseUrl.replace(/\/$/, '') + '/browse/' + createdKey)
  }

  const isReviewing = step === 'review' || step === 'creating'
  const disabled = step === 'creating'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', flex: 1 }}>🐞 Create Bug</span>
          <button className="secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>

        {/* Test case badge */}
        <div style={{ fontSize: 11, color: '#7f8fb5' }}>
          Failed: <span style={{ color: '#e94560', fontFamily: 'monospace', fontWeight: 700 }}>{execution.testCaseKey}</span>
          {execution.testCaseName && execution.testCaseName !== execution.testCaseKey && (
            <span style={{ color: '#c0c8d8' }}> — {execution.testCaseName}</span>
          )}
        </div>

        {/* Step 1: prompt */}
        {step === 'prompt' && (
          <>
            <div>
              <label style={{ fontSize: 10, color: '#7f8fb5', marginBottom: 4, display: 'block' }}>What went wrong? *</label>
              <textarea
                autoFocus
                value={whatWentWrong}
                onChange={e => setWhatWentWrong(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.metaKey && generate()}
                placeholder="Describe what you observed — e.g. 'The response returned 500 when the fingerprint was bad and a valid ARN was provided as fallback'"
                rows={4}
                style={TEXTAREA_STYLE}
              />
              <p style={{ fontSize: 10, color: '#4a5a7a', margin: '4px 0 0' }}>⌘ Enter to generate</p>
            </div>
            {error && <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="secondary" onClick={onClose}>Cancel</button>
              <button onClick={generate} disabled={!whatWentWrong.trim()}>Generate ✨</button>
            </div>
          </>
        )}

        {/* Generating */}
        {step === 'generating' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: '#7fb3e8' }}>✨ Generating bug report with AI...</span>
          </div>
        )}

        {/* Step 2: review & create */}
        {isReviewing && (
          <>
            <BugField label="Summary *" value={summary} onChange={setSummary} rows={1} disabled={disabled} />
            <BugField label="Description" value={description} onChange={setDescription} rows={3} disabled={disabled} />
            <BugField label="Steps to Reproduce" value={stepsToReproduce} onChange={setStepsToReproduce} rows={4} disabled={disabled} />
            <BugField label="Expected Result" value={expectedResult} onChange={setExpectedResult} rows={2} disabled={disabled} />

            <BugField label="Parent Issue Key *" value={parentKey} onChange={setParentKey} rows={1} disabled={disabled} />

            {error && <p style={{ fontSize: 11, color: '#e94560', margin: 0 }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="secondary" onClick={() => { setStep('prompt'); setError('') }} disabled={disabled}>← Back</button>
              <button onClick={create} disabled={!summary.trim() || disabled || !parentKey.trim()}>
                {step === 'creating' ? 'Creating...' : 'Create Subtask'}
              </button>
            </div>
          </>
        )}

        {/* Done */}
        {step === 'done' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#3ecf8e22', border: '1px solid #3ecf8e44', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: '#3ecf8e', fontWeight: 700 }}>✓ Created:</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#3ecf8e', fontWeight: 700 }}>{createdKey}</span>
              {jiraBaseUrl && (
                <button className="secondary" style={{ fontSize: 10, padding: '2px 8px', marginLeft: 'auto' }} onClick={openInJira}>
                  Open in Jira ↗
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ManageCycleScreen({ onBack }) {
  const [importedKeys, setImportedKeys] = useState([])
  const [cycleInput, setCycleInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cycle, setCycle] = useState(null)
  const [error, setError] = useState('')
  const [addInput, setAddInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [issueInput, setIssueInput] = useState('')
  const [linking, setLinking] = useState(false)
  const [log, setLog] = useState([])
  const [bugExecution, setBugExecution] = useState(null)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  function appendLog(msg) {
    setLog(prev => [...prev, msg])
  }

  async function loadCycle() {
    const key = cycleInput.trim().toUpperCase()
    if (!key) return
    setLoading(true)
    setError('')
    setCycle(null)
    appendLog(`Loading cycle ${key}...`)
    try {
      const result = await window.api?.getCycle({ cycleKey: key })
      if (!result) {
        appendLog('ERROR: No response from API (is the app restarted?)')
        setError('No response — restart the app to reload the backend.')
      } else if (result.error) {
        appendLog(`ERROR: ${result.error}`)
        setError(result.error)
      } else {
        appendLog(`OK: "${result.name}" — ${result.executions.length} test case(s)`)
        setCycle(result)
      }
    } catch (e) {
      appendLog(`ERROR: ${e.message}`)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function addCase() {
    const key = addInput.trim().toUpperCase()
    if (!key || !cycle || adding) return
    setAdding(true)
    appendLog(`Adding ${key} to ${cycle.key}...`)
    try {
      const result = await window.api?.addToCycle({ cycleKey: cycle.key, testCaseKey: key })
      if (result?.error) {
        appendLog(`ERROR: ${result.error}`)
      } else {
        appendLog(`OK: ${key} added`)
        setAddInput('')
        setCycle(prev => ({
          ...prev,
          executions: [...prev.executions, { id: result.id, testCaseKey: key, testCaseName: '', status: 'Not Executed' }],
        }))
      }
    } catch (e) {
      appendLog(`ERROR: ${e.message}`)
    } finally {
      setAdding(false)
    }
  }

  async function updateStatus(execId, tcKey, statusName) {
    setUpdatingId(execId)
    appendLog(`Updating ${tcKey} → ${statusName}...`)
    try {
      const result = await window.api?.updateExecution({ executionId: execId, statusName })
      if (result?.error) {
        appendLog(`ERROR: ${result.error}`)
      } else {
        appendLog(`OK: ${tcKey} → ${statusName}`)
        setCycle(prev => ({
          ...prev,
          executions: prev.executions.map(e => e.id === execId ? { ...e, status: statusName } : e),
        }))
      }
    } catch (e) {
      appendLog(`ERROR: ${e.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  async function linkToIssue() {
    const key = issueInput.trim().toUpperCase()
    if (!key || !cycle || linking) return
    setLinking(true)
    appendLog(`Linking ${cycle.key} to ${key}...`)
    try {
      const result = await window.api?.linkCycleToIssue({ cycleKey: cycle.key, issueKey: key })
      if (result?.error) {
        appendLog(`ERROR: ${result.error}`)
      } else {
        appendLog(`OK: ${cycle.key} linked to ${key}`)
        setIssueInput('')
      }
    } catch (e) {
      appendLog(`ERROR: ${e.message}`)
    } finally {
      setLinking(false)
    }
  }

  async function removeCase(execId, tcKey) {
    setRemovingId(execId)
    appendLog(`Removing ${tcKey}...`)
    try {
      const result = await window.api?.removeExecution({ executionId: execId })
      if (result?.error) {
        appendLog(`ERROR: ${result.error}`)
      } else {
        appendLog(`OK: ${tcKey} removed`)
        setCycle(prev => ({ ...prev, executions: prev.executions.filter(e => e.id !== execId) }))
      }
    } catch (e) {
      appendLog(`ERROR: ${e.message}`)
    } finally {
      setRemovingId(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.target.id === 'cycle-input' ? loadCycle() : addCase()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, padding: 10, display: 'flex', gap: 10, minHeight: 0 }}>

        {/* Left: create cycle */}
        <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
          <CycleModal importedKeys={importedKeys} inline />
        </div>

        {/* Middle: load cycle */}
        <div className="panel" style={{ width: 280, flexShrink: 0 }}>
          <h2>Load Cycle</h2>
          <label>Cycle ID</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="cycle-input"
              placeholder="e.g. DEV-R11313"
              value={cycleInput}
              onChange={e => setCycleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ marginBottom: 0 }}
            />
            <button className="secondary" onClick={loadCycle} disabled={!cycleInput.trim()} style={{ whiteSpace: 'nowrap', minWidth: 52 }}>
              {loading ? '...' : 'Load'}
            </button>
          </div>

          {error && <p style={{ color: '#e94560', fontSize: 11, marginTop: 8 }}>{error}</p>}

          {cycle && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0' }}>{cycle.name}</div>
              <div style={{ fontSize: 11, color: '#7f8fb5' }}>{cycle.key}</div>
              {cycle.folder && <div style={{ fontSize: 11, color: '#7f8fb5' }}>Folder: {cycle.folder}</div>}
              {cycle.plannedStartDate && (
                <div style={{ fontSize: 11, color: '#7f8fb5' }}>
                  {cycle.plannedStartDate.slice(0, 10)} → {cycle.plannedEndDate?.slice(0, 10) || '—'}
                </div>
              )}
              {cycle.description && (
                <div style={{ fontSize: 11, color: '#c0c8d8', marginTop: 4 }}>{cycle.description}</div>
              )}

              <div style={{ marginTop: 12, borderTop: '1px solid #0f3460', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ marginTop: 0, marginBottom: 0 }}>Add Cycle to Jira Issue</label>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3ecf8e', fontFamily: 'monospace' }}>{cycle.key}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    placeholder="e.g. DEV-12345"
                    value={issueInput}
                    onChange={e => setIssueInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && linkToIssue()}
                    style={{ marginBottom: 0 }}
                  />
                  <button
                    className="secondary"
                    style={{ whiteSpace: 'nowrap', minWidth: 52 }}
                    onClick={linkToIssue}
                    disabled={!issueInput.trim() || linking}
                  >
                    {linking ? '...' : 'Link'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, borderTop: '1px solid #0f3460', paddingTop: 12 }}>
                <button
                  className="secondary"
                  style={{ width: '100%' }}
                  onClick={() => window.api?.generateCycleReport({ cycleKey: cycle.key })}
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: executions */}
        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
          <h2>Test Cases {cycle ? `(${cycle.executions.length})` : ''}</h2>

          {!cycle && (
            <p style={{ fontSize: 12, color: '#4a5a7a' }}>Load a cycle to see its test cases.</p>
          )}

          {cycle && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  placeholder="Add by ID, e.g. DEV-T12345"
                  value={addInput}
                  onChange={e => setAddInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ marginBottom: 0 }}
                />
                <button className="secondary" style={{ whiteSpace: 'nowrap' }} onClick={addCase} disabled={!addInput.trim() || adding}>
                  {adding ? '...' : 'Add'}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {cycle.executions.length === 0 && (
                  <p style={{ fontSize: 12, color: '#4a5a7a' }}>No test cases in this cycle.</p>
                )}
                {cycle.executions.map(e => {
                  const isFail = /fail/i.test(e.status)
                  return (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderBottom: '1px solid #0f3460',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e94560', minWidth: 90 }}>{e.testCaseKey}</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#c0c8d8' }}>{e.testCaseName || '—'}</span>
                      <select
                        value={e.status}
                        disabled={updatingId === e.id}
                        onChange={ev => updateStatus(e.id, e.testCaseKey, ev.target.value)}
                        style={{ width: 130, marginBottom: 0, fontSize: 11, padding: '3px 6px' }}
                      >
                        {(cycle.statuses || []).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {!cycle.statuses?.length && <option>{e.status}</option>}
                      </select>
                      {isFail && (
                        <button
                          className="secondary"
                          title="Create bug in Jira"
                          style={{ fontSize: 11, padding: '2px 7px', color: '#e94560', borderColor: '#4a1a1a', flexShrink: 0 }}
                          onClick={() => setBugExecution(e)}
                        >
                          🐞
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <pre ref={logRef} style={{
          margin: '0 10px 8px', background: '#0a0a1a', border: '1px solid #0f3460',
          borderRadius: 4, padding: '6px 10px', fontSize: 11, overflowY: 'auto',
          maxHeight: 72, color: '#7fcfaf', whiteSpace: 'pre-wrap', flexShrink: 0,
        }}>
          {log.join('\n')}
        </pre>
      )}

      <div style={{ padding: '8px 10px', borderTop: '1px solid #0f3460' }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
      </div>

      {bugExecution && (
        <CreateBugModal
          execution={bugExecution}
          cycleKey={cycle?.key}
          onClose={() => setBugExecution(null)}
        />
      )}
    </div>
  )
}

function CreateTestCaseScreen({ onBack }) {
  const [cases, setCases] = useState([])
  const [importedKeys, setImportedKeys] = useState([])
  const [importOutput, setImportOutput] = useState('')
  const [importing, setImporting] = useState(false)
  const [showAddToCycleModal, setShowAddToCycleModal] = useState(false)
  const importOutputRef = useRef(null)

  useEffect(() => {
    if (importOutputRef.current) importOutputRef.current.scrollTop = importOutputRef.current.scrollHeight
  }, [importOutput])

  useEffect(() => {
    if (!window.api) return
    window.api.onImportOutput((data) => setImportOutput(prev => prev + data))
    return () => window.api.offImportOutput()
  }, [])

  async function runImport() {
    if (!cases.length || importing) return
    setImportOutput('')
    setImporting(true)
    const result = await window.api?.import(cases.filter(c => !c.existingCase))
    setImporting(false)
    if (result?.keys?.length) setImportedKeys(prev => [...prev, ...result.keys])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, padding: 10, minHeight: 0 }}>
        <TestCases cases={cases} onChange={setCases} />
      </div>
      {importOutput && (
        <pre ref={importOutputRef} style={{
          margin: '0 10px', background: '#0a0a1a', border: '1px solid #0f3460',
          borderRadius: 4, padding: '6px 10px', fontSize: 11, overflowY: 'auto',
          maxHeight: 72, color: '#7fcfaf', whiteSpace: 'pre-wrap', flexShrink: 0,
        }}>
          {importOutput}
        </pre>
      )}
      <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #0f3460' }}>
        <button className="secondary" onClick={onBack}>← Menu</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" onClick={runImport} disabled={!cases.length || importing}>
            {importing ? 'Importing...' : `Import to Zephyr${cases.length > 0 ? ` (${cases.length})` : ''}`}
          </button>
          <button
            className="secondary"
            onClick={() => setShowAddToCycleModal(true)}
            disabled={importedKeys.length === 0}
          >
            Add to Existing Cycle
          </button>
        </div>
      </div>
      {showAddToCycleModal && (
        <AddToExistingCycleModal
          cases={importedKeys.map(k => ({ name: k, zephyrKey: k }))}
          onClose={() => setShowAddToCycleModal(false)}
        />
      )}
    </div>
  )
}

// — AddToExistingCycleModal —
function AddToExistingCycleModal({ cases, defaultIssueKey = '', onClose }) {
  const [cycleKey, setCycleKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState([])
  const [done, setDone] = useState(false)
  const [issueInput, setIssueInput] = useState(defaultIssueKey)
  const [linking, setLinking] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  function append(msg) { setLog(prev => [...prev, msg]) }

  async function run() {
    const key = cycleKey.trim().toUpperCase()
    if (!key || loading) return
    setLoading(true)
    setLog([])
    let ok = 0, fail = 0
    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i]
      append(`[${i + 1}/${cases.length}] Adding ${tc.zephyrKey || tc.name}...`)
      try {
        const result = await window.api?.addToCycle({ cycleKey: key, testCaseKey: tc.zephyrKey || tc.name })
        if (result?.error) { append(`  ERROR: ${result.error}`); fail++ }
        else { append(`  OK`); ok++ }
      } catch (e) {
        append(`  ERROR: ${e.message}`); fail++
      }
    }
    append(`Done. ${ok} added, ${fail} failed.`)
    setLoading(false)
    setDone(true)
  }

  async function linkToIssue() {
    const issue = issueInput.trim().toUpperCase()
    const cycle = cycleKey.trim().toUpperCase()
    if (!issue || !cycle || linking) return
    setLinking(true)
    append(`Linking ${cycle} to ${issue}...`)
    try {
      const result = await window.api?.linkCycleToIssue({ cycleKey: cycle, issueKey: issue })
      if (result?.error) append(`ERROR: ${result.error}`)
      else append(`OK: ${cycle} linked to ${issue}`)
    } catch (e) {
      append(`ERROR: ${e.message}`)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 24, width: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Add to Existing Test Cycle</h2>

        <div>
          <label style={{ marginBottom: 4 }}>Cycle ID</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              placeholder="e.g. DEV-R11313"
              value={cycleKey}
              onChange={e => setCycleKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              disabled={loading || done}
              style={{ flex: 1, marginBottom: 0 }}
              autoFocus
            />
            <button onClick={run} disabled={!cycleKey.trim() || loading || done} style={{ whiteSpace: 'nowrap' }}>
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
          {!done && <div style={{ fontSize: 11, color: '#7f8fb5', marginTop: 6 }}>{cases.length} test case{cases.length !== 1 ? 's' : ''} will be added.</div>}
        </div>

        {log.length > 0 && (
          <pre ref={logRef} style={{
            background: '#0a0a1a', border: '1px solid #0f3460', borderRadius: 4,
            padding: '6px 10px', fontSize: 11, overflowY: 'auto', maxHeight: 140,
            color: '#7fcfaf', whiteSpace: 'pre-wrap', margin: 0,
          }}>
            {log.join('\n')}
          </pre>
        )}

        {done && (
          <div style={{ borderTop: '1px solid #0f3460', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, flex: 1 }}>Link cycle to Jira issue</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3ecf8e', fontFamily: 'monospace' }}>{cycleKey.trim().toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="e.g. DEV-12345"
                value={issueInput}
                onChange={e => setIssueInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && linkToIssue()}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button className="secondary" onClick={linkToIssue} disabled={!issueInput.trim() || linking} style={{ whiteSpace: 'nowrap', minWidth: 52 }}>
                {linking ? '...' : 'Link'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={() => onClose(done)}>{done ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  )
}


export default function App() {
  const [screen, setScreen] = useState('menu')
  const [issueInfo, setIssueInfo] = useState(EMPTY_STATE.issueInfo)
  const [configNotes, setConfigNotes] = useState(EMPTY_STATE.configNotes)
  const [qaNotes, setQaNotes] = useState(EMPTY_STATE.qaNotes)
  const [impacts, setImpacts] = useState(EMPTY_STATE.impacts)
  const [cases, setCases] = useState(EMPTY_STATE.cases)
  const [importedKeys, setImportedKeys] = useState([])
  const [importOutput, setImportOutput] = useState('')
  const [importing, setImporting] = useState(false)
  const [importHadErrors, setImportHadErrors] = useState(false)
  const [failedCases, setFailedCases] = useState([])
  const [showCycleModal, setShowCycleModal] = useState(false)
  const [showAddToCycleModal, setShowAddToCycleModal] = useState(false)
  const [cycleReady, setCycleReady] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [lastReportPath, setLastReportPath] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [sessionSource, setSessionSource] = useState(null)
  const [sessionSkillTeam, setSessionSkillTeam] = useState(null)
  const sessionSavedRef = useRef(false)

  const importOutputRef = useRef(null)

  // Reset "Saved" state whenever anything meaningful changes after a save
  useEffect(() => {
    if (sessionSavedRef.current) {
      setSessionSaved(false)
      sessionSavedRef.current = false
    }
  }, [issueInfo, configNotes, qaNotes, impacts, cases, importedKeys, cycleReady, reportDone])


  useEffect(() => {
    if (importOutputRef.current) importOutputRef.current.scrollTop = importOutputRef.current.scrollHeight
  }, [importOutput])

  useEffect(() => {
    if (!window.api) return
    window.api.onImportOutput((data) => setImportOutput(prev => prev + data))
    return () => window.api.offImportOutput()
  }, [])

  function goToMenu() {
    if (screen !== 'menu') {
      const confirmed = window.confirm('Are you sure you want to go back? All unsaved data will be lost.')
      if (!confirmed) return
    }
    setIssueInfo(EMPTY_STATE.issueInfo)
    setConfigNotes(EMPTY_STATE.configNotes)
    setQaNotes(EMPTY_STATE.qaNotes)
    setImpacts(EMPTY_STATE.impacts)
    setCases(EMPTY_STATE.cases)
    setImportedKeys([])
    setImportOutput('')
    setCurrentSessionId(null)
    setLastSavedAt(null)
    setSessionSource(null)
    setSessionSkillTeam(null)
    setScreen('menu')
  }

  async function generateReport() {
    const res = await window.api?.generateReport({ issueInfo, configNotes, qaNotes, impacts, cases })
    if (res?.path) setLastReportPath(res.path)
    setReportDone(true)
    await saveSession(false, true)
  }

  async function exportPdf() {
    if (!lastReportPath || exportingPdf) return
    setExportingPdf(true)
    await window.api?.exportPdf({ htmlPath: lastReportPath })
    setExportingPdf(false)
  }

  async function saveSession(fromFooter = false, reportIsDone = false) {
    let step = 1
    if (importedKeys.length > 0) step = 2
    if (cycleReady) step = 3
    if (reportDone || reportIsDone) step = 4
    const now = new Date().toISOString()
    if (currentSessionId) {
      const session = {
        id: currentSessionId,
        savedAt: now,
        ...(sessionSource ? { source: sessionSource } : {}),
        ...(sessionSkillTeam ? { skillTeam: sessionSkillTeam } : {}),
        issueInfo, configNotes, qaNotes, impacts, cases,
        importedKeys,
        cycleReady,
        workflowStep: step,
      }
      await window.api?.updateSession(session)
    } else {
      const newId = Date.now().toString()
      const session = {
        id: newId,
        savedAt: now,
        ...(sessionSkillTeam ? { skillTeam: sessionSkillTeam } : {}),
        issueInfo, configNotes, qaNotes, impacts, cases,
        importedKeys,
        cycleReady,
        workflowStep: step,
      }
      await window.api?.saveSession(session)
      setCurrentSessionId(newId)
    }
    setLastSavedAt(now)
    sessionSavedRef.current = true
    setSessionSaved(true)
  }

  async function runImport() {
    if (importing) return
    const toImport = cases.filter(c => !c.existingCase && c._importResult?.ok !== true)
    if (!toImport.length) return
    setImportOutput('')
    setImportHadErrors(false)
    setFailedCases([])
    setCycleReady(false)
    setImporting(true)

    const result = await window.api?.import(toImport)
    setImporting(false)

    const withResult = result?.casesWithResult || []

    // Merge _importResult back into cases synchronously so we can derive importedKeys from the full picture
    const updatedCases = cases.map(c => {
      if (c.existingCase) return c
      const r = withResult.find(w => w.name === c.name)?._importResult
      if (!r) return c
      if (r.ok && r.key) return { ...c, _importResult: r, zephyrKey: r.key }
      return { ...c, _importResult: r }
    })
    setCases(updatedCases)

    // Derive importedKeys from ALL cases — existing + every successfully imported one
    const allKeys = updatedCases
      .filter(c => (c.existingCase && c.zephyrKey) || (c._importResult?.ok && (c._importResult?.key || c.zephyrKey)))
      .map(c => c._importResult?.key || c.zephyrKey)
      .filter(Boolean)
    setImportedKeys([...new Set(allKeys)])

    const hadErrors = withResult.some(w => w._importResult && !w._importResult.ok)
    if (hadErrors) setImportHadErrors(true)
  }

  function handleImportComplete(keys) {
    setImportedKeys(prev => [...prev, ...keys])
  }

  if (screen === 'menu') {
    return (
      <Menu
        onStart={() => setScreen('workspace')}
        onManageCycle={() => setScreen('manage-cycle')}
        onCreateTestCase={() => setScreen('create-test-case')}
        onAISession={() => setScreen('ai-session')}
        onImportSession={() => setScreen('import-session')}
        onSavedSessions={() => setScreen('saved-sessions')}
        onFeatureWriter={() => setScreen('feature-writer')}
        onMetrics={() => setScreen('metrics')}
        onCoverage={() => setScreen('coverage')}
      />
    )
  }

  if (screen === 'saved-sessions') {
    return (
      <SavedSessionsScreen
        onBack={goToMenu}
        onLoadSession={(session) => {
          setIssueInfo(session.issueInfo)
          setConfigNotes(session.configNotes)
          setQaNotes(session.qaNotes)
          setImpacts(session.impacts)
          setCases(session.cases)
          setImportOutput('')
          // Restore workflow state from saved step
          const step = session.workflowStep || 1
          const hasFailedCases = session.cases.some(c => !c.existingCase && c._importResult?.ok !== true && step >= 2)
          const restoredImportedKeys = step >= 2 ? (session.importedKeys || session.cases.map(c => c.zephyrKey).filter(Boolean)) : []
          setImportedKeys(restoredImportedKeys)
          setImportHadErrors(hasFailedCases && restoredImportedKeys.length > 0)
          setCycleReady(step >= 3 && session.cycleReady === true && !hasFailedCases)
          setReportDone(step >= 4 && !hasFailedCases)
          setCurrentSessionId(session.id)
          setLastSavedAt(session.savedAt || null)
          setSessionSource(session.source || null)
          setSessionSkillTeam(session.skillTeam || null)
          setSessionSaved(false)
          setScreen('workspace')
        }}
        onGenerateReport={(session) => {
          window.api?.generateReport({
            issueInfo: session.issueInfo,
            configNotes: session.configNotes,
            qaNotes: session.qaNotes,
            impacts: session.impacts,
            cases: session.cases,
          })
        }}
      />
    )
  }

  if (screen === 'manage-cycle') {
    return <ManageCycleScreen onBack={goToMenu} />
  }

  if (screen === 'create-test-case') {
    return <CreateTestCaseScreen onBack={goToMenu} />
  }

  if (screen === 'ai-session') {
    return (
      <AISessionScreen
        onBack={goToMenu}
        onUseSession={(sessionData) => {
          setIssueInfo(sessionData.issueInfo)
          setConfigNotes(sessionData.configNotes)
          setQaNotes(sessionData.qaNotes)
          setImpacts(sessionData.impacts)
          setCases(sessionData.cases)
          if (sessionData.skillTeam) setSessionSkillTeam(sessionData.skillTeam)
          setScreen('workspace')
        }}
      />
    )
  }

  if (screen === 'import-session') {
    return (
      <ImportSessionScreen
        onBack={goToMenu}
        onImport={(sessionData) => {
          setIssueInfo(sessionData.issueInfo)
          setConfigNotes(sessionData.configNotes)
          setQaNotes(sessionData.qaNotes)
          setImpacts(sessionData.impacts)
          setCases(sessionData.cases)
          setSessionSource('imported')
          setScreen('workspace')
        }}
      />
    )
  }

  if (screen === 'feature-writer') {
    return <FeatureWriterScreen onBack={goToMenu} />
  }

  if (screen === 'coverage') {
    return <CoverageScreen onBack={goToMenu} />
  }

  if (screen === 'metrics') {
    return <MetricsScreen onBack={goToMenu} />
  }

return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, display: 'flex', gap: 10, padding: 10, minHeight: 0 }}>
        {/* Left column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <IssueInfo value={issueInfo} onChange={setIssueInfo} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1, justifyContent: 'center' }}>
            <QaNotes value={qaNotes} onChange={setQaNotes} issueInfo={issueInfo} cases={cases} />
            <PossibleImpacts value={impacts} onChange={setImpacts} />
          </div>
        </div>
        {/* Right column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <ConfigNotes value={configNotes} onChange={setConfigNotes} />
          <TestCases cases={cases} onChange={setCases} issueInfo={issueInfo} style={{ flex: 1, minHeight: 0 }} />
        </div>
      </div>

      {importOutput && (
        <pre ref={importOutputRef} style={{
          margin: '0 10px', background: '#0a0a1a', border: '1px solid #0f3460',
          borderRadius: 4, padding: '6px 10px', fontSize: 11, overflowY: 'auto',
          maxHeight: 72, color: '#7fcfaf', whiteSpace: 'pre-wrap', flexShrink: 0,
        }}>
          {importOutput}
        </pre>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #0f3460', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 10px' }}>
        {/* Left half: menu button + save anytime */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="secondary" onClick={currentSessionId ? () => setScreen('saved-sessions') : goToMenu}>
            {currentSessionId ? '← Sessions' : '← Menu'}
          </button>
          {sessionSaved ? (
            <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600 }}>✓ Saved</span>
          ) : (
            <button
              className="secondary"
              style={{ fontSize: 11, padding: '4px 10px', opacity: !issueInfo.issue && !cases.length ? 0.4 : 1 }}
              onClick={() => saveSession()}
              disabled={!issueInfo.issue && !cases.length}
            >
              Save
            </button>
          )}
          {lastSavedAt && (
            <span style={{ fontSize: 10, color: '#4a5a7a' }}>
              Last saved {new Date(lastSavedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(lastSavedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Right half: stepper */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Step indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {[
              { n: 1, label: 'Import',     done: importedKeys.length > 0 && !importHadErrors, error: importHadErrors, active: importedKeys.length === 0 },
              { n: 2, label: 'Test Cycle', done: cycleReady,              active: importedKeys.length > 0 && !cycleReady && !importHadErrors },
              { n: 3, label: 'Report',     done: reportDone,              active: cycleReady && !reportDone },
            ].map((step, i) => (
              <React.Fragment key={step.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: !step.active && !step.done && !step.error ? 0.35 : 1 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    background: step.error ? '#e8c07f' : step.done ? '#3ecf8e' : step.active ? '#e94560' : '#1a3a5a',
                    color: '#fff',
                  }}>
                    {step.error ? '!' : step.done ? '✓' : step.n}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: step.error ? '#e8c07f' : step.done ? '#3ecf8e' : step.active ? '#e0e0e0' : '#7f8fb5', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </span>
                </div>
                {i < 2 && (
                  <div style={{ flex: 1, height: 1, background: '#0f3460', margin: '0 8px' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            {(importedKeys.length === 0 || importHadErrors) ? (
              /* Phase 1: Import (or retry after partial failure) */
              <>
                {importHadErrors && importedKeys.length > 0 && (
                  <span style={{ fontSize: 11, color: '#e8c07f', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ⚠ {importedKeys.length} imported, some failed
                  </span>
                )}
                {!importHadErrors && (
                  <button onClick={() => runImport()} disabled={!cases.length || importing}>
                    {importing ? 'Importing...' : `Import to Zephyr${cases.filter(c => !c.existingCase).length > 0 ? ` (${cases.filter(c => !c.existingCase).length})` : ''}`}
                  </button>
                )}
                {importHadErrors && (
                  <button onClick={() => runImport()} disabled={importing}>
                    {importing ? 'Retrying...' : `Retry Import (${cases.filter(c => !c.existingCase && c._importResult?.ok !== true).length})`}
                  </button>
                )}
                {importHadErrors && importedKeys.length > 0 && (
                  <button className="secondary" onClick={() => { setImportHadErrors(false); setFailedCases([]) }}>
                    Proceed Anyway
                  </button>
                )}
              </>
            ) : !cycleReady ? (
              /* Phase 2: Test Cycle */
              <>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '3px 10px', color: '#7f8fb5' }}
                  onClick={() => { setImportedKeys([]); setImportHadErrors(false); setFailedCases([]) }}
                >
                  ← Re-import
                </button>
                <div style={{ width: 1, height: 18, background: '#0f3460' }} />
                <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ {importedKeys.length} imported
                </span>
                <div style={{ width: 1, height: 18, background: '#0f3460' }} />
                <button className="secondary" onClick={() => setShowAddToCycleModal(true)}>Add to Existing Cycle</button>
                <button className="secondary" onClick={() => setShowCycleModal(true)}>Create New Cycle</button>
              </>
            ) : !reportDone ? (
              /* Phase 3: Report */
              <>
                <button
                  className="secondary"
                  style={{ fontSize: 11, padding: '3px 10px', color: '#7f8fb5' }}
                  onClick={() => { setImportedKeys([]); setImportHadErrors(false); setFailedCases([]) }}
                >
                  ← Re-import
                </button>
                <div style={{ width: 1, height: 18, background: '#0f3460' }} />
                <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ Cycle ready
                </span>
                <div style={{ width: 1, height: 18, background: '#0f3460' }} />
                <button onClick={generateReport}>Generate Report</button>
              </>
            ) : (
              /* Phase 3 done: report generated */
              <>
                <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ Report generated &amp; saved
                </span>
                <div style={{ width: 1, height: 18, background: '#0f3460' }} />
                <button className="secondary" onClick={generateReport}>Re-generate Report</button>
                {lastReportPath && (
                  <button
                    className="secondary"
                    onClick={exportPdf}
                    disabled={exportingPdf}
                    style={{ color: '#e94560' }}
                  >
                    {exportingPdf ? 'Exporting...' : '↓ Export PDF'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCycleModal && (
        <CycleModal
          importedKeys={importedKeys}
          onClose={(completed) => { setShowCycleModal(false); if (completed) setCycleReady(true) }}
          defaultIssueKey={issueInfo.issue?.split('/').pop() || issueInfo.issue}
          sessionData={{ issueInfo, configNotes, qaNotes, impacts, cases }}
        />
      )}
      {showAddToCycleModal && (
        <AddToExistingCycleModal
          cases={importedKeys.map(k => ({ name: k, zephyrKey: k }))}
          defaultIssueKey={issueInfo.issue}
          onClose={(completed) => { setShowAddToCycleModal(false); if (completed) setCycleReady(true) }}
        />
      )}
    </div>
  )
}
