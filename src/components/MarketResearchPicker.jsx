import React, { useState, useEffect } from 'react'
import { api } from '../lib/apiClient.js'

// Lists the market research decks admins have uploaded and lets the user pull
// one into the active department. Only the stored content is used, so the
// slides render and export on the standard PowerPoint template.
export default function MarketResearchPicker({ deptName, onImport, onClose }) {
  const [decks,     setDecks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [importing, setImporting] = useState(null)
  const [err,       setErr]       = useState('')

  useEffect(() => {
    api.getMarketResearchDecks()
      .then(setDecks)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handlePick(deck) {
    setImporting(deck.id); setErr('')
    try {
      const full = await api.getMarketResearchDeck(deck.id)
      onImport(full.slides ?? [])
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setImporting(null) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Market Research</div>
            <div style={S.sub}>Slides are added to {deptName} and rebuilt on the PowerPoint template</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        {err && <div style={S.error}>{err}</div>}
        {loading ? <div style={S.empty}>Loading…</div> : decks.length === 0 ? (
          <div style={S.empty}>No market research has been uploaded yet. Ask an admin to add it from the Admin Dashboard.</div>
        ) : (
          <div style={S.list}>
            {decks.map((d, i) => (
              <div key={d.id} style={S.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.name}>
                    {d.name}
                    {i === 0 && <span style={S.badge}>latest</span>}
                  </div>
                  <div style={S.meta}>
                    {d.slide_count} slide{d.slide_count === 1 ? '' : 's'} · {new Date(d.created_at).toLocaleDateString()}
                    {d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''}
                  </div>
                </div>
                <button style={S.addBtn} onClick={() => handlePick(d)} disabled={importing != null}>
                  {importing === d.id ? 'Adding…' : 'Add slides'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:    { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '0.5px solid var(--color-border)' },
  title:    { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:      { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  error:    { fontSize: 13, color: '#ef4444', background: '#ef444412', borderRadius: 6, padding: '10px 14px', margin: '12px 18px 0' },
  empty:    { padding: 18, fontSize: 13, color: 'var(--color-text-muted)' },
  list:     { overflowY: 'auto', padding: '8px 0' },
  row:      { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '0.5px solid var(--color-border)' },
  name:     { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  meta:     { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 },
  badge:    { fontSize: 9, fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-accent-tint)', borderRadius: 99, padding: '1px 6px', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  addBtn:   { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
}
