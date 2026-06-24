import React from 'react'

export default function SlideCard({ slide, index, deptColor, onDelete, onEdit }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.accent, background: deptColor }} />
      <div style={styles.num}>{String(index + 1).padStart(2, '0')}</div>
      <div style={styles.content}>
        <p style={styles.title}>{slide.title}</p>
        {slide.bullets?.length > 0 ? (
          <ul style={styles.bullets}>
            {slide.bullets.slice(0, 3).map((b, i) => (
              <li key={i} style={styles.bullet}>{b}</li>
            ))}
            {slide.bullets.length > 3 && (
              <li style={{ ...styles.bullet, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                +{slide.bullets.length - 3} more…
              </li>
            )}
          </ul>
        ) : (
          <p style={styles.body}>{slide.body}</p>
        )}
        {slide.table && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📊</span>
            <span>Table · {slide.table.headers?.length} cols × {slide.table.rows?.length} rows</span>
          </div>
        )}
        {slide.style && (
          <div style={styles.stylePills}>
            {slide.style.layout && <span style={styles.pill}>{slide.style.layout.replace('-', ' ')}</span>}
            {slide.style.bg && slide.style.bg !== '#FFFFFF' && (
              <span style={{ ...styles.pill, background: slide.style.bg + '22', color: slide.style.bg, border: `0.5px solid ${slide.style.bg}44` }}>
                custom color
              </span>
            )}
          </div>
        )}
      </div>
      <div style={styles.actions}>
        <button style={styles.editBtn} onClick={() => onEdit(index)} title="Edit slide">
          Edit
        </button>
        <button style={styles.deleteBtn} onClick={() => onDelete(index)} title="Remove slide">
          ✕
        </button>
      </div>
    </div>
  )
}

const styles = {
  card:       { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', position: 'relative', overflow: 'hidden' },
  accent:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' },
  num:        { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', paddingTop: 2, minWidth: 20, fontVariantNumeric: 'tabular-nums' },
  content:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 },
  title:      { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 },
  bullets:    { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  bullet:     { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4, paddingLeft: 12, position: 'relative' },
  body:       { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 },
  stylePills: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  pill:       { fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '1px 7px' },
  actions:    { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  editBtn:    { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', cursor: 'pointer' },
  deleteBtn:  { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' },
}