import React, { useState, useEffect, useRef } from 'react'
import { parseRichText } from '../lib/richtext.js'
import { previewTable, TABLE_LINE_HEIGHT } from '../lib/tableFit.js'
import OriginalSlidePreview from './OriginalSlidePreview.jsx'
import { hasAdditions } from '../lib/originalSlides.js'
import FramedImage from './FramedImage.jsx'

// Title-only slides have no body (older ones saved a placeholder line instead)
const isEmptyBody = body => !String(body ?? '').trim() || String(body).trim() === '(No content added yet)'

function RichText({ text }) {
  return parseRichText(text).map((seg, i) => {
    if (seg.bold && seg.italic) return <strong key={i}><em>{seg.text}</em></strong>
    if (seg.bold)   return <strong key={i}>{seg.text}</strong>
    if (seg.italic) return <em key={i}>{seg.text}</em>
    return <React.Fragment key={i}>{seg.text}</React.Fragment>
  })
}

// Lightweight read-only slide thumbnail — mirrors the exact positions the editor uses
// overlayOnly: just the added content (pictures, text and bullet areas, table)
// on a clear background — drawn over an imported slide
export function SlideThumbnail({ slide, overlayOnly = false }) {
  if (!overlayOnly && slide.style?.original?.ref) {
    const base = <OriginalSlidePreview original={slide.style.original} rounded />
    if (!hasAdditions(slide)) return base
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        {base}
        <div style={{ position: 'absolute', inset: 0 }}><SlideThumbnail slide={slide} overlayOnly /></div>
      </div>
    )
  }
  const style   = slide.style ?? {}
  const accent  = style.accent  ?? '#CD2F37'
  const textCol = style.textCol ?? '#1a1a1a'
  const bgImage = style.bgImage ?? null
  // Slides not yet opened in the editor only have body text — show its lines
  // as bullets, as the editor and the generated deck do
  const bullets = overlayOnly ? [] : slide.bullets?.length ? slide.bullets : String(slide.body ?? '').split('\n').filter(l => l.trim() && !isEmptyBody(l))
  const table   = slide.table   ?? null
  const images  = style.images  ?? []
  const extraBulletBoxes = slide.extraBulletBoxes ?? []
  const freeTextBoxes    = slide.freeTextBoxes    ?? []

  const hasTable = table && table.headers?.length > 0
  const tableView = hasTable ? previewTable(table, style, 5, 1.3) : null

  // Use same defaults as SlideEditor's DraggableBox calls
  const bodyBox  = style.bodyBox  ?? { x: 0.045, y: 0.19,  w: 0.829, h: hasTable ? 0.4 : 0.63 }
  const tableBox = style.tableBox ?? { x: 0.045, y: 0.55,  w: 0.829, h: 0.32 }

  const bg = overlayOnly ? 'transparent' : bgImage
    ? `url(${bgImage}) center/cover no-repeat`
    : `url(/branding/content-bg.jpg) center/cover no-repeat`

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      background: bg, position: 'relative', overflow: 'hidden',
      containerType: 'inline-size', fontFamily: 'Arial, sans-serif', borderRadius: 4,
    }}>
      {bgImage && !overlayOnly && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}

      {/* Title — same position as editor */}
      {!overlayOnly && <div style={{
        position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%',
        fontSize: '2.8cqw', fontWeight: 400,
        color: bgImage ? '#fff' : accent,
        lineHeight: 1.3, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{slide.title}</div>}

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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><RichText text={b} /></span>
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
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><RichText text={b} /></span>
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
          <p style={{ margin: 0, fontSize: `${(ft.fontSize ?? 14) * 0.115}cqw`, color: bgImage ? '#fff' : textCol, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: ft.textAlign ?? 'left' }}><RichText text={ft.text} /></p>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${tableView.fontCqw}cqw`, tableLayout: 'fixed', ...(tableView.showAll ? { lineHeight: TABLE_LINE_HEIGHT } : {}) }}>
            <thead>
              <tr style={{ background: accent }}>
                {table.headers.map((h, i) => (
                  <th key={i} style={{
                    color: '#fff', padding: tableView.showAll ? '0.3em 0.6em' : '0.3cqw 0.5cqw',
                    fontWeight: 700, textAlign: 'left',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    border: '0.5px solid rgba(255,255,255,0.3)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableView.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }}>
                  {table.headers.map((_, ci) => (
                    <td key={ci} style={{
                      color: bgImage ? '#fff' : textCol,
                      padding: tableView.showAll ? '0.3em 0.6em' : '0.25cqw 0.5cqw',
                      border: '0.5px solid rgba(128,128,128,0.25)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableView.hidden > 0 && (
            <div style={{ fontSize: '1.1cqw', color: bgImage ? 'rgba(255,255,255,0.5)' : textCol, opacity: 0.6, marginTop: '0.2cqw' }}>
              +{tableView.hidden} more rows
            </div>
          )}
        </div>
      )}

      {/* Free-positioned images — cropped and rounded as in the editor and export */}
      {images.map((img, i) => <FramedImage key={i} img={img} />)}
    </div>
  )
}

export default function SlideCard({ slide, index, deptColor, onDelete, onEdit, onView, onMove, moveTargets = [], onUseAsTemplate, divisionName }) {
  const [confirming, setConfirming] = useState(false)
  const [moving, setMoving] = useState(null) // menu position while open
  const moveRef = useRef(null)

  // Close the Move menu on an outside click or Esc
  useEffect(() => {
    if (!moving) return
    const onDown = e => { if (moveRef.current && !moveRef.current.contains(e.target)) setMoving(null) }
    const onKey  = e => { if (e.key === 'Escape') setMoving(null) }
    const close = () => setMoving(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close)
    }
  }, [moving])
  const locked = !!slide.style?.original?.ref

  return (
    <div style={styles.card}>
      <div style={{ ...styles.accent, background: deptColor }} />

      {/* Left — metadata */}
      <div style={styles.left}>
        <div style={styles.num}>{String(index + 1).padStart(2, '0')}</div>
        <div style={styles.content}>
          <p style={styles.title}>
            {slide.title}
            {locked && <span style={styles.lockedBadge} title={`Imported from ${slide.style.original.fileName ?? 'a PowerPoint file'} with its original styling. Its content keeps the file's fonts, colours and layout on the Spark Studio template.`}>Original styling</span>}
            {divisionName && <span style={styles.divisionBadge} title="Created from a template for this division — uses this division's files">{divisionName}</span>}
          </p>
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
            <p style={{ ...styles.body, ...(isEmptyBody(slide.body) ? { color: 'var(--color-text-muted)', fontStyle: 'italic' } : {}) }}>{isEmptyBody(slide.body) ? '(No content added yet)' : slide.body}</p>
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
      <div
        style={{ ...styles.previewWrap, ...(onView ? { cursor: 'zoom-in' } : {}) }}
        onClick={onView ? () => onView(index) : undefined}
        title={onView ? 'View full size' : undefined}
      >
        <SlideThumbnail slide={slide} />
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button style={styles.editBtn} onClick={() => onEdit(index)} title={locked ? 'Move, resize, crop or delete elements and change text — the original styling is kept' : undefined}>Edit</button>
        {onView && <button style={styles.editBtn} onClick={() => onView(index)} title="Open a full-size view">View</button>}
        {onMove && moveTargets.length > 0 && (
          <div ref={moveRef} style={{ position: 'relative' }}>
            <button style={{ ...styles.editBtn, width: '100%', ...(moving ? { borderColor: 'var(--color-accent)' } : {}) }} onClick={e => {
                if (moving) { setMoving(null); return }
                const r = e.currentTarget.getBoundingClientRect()
                setMoving({ top: r.bottom + 4, right: window.innerWidth - r.right })
              }}
              title="Move this slide to another department" aria-haspopup="menu" aria-expanded={!!moving}>Move</button>
            {moving && (
              <div style={{ ...styles.moveMenu, top: moving.top, right: moving.right }} role="menu">
                <div style={styles.moveHead}>Move to…</div>
                {moveTargets.map(d => (
                  <button key={d.id} role="menuitem" style={styles.moveItem}
                    onClick={() => { setMoving(null); onMove(index, d.id) }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                    <span style={{ ...styles.moveDot, background: d.color }} />{d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onUseAsTemplate && (
          <button style={styles.templateBtn} onClick={() => onUseAsTemplate(slide)} title="Save this slide as a reusable template">
            + Template
          </button>
        )}
        {confirming ? (
          <div style={styles.confirmRow}>
            <button style={styles.confirmYes} onClick={() => onDelete(index)} title="Delete this slide">Delete</button>
            <button style={styles.confirmNo}  onClick={() => setConfirming(false)}>Keep</button>
          </div>
        ) : (
          <button style={styles.deleteBtn} onClick={() => setConfirming(true)} title="Delete this slide">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  lockedBadge:   { display: 'inline-block', marginLeft: 8, verticalAlign: 'middle', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7F77DD', background: '#7F77DD14', border: '0.5px solid #7F77DD55', borderRadius: 99, padding: '1px 7px' },
  divisionBadge: { display: 'inline-block', marginLeft: 8, verticalAlign: 'middle', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#D85A30', background: '#D85A3014', border: '0.5px solid #D85A3055', borderRadius: 99, padding: '1px 7px' },
  card: {
    display: 'flex', gap: 12, alignItems: 'stretch',
    background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '14px 14px 14px 16px',
    position: 'relative', overflow: 'hidden', minHeight: 120,
    flexShrink: 0, // the list scrolls — never squash a card (that clipped its buttons)
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
  actions: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'flex-start', width: 84 },
  editBtn: { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', cursor: 'pointer' },
  templateBtn: { background: 'none', border: '0.5px solid var(--color-accent)', borderRadius: 'var(--radius-pill)', padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer' },
  deleteBtn: { background: 'none', border: '0.5px solid #dc262655', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#dc2626', cursor: 'pointer' },
  moveMenu: { position: 'fixed', zIndex: 1000, minWidth: 190, background: 'var(--color-bg, #fff)', border: '0.5px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 4, display: 'flex', flexDirection: 'column' },
  moveHead: { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 8px 4px' },
  moveItem: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' },
  moveDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  confirmRow:  { display: 'flex', alignItems: 'center', gap: 4 },
  confirmText: { fontSize: 10, color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' },
  confirmYes:  { flex: 1, background: '#dc2626', border: 'none', borderRadius: 'var(--radius-pill)', padding: '4px 6px', fontSize: 10, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  confirmNo:   { flex: 1, background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'pointer' },
}
