import React, { useState } from 'react'
import { nameToId } from '../lib/clients.js'

export default function ClientBar({ clients, activeClientId, onSelect, onAdd, onDelete }) {
  const [adding,     setAdding]     = useState(false)
  const [draft,      setDraft]      = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const activeClient = clients.find(c => c.id === activeClientId)

  function handleAdd() {
    const name = draft.trim()
    if (!name) return
    const id = nameToId(name)
    if (clients.find(c => c.id === id)) {
      alert('A client with that name already exists.')
      return
    }
    onAdd({ id, name })
    setDraft('')
    setAdding(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter')  handleAdd()
    if (e.key === 'Escape') { setAdding(false); setDraft('') }
  }

  return (
    <div style={styles.bar}>
      <span style={styles.label}>Client</span>

      {/* Dropdown */}
      <select
        style={styles.select}
        value={activeClientId}
        onChange={e => onSelect(e.target.value)}
      >
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Add new */}
      {adding ? (
        <div style={styles.addRow}>
          <input
            style={styles.addInput}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Client name"
            autoFocus
          />
          <button style={styles.btnPrimary} onClick={handleAdd}>Add</button>
          <button style={styles.btnGhost}   onClick={() => { setAdding(false); setDraft('') }}>Cancel</button>
        </div>
      ) : (
        <button style={styles.btnGhost} onClick={() => setAdding(true)}>+ New client</button>
      )}

      {/* Delete active client */}
      {clients.length > 1 && !adding && (
        confirmDel ? (
          <div style={styles.addRow}>
            <span style={styles.confirmText}>Remove "{activeClient?.name}"?</span>
            <button style={styles.btnDanger} onClick={() => { onDelete(activeClientId); setConfirmDel(false) }}>Remove</button>
            <button style={styles.btnGhost}  onClick={() => setConfirmDel(false)}>Cancel</button>
          </div>
        ) : (
          <button style={styles.btnDanger} onClick={() => setConfirmDel(true)}>Remove client</button>
        )
      )}
    </div>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 20px',
    height: 48,
    background: 'var(--color-bg)',
    borderBottom: '0.5px solid var(--color-border)',
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-display)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    flexShrink: 0,
  },
  select: {
    background: 'var(--color-bg-secondary)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 32px 6px 12px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 200,
    appearance: 'auto',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  addInput: {
    background: 'var(--color-bg-secondary)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    outline: 'none',
    width: 180,
  },
  btnPrimary: {
    background: 'var(--color-accent)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'none',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  btnDanger: {
    background: 'none',
    border: '0.5px solid var(--color-error)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--color-error)',
    cursor: 'pointer',
  },
  confirmText: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
}