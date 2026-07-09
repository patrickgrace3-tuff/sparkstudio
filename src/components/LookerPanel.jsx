import React, { useState } from 'react'
import { LOOKER_REPORTS, loadLookerCreds, saveLookerCreds, runLookerReport } from '../lib/looker.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}
function monthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function LookerPanel({ clientName, onSaveFile, onClose }) {
  const [tab,        setTab]        = useState('pull')   // 'pull' | 'settings'
  const [creds,      setCreds]      = useState(loadLookerCreds)
  const [credDraft,  setCredDraft]  = useState(loadLookerCreds)
  const [credSaved,  setCredSaved]  = useState(false)

  const [reportId,   setReportId]   = useState(LOOKER_REPORTS[0].id)
  const [startDate,  setStartDate]  = useState(monthAgo)
  const [endDate,    setEndDate]    = useState(today)
  const [status,     setStatus]     = useState(null)   // null | 'loading' | 'success' | Error
  const [lastFile,   setLastFile]   = useState(null)

  const hasCredentials = creds.baseUrl && creds.clientId && creds.clientSecret

  function saveCredentials() {
    saveLookerCreds(credDraft)
    setCreds(credDraft)
    setCredSaved(true)
    setTimeout(() => setCredSaved(false), 2000)
  }

  async function pullReport() {
    if (!hasCredentials) { setTab('settings'); return }
    setStatus('loading')
    setLastFile(null)
    try {
      const report = LOOKER_REPORTS.find(r => r.id === reportId)
      const csv = await runLookerReport({
        baseUrl:      creds.baseUrl,
        clientId:     creds.clientId,
        clientSecret: creds.clientSecret,
        lookId:       reportId,
        startDate,
        endDate,
      })
      const fileName = `${report.name} — ${startDate} to ${endDate}.csv`
      onSaveFile({ name: fileName, csv })
      setLastFile(fileName)
      setStatus('success')
    } catch (err) {
      setStatus(err)
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={S.headerIcon}>📊</span>
            <div>
              <div style={S.title}>Looker Reports</div>
              <div style={S.sub}>Client: <strong>{clientName}</strong></div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              style={{ ...S.tab, ...(tab === 'pull'     ? S.tabActive : {}) }}
              onClick={() => setTab('pull')}
            >Pull report</button>
            <button
              style={{ ...S.tab, ...(tab === 'settings' ? S.tabActive : {}) }}
              onClick={() => setTab('settings')}
            >⚙ Settings</button>
            <button style={S.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Pull tab */}
        {tab === 'pull' && (
          <div style={S.body}>
            {!hasCredentials && (
              <div style={S.warning}>
                No Looker credentials configured. Go to <strong>Settings</strong> to add your instance URL and API keys.
              </div>
            )}

            <label style={S.label}>Report</label>
            <select
              style={S.select}
              value={reportId}
              onChange={e => setReportId(e.target.value)}
            >
              {LOOKER_REPORTS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Start date</label>
                <input
                  type="date"
                  style={S.input}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>End date</label>
                <input
                  type="date"
                  style={S.input}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <button
              style={{ ...S.pullBtn, opacity: status === 'loading' || !hasCredentials ? 0.55 : 1 }}
              onClick={pullReport}
              disabled={status === 'loading' || !hasCredentials}
            >
              {status === 'loading' ? 'Pulling report…' : '↓ Pull & save to Global Files'}
            </button>

            {status === 'success' && (
              <div style={S.successMsg}>
                ✓ Saved <strong>{lastFile}</strong> to Global Files
              </div>
            )}
            {status instanceof Error && (
              <div style={S.errorMsg}>
                Error: {status.message}
              </div>
            )}

            <div style={S.hint}>
              The pulled CSV will be saved directly into Global Files and made available to all departments and the AI assistant.
            </div>
          </div>
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div style={S.body}>
            <label style={S.label}>Looker instance URL</label>
            <input
              style={S.input}
              placeholder="https://yourcompany.looker.com"
              value={credDraft.baseUrl || ''}
              onChange={e => setCredDraft(p => ({ ...p, baseUrl: e.target.value }))}
            />

            <label style={{ ...S.label, marginTop: 14 }}>API3 Client ID</label>
            <input
              style={S.input}
              placeholder="Client ID"
              value={credDraft.clientId || ''}
              onChange={e => setCredDraft(p => ({ ...p, clientId: e.target.value }))}
            />

            <label style={{ ...S.label, marginTop: 14 }}>API3 Client Secret</label>
            <input
              type="password"
              style={S.input}
              placeholder="Client Secret"
              value={credDraft.clientSecret || ''}
              onChange={e => setCredDraft(p => ({ ...p, clientSecret: e.target.value }))}
            />

            <button style={S.pullBtn} onClick={saveCredentials}>
              {credSaved ? '✓ Saved' : 'Save credentials'}
            </button>

            <div style={S.hint}>
              Credentials are stored in your browser's localStorage only — they are never sent to any server other than your Looker instance.
              <br /><br />
              To find your API3 keys: Looker Admin → Users → your account → Edit → API3 Keys.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel:      { background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)' },
  headerIcon: { fontSize: 22 },
  title:      { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:        { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 },
  tab:        { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  tabActive:  { background: 'var(--color-accent-tint)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)', fontWeight: 600 },
  closeBtn:   { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px 6px' },
  body:       { padding: 24, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  label:      { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' },
  select:     { width: '100%', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none' },
  input:      { width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none' },
  pullBtn:    { marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  successMsg: { marginTop: 12, fontSize: 13, color: '#2a9d2a', background: '#f0fff0', border: '0.5px solid #2a9d2a44', borderRadius: 6, padding: '8px 12px' },
  errorMsg:   { marginTop: 12, fontSize: 12, color: '#c0392b', background: '#fff5f5', border: '0.5px solid #c0392b44', borderRadius: 6, padding: '8px 12px', wordBreak: 'break-all' },
  warning:    { fontSize: 12, color: '#a05000', background: '#fff8f0', border: '0.5px solid #a0500044', borderRadius: 6, padding: '10px 12px', marginBottom: 16 },
  hint:       { marginTop: 16, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 },
}
