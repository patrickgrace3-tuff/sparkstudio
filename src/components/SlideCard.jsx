import React, { useState } from 'react'

// Lightweight read-only slide thumbnail — mirrors the exact positions the editor uses
function SlideThumbnail({ slide }) {
  const style   = slide.style ?? {}
  const accent  = style.accent  ?? '#CD2F37'
  const textCol = style.textCol ?? '#1a1a1a'
  const bgImage = style.bgImage ?? null
  const bullets = slide.bullets ?? []
  const table   = slide.table   ?? null
  const images  = style.images  ?? []
  const extraBulletBoxes = slide.extraBulletBoxes ?? []
  const freeTextBoxes    = slide.freeTextBoxes    ?? []

  const hasTable = table && table.headers?.length > 0

  // Use same defaults as SlideEditor's DraggableBox calls
  const bodyBox  = style.bodyBox  ?? { x: 0.045, y: 0.19,  w: 0.829, h: hasTable ? 0.4 : 0.63 }
  const tableBox = style.tableBox ?? { x: 0.045, y: 0.55,  w: 0.829, h: 0.32 }

  const bg = bgImage
    ? `url(${bgImage}) center/cover no-repeat`
    : `url(/branding/content-bg.jpg) center/cover no-repeat`

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      background: bg, position: 'relative', overflow: 'hidden',
      containerType: 'inline-size', fontFamily: 'Arial, sans-serif', borderRadius: 4,
    }}>
      {bgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}

      {/* Title — same position as editor */}
      <div style={{
        position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%',
        fontSize: '2.8cqw', fontWeight: 400,
        color: bgImage ? '#fff' : accent,
        lineHeight: 1.3, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{slide.title}</div>

      {/* Bullets — positioned using bodyBox, same as editor */}
      {bullets.length > 0 && (
        <div style={{
          position: 'absolute',
          left: `${bodyBox.x * 100}%`, top: `${bodyBox.y * 100}%`,
          width: `${bodyBox.w * 100}%`, height: `${bodyBox.h * 100}%`,
          overflow: 'hidden',
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {bullets.slice(0, 8).map((b, i) => (
              <li key={i} style={{
                color: bgImage ? '#fff' : textCol,
                fontSize: '1.7cqw', lineHeight: 1.5,
                display: 'flex', gap: '0.4cqw', marginBottom: '0.4em',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>•</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extra bullet columns — same x/y/w/h as editor */}
      {extraBulletBoxes.map((eb, bi) => (
        eb.bullets?.length > 0 && (
          <div key={bi} style={{
            position: 'absolute',
            left: `${eb.box.x * 100}%`, top: `${eb.box.y * 100}%`,
            width: `${eb.box.w * 100}%`, height: `${eb.box.h * 100}%`,
            overflow: 'hidden',
          }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {eb.bullets.map((b, i) => (
                <li key={i} style={{
                  color: bgImage ? '#fff' : textCol,
                  fontSize: '1.7cqw', lineHeight: 1.5,
                  display: 'flex', gap: '0.4cqw', marginBottom: '0.4em',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>•</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}

      {/* Free text boxes */}
      {freeTextBoxes.map((ft, fi) => ft.text ? (
        <div key={fi} style={{
          position: 'absolute',
          left: `${(ft.box?.x ?? 0.045) * 100}%`, top: `${(ft.box?.y ?? 0.55) * 100}%`,
          width: `${(ft.box?.w ?? 0.829) * 100}%`, height: `${(ft.box?.h ?? 0.25) * 100}%`,
          overflow: 'hidden',
        }}>
          <p style={{ margin: 0, fontSize: `${(ft.fontSize ?? 14) * 0.115}cqw`, color: bgImage ? '#fff' : textCol, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ft.text}</p>
        </div>
      ) : null)}

      {/* Table — positioned using tableBox, same as editor */}
      {hasTable && (
        <div style={{
          position: 'absolute',
          left: `${tableBox.x * 100}%`, top: `${tableBox.y * 100}%`,
          width: `${tableBox.w * 100}%`, height: `${tableBox.h * 100}%`,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.3cqw', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: accent }}>
                {table.headers.map((h, i) => (
                  <th key={i} style={{
                    color: '#fff', padding: '0.3cqw 0.5cqw',
                    fontWeight: 700, textAlign: 'left',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    border: '0.5px solid rgba(255,255,255,0.3)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(table.rows ?? []).slice(0, 5).map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }}>
                  {table.headers.map((_, ci) => (
                    <td key={ci} style={{
                      color: bgImage ? '#fff' : textCol,
                      padding: '0.25cqw 0.5cqw',
                      border: '0.5px solid rgba(128,128,128,0.25)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows?.length > 5 && (
            <div style={{ fontSize: '1.1cqw', color: bgImage ? 'rgba(255,255,255,0.5)' : textCol, opacity: 0.6, marginTop: '0.2cqw' }}>
              +{table.rows.length - 5} more rows
            </div>
          )}
        </div>
      )}

      {/* Free-positioned images — match editor backgroundSize/crop logic */}
      {images.map((img, i) => {
        const isCrop = img.mode === 'crop'
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${img.x * 100}%`, top: `${img.y * 100}%`,
            width: `${img.w * 100}%`, height: `${img.h * 100}%`,
            backgroundImage: `url(${img.src})`,
            backgroundSize: isCrop ? 'cover' : '100% 100%',
            backgroundPosition: isCrop ? `${img.bgX ?? 50}% ${img.bgY ?? 50}%` : 'center',
            backgroundRepeat: 'no-repeat',
          }} />
        )
      })}
    </div>
  )
}

export default function SlideCard({ slide, index, deptColor, onDelete, onEdit, onUseAsTemplate }) {
  const [confirming, setConfirming] = useState(false)

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
        {onUseAsTemplate && (
          <button style={styles.templateBtn} onClick={() => onUseAsTemplate(slide)} title="Save this slide as a reusable template">
            + Template
          </button>
        )}
        {confirming ? (
          <div style={styles.confirmRow}>
            <span style={styles.confirmText}>Delete?</span>
            <button style={styles.confirmYes} onClick={() => onDelete(index)}>Yes</button>
            <button style={styles.confirmNo}  onClick={() => setConfirming(false)}>No</button>
          </div>
        ) : (
          <button style={styles.deleteBtn} onClick={() => setConfirming(true)} title="Remove slide">
            ✕
          </button>
        )}
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
  templateBtn: { background: 'none', border: '0.5px solid var(--color-accent)', borderRadius: 'var(--radius-pill)', padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer' },
  deleteBtn: { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' },
  confirmRow:  { display: 'flex', alignItems: 'center', gap: 4 },
  confirmText: { fontSize: 10, color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' },
  confirmYes:  { background: '#dc2626', border: 'none', borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: 10, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  confirmNo:   { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '3px 8px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' },
}
