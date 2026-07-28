import React, { useState } from 'react'

export default function Menu({ onStart, onManageCycle, onCreateTestCase, onAISession, onSavedSessions, onFeatureWriter, onMetrics }) {
  const [showTools, setShowTools] = useState(false)

  return (
    <div className="menu-screen">
      <div className="menu-logo">
        <h1>QA Hub</h1>
        <p>Your QA workflow tool</p>
      </div>
      <div className="menu-buttons">
        <div className="menu-option">
          <button className="menu-btn" onClick={onSavedSessions}>
            My Sessions
          </button>
        </div>

        <div className="menu-option">
          <button className="menu-btn" onClick={onAISession}>
            New QA Session
            <br />
            <em style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>powered by AI</em>
          </button>
        </div>

        <div className="menu-option" style={{ position: 'relative' }}>
          <button className="menu-btn" onClick={() => setShowTools(v => !v)}>
            QA Tools
            <br />
            <em style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>
              {showTools ? '▲ close' : '▼ open'}
            </em>
          </button>
          {showTools && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#16213e',
              border: '1px solid #0f3460',
              borderRadius: 8,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 200,
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <button
                className="menu-btn"
                style={{ fontSize: 12, padding: '7px 14px', width: '100%', height: 'auto' }}
                onClick={() => { setShowTools(false); onCreateTestCase() }}
              >
                Create Test Case
              </button>
              <button
                className="menu-btn"
                style={{ fontSize: 12, padding: '7px 14px', width: '100%', height: 'auto' }}
                onClick={() => { setShowTools(false); onManageCycle() }}
              >
                Manage Test Cycle
              </button>
              <button
                className="menu-btn"
                style={{ fontSize: 12, padding: '7px 14px', width: '100%', height: 'auto' }}
                onClick={() => { setShowTools(false); onFeatureWriter() }}
              >
                Feature Writer
              </button>
              <button
                className="menu-btn"
                style={{ fontSize: 12, padding: '7px 14px', width: '100%', height: 'auto' }}
                onClick={() => { setShowTools(false); onMetrics() }}
              >
                Metrics
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
