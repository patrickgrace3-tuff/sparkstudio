import React from 'react'
import { SlideCanvas } from './SlideEditor.jsx'

export default function SlideCard({ slide, index, deptColor, onDelete, onEdit }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.accent, background: deptColor }} />

      {/* Left — metadata */}
      <div style={styles.left}>
        <div style={styles.num}>{String(index + 1).padStart(2, '0')}</div>
        <div style={styles.content}>
          <p style={styles.title}>{slide.title}</p>
          {slide.bullets?.length > 0 ? (
            <ul style={styles.bullets}>
              {slide.bullets.slice(0, 4).map((b, i) => (
                <li key={i} style={styles.bullet}>{b}</li>
              ))}
              {slide.bullets.length > 4 && (
                <li style={{ ...styles.bullet, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  +{slide.bullets.length - 4} more…
                </li>
              )}
            </ul>
          ) : (
            <p style={styles.body}>{slide.body}</p>
          )}
          {slide.table && (
            <div style={styles.tablePill}>
              <span>📊</span>
              <span>Table · {slide.table.headers?.length} cols × {slide.table.rows?.length} rows</span>
            </div>
          )}
          {slide.style?.layout && slide.style.layout !== 'title-top' && (
            <div style={styles.stylePills}>
              <span style={styles.pill}>{slide.style.layout.replace('-', ' ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right — live slide preview */}
      <div style={styles.previewWrap}>
        <div style={styles.previewInner}>
          <SlideCanvas
            slide={slide}
            bgImage={slide.style?.bgImage ?? null}
            table={slide.table ?? null}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button style={styles.editBtn} onClick={() => onEdit(index)}>Edit</button>
        <button style={styles.deleteBtn} onClick={() => onDelete(index)}>✕</button>
      </div>
    </div>
  )
}

const styles = {
  card: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
    background: 'var(--color-bg)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 14px 14px 16px',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 120,
  },
  accent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
  },
  left: {
    display: 'flex',
    gap: 10,
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  num: {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
    paddingTop: 2, minWidth: 20, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
  },
  content: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5,
  },
  title: {
    fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0,
  },
  bullets: {
    listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2,
  },
  bullet: {
    fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4,
    paddingLeft: 12, position: 'relative',
  },
  body: {
    fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0,
  },
  tablePill: {
    fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4,
    display: 'flex', alignItems: 'center', gap: 4,
  },
  stylePills: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  pill: {
    fontSize: 10, color: 'var(--color-text-muted)',
    background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)', padding: '1px 7px',
  },

  // Live preview
  previewWrap: {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  previewInner: {
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    pointerEvents: 'none',
    userSelect: 'none',
  },

  actions: {
    display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'flex-start',
  },
  editBtn: {
    background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)', padding: '4px 10px',
    fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', cursor: 'pointer',
  },
  deleteBtn: {
    background: 'none', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)', padding: '4px 8px',
    fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer',
  },
}
