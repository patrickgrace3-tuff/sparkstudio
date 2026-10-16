import React, { useState, useEffect } from 'react'
import { SlideThumbnail } from './SlideCard.jsx'
import SlideEditor from './SlideEditor.jsx'
import {
  fetchLatestMarketResearch, fetchClientMarketResearchCopy,
  saveClientMarketResearchCopy, clearClientMarketResearchCopy,
} from '../lib/marketResearch.js'

// Edits one client's copy of the latest Market Research deck. Changes are
// saved for this client only — the admin version (Admin → Market Research)
// and other clients are untouched. The slides stay one package that is added
// to the start of Marketing when the presentation is generated.
export default function ClientMarketResearchEditor({ clientId, clientName, onClose, onChange }) {
  const [deck,    setDeck]    = useState(null)  // admin version
  const [slides,  setSlides]  = useState(null)  // what this client uses
  const [custom,  setCustom]  = useState(false)
  const [editing, setEditing] = useState(null)  // slide index
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchLatestMarketResearch(), fetchClientMarketResearchCopy(clientId).catch(() => null)])
      .then(([latest, copy]) => {
        if (cancelled) return
        setDeck(latest)
        const useCopy = latest && copy?.deckId === latest.id
        setSlides(useCopy ? copy.slides : latest?.slides ?? [])
        setCustom(!!useCopy)
      })
      .catch(e => !cancelled && setErr(e.message))
    return () => { cancelled = true }
  }, [clientId])

  async function persist(next) {
    setSlides(next); setSaving(true); setErr('')
    try {
      await saveClientMarketResearchCopy(clientId, deck, next)
      setCustom(true)
      onChange?.(true)
    } catch (e) { setErr('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function reset() {
    if (!confirm(`Discard ${clientName || 'this client'}'s edits and go back to the admin version of these slides?`)) return
    setSaving(true); setErr('')
    try {
      await clearClientMarketResearchCopy(clientId)
      setSlides(deck.slides ?? [])
      setCustom(false)
      onChange?.(false)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const editingSlide = editing != null ? slides?.[editing] : null

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {editingSlide && (
          <SlideEditor
            key={editing}
            slide={editingSlide}
            onSave={updated => persist(slides.map((s, i) => (i === editing ? updated : s)))}
            onClose={() => setEditing(null)}
          />
        )}
        <div style={S.header}>
          <div>
            <div style={S.title}>
              Market Research{deck ? ` — ${deck.name}` : ''}
              {custom && <span style={S.badge}>Edited for {clientName || 'this client'}</span>}
            </div>
            <div style={S.sub}>
              Click a slide to edit it. Changes apply to {clientName || 'this client'} only — the admin version and other clients are not affected.
              These slides stay together at the start of Marketing when the presentation is generated.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {saving && <span style={S.status}>Saving…</span>}
            {custom && <button style={S.ghostBtn} onClick={reset} disabled={saving}>Reset to admin version</button>}
            <button style={S.ghostBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>
        {err && <div style={S.error}>{err}</div>}
        {!slides ? <div style={S.empty}>Loading…</div> : !deck ? (
          <div style={S.empty}>No Market Research deck has been uploaded yet.</div>
        ) : (
          <div style={S.grid}>
            {slides.map((s, i) => (
              <div key={i} style={S.card}>
                <div role="button" tabIndex={0} title="Edit slide" style={{ cursor: 'pointer' }}
                  onClick={() => setEditing(i)} onKeyDown={e => { if (e.key === 'Enter') setEditing(i) }}>
                  <SlideThumbnail slide={s} />
                </div>
                <div style={S.cardFoot}>
                  <span style={S.cardTitle}>{i + 1}. {s.title}</span>
                  <button style={S.ghostBtn} onClick={() => setEditing(i)} disabled={saving}>✎ Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:    { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 1200, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)' },
  title:    { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sub:      { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5, maxWidth: 760 },
  badge:    { fontSize: 10, fontWeight: 700, color: '#1D9E75', background: '#1D9E7514', border: '0.5px solid #1D9E7555', borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  status:   { fontSize: 12, color: 'var(--color-text-muted)' },
  ghostBtn: { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  error:    { fontSize: 13, color: '#ef4444', background: '#ef444412', borderRadius: 6, padding: '10px 14px', margin: '12px 20px 0' },
  empty:    { padding: 24, fontSize: 13, color: 'var(--color-text-muted)' },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, padding: 20, overflowY: 'auto' },
  card:     { border: '0.5px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg)' },
  cardFoot: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' },
  cardTitle:{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}
