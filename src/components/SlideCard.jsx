import React from 'react'

// Lightweight read-only slide thumbnail — no DraggableBox, no event handlers
function SlideThumbnail({ slide }) {
  const style   = slide.style ?? {}
  const accent  = style.accent  ?? '#CD2F37'
  const textCol = style.textCol ?? '#1a1a1a'
  const bgImage = style.bgImage ?? null
  const bullets = slide.bullets ?? []
  const table   = slide.table   ?? null

  const bg = bgImage
    ? `url(${bgImage}) center/cover no-repeat`
    : `url(/branding/content-bg.jpg) center/cover no-repeat`

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      background: bg,
      position: 'relative',
      overflow: 'hidden',
      containerType: 'inline-size',
      fontFamily: 'Arial, sans-serif',
      borderRadius: 4,
    }}>
      {bgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}

      {/* Title */}
      <div style={{
        position: 'absolute',
        left: '15.25%', top: '5.1%', width: '77.9%',
        fontSize: '2.8cqw', fontWeight: 400,
        color: bgImage ? '#fff' : accent,
        lineHeight: 1.3,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>{slide.title}</div>

      {/* Bullets */}
      {bullets.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '4.5%', top: '19%', width: '82.9%',
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {bullets.slice(0, 6).map((b, i) => (
              <li key={i} style={{
                color: bgImage ? '#fff' : textCol,
                fontSize: '1.7cqw', lineHeight: 1.5,
                display: 'flex', gap: '0.4cqw',
                marginBottom: '0.4em',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>•</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table indicator */}
      {table && table.headers?.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '4.5%', top: bullets.length > 0 ? '56%' : '22%', width: '82.9%',
          fontSize: '1.4cqw', color: bgImage ? 'rgba(255,255,255,0.7)' : textCol,
          opacity: 0.8,
        }}>
          📊 {table.headers.join(' · ')}
        </div>
      )}
    </div>
  )
}

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

      {/* Right — live slide thumbnail */}
      <div style={styles.previewWrap}>
        <SlideThumbnail slide={slide} />
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
    display: 'flex', gap: 12, alignItems: 'stretch',
    background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '14px 14px 14px 16px',
    position: 'relative', overflow: 'hidden', minHeight: 120,
  },
  accent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
  },
  left: { display: 'flex', gap: 10, flex: 1, minWidth: 0, alignItems: 'flex-start' },
  num:  { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', paddingTop: 2, minWidth: 20, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  content: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 },
  title:   { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 },
  bullets: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  bullet:  { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4, paddingLeft: 12, position: 'relative' },
  body:    { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 },
  tablePill: { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 },
  stylePills: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  pill:    { fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '1px 7px' },
  previewWrap: { width: 240, flexShrink: 0, display: 'flex', alignItems: 'center' },
  actions: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'flex-start' },
  editBtn: { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', cursor: 'pointer' },
  deleteBtn: { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' },
}
