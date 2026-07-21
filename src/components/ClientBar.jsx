import React from 'react'

export default function ClientBar({ clients, activeClientId, onSelect, currentUser, onLogout }) {
  return (
    <div style={styles.bar}>
      <span style={styles.label}>Client</span>

      <select
        style={styles.select}
        value={activeClientId}
        onChange={e => onSelect(e.target.value)}
      >
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div style={{ flex: 1 }} />

      {currentUser && (
        <div style={styles.userArea}>
          <span style={styles.userName}>{currentUser.name || currentUser.email}</span>
          <button style={styles.btnGhost} onClick={onLogout}>Sign out</button>
        </div>
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
  btnGhost: {
    background: 'none',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  userName: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
