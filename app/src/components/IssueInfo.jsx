import React from 'react'

export default function IssueInfo({ value, onChange }) {
  function set(field, v) {
    onChange({ ...value, [field]: v })
  }

  return (
    <div className="panel" style={{ gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, flexShrink: 0 }}>Issue Info</h2>
        <input
          type="url"
          placeholder="https://yourcompany.atlassian.net/browse/PROJ-..."
          value={value.issue}
          onChange={e => set('issue', e.target.value)}
          style={{ flex: 1, marginBottom: 0 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10 }}>Developer</label>
          <input
            type="text"
            placeholder="Dev name"
            value={value.dev}
            onChange={e => set('dev', e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10 }}>QA</label>
          <input
            type="text"
            placeholder="QA name"
            value={value.qa}
            onChange={e => set('qa', e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>
    </div>
  )
}
