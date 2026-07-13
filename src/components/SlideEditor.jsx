import React, { useState, useRef } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'
import { parseRichText } from '../lib/richtext.js'

function RichText({ text }) {
  return parseRichText(text).map((seg, i) => {
    let node = seg.text
    if (seg.bold && seg.italic) return <strong key={i}><em>{node}</em></strong>
    if (seg.bold)   return <strong key={i}>{node}</strong>
    if (seg.italic) return <em key={i}>{node}</em>
    return <React.Fragment key={i}>{node}</React.Fragment>
  })
}

const FONTS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Palatino', value: "'Palatino Linotype', serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

const LAYOUTS = [
  { id: 'title-left',   label: 'Title Left',    icon: '▤' },
  { id: 'title-top',    label: 'Title Top',      icon: '▥' },
  { id: 'split',        label: 'Two Column',     icon: '▦' },
  { id: 'centered',     label: 'Centered',       icon: '▣' },
  { id: 'image-right',  label: 'Image Right',    icon: '◧' },
  { id: 'full-image',   label: 'Full Background',icon: '█' },
]

const BG_PRESETS = [
  { label: 'White',       bg: '#FFFFFF', text: '#1a1a1a', accent: '#CD2F37' },
  { label: 'Dark',        bg: '#1E2761', text: '#FFFFFF', accent: '#CADCFC' },
  { label: 'Spark Red',   bg: '#CD2F37', text: '#FFFFFF', accent: '#FFFFFF' },
  { label: 'Charcoal',    bg: '#36454F', text: '#F2F2F2', accent: '#ef4444' },
  { label: 'Slate',       bg: '#2C3E50', text: '#ECF0F1', accent: '#3498db' },
  { label: 'Forest',      bg: '#2C5F2D', text: '#F5F5F5', accent: '#97BC62' },
  { label: 'Custom',      bg: null,      text: null,      accent: null },
]

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

// ── Freely positioned/resized images overlaid on the slide, PowerPoint-style ──
function FreeImageLayer({ images, onChange }) {
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const next = [...images]
    if (d.mode === 'move') {
      next[d.idx] = {
        ...next[d.idx],
        x: clamp(d.orig.x + dx, 0, 1 - d.orig.w),
        y: clamp(d.orig.y + dy, 0, 1 - d.orig.h),
      }
    } else {
      next[d.idx] = {
        ...next[d.idx],
        w: clamp(d.orig.w + dx, 0.05, 1 - d.orig.x),
        h: clamp(d.orig.h + dy, 0.05, 1 - d.orig.y),
      }
    }
    onChange(next)
  }

  function onPointerUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function startDrag(e, idx, mode) {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = { idx, mode, startX: e.clientX, startY: e.clientY, orig: { ...images[idx] } }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function removeImage(idx) {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {images.map((img, i) => (
        <div
          key={i}
          onPointerDown={e => startDrag(e, i, 'move')}
          style={{
            position: 'absolute',
            pointerEvents: 'auto',
            left: `${img.x * 100}%`,
            top: `${img.y * 100}%`,
            width: `${img.w * 100}%`,
            height: `${img.h * 100}%`,
            backgroundImage: `url(${img.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px dashed rgba(255,255,255,0.8)',
            outline: '1px dashed rgba(0,0,0,0.4)',
            cursor: 'move',
            boxSizing: 'border-box',
          }}
        >
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => removeImage(i)}
            style={{
              position: 'absolute', top: -10, right: -10, width: 20, height: 20,
              borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 11, cursor: 'pointer', lineHeight: 1,
            }}
          >✕</button>
          <div
            onPointerDown={e => startDrag(e, i, 'resize')}
            style={{
              position: 'absolute', bottom: -6, right: -6, width: 14, height: 14,
              background: '#fff', border: '2px solid var(--color-accent)', borderRadius: 3,
              cursor: 'nwse-resize',
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ── A single draggable/resizable box (PowerPoint-style) overlaid on the slide,
// used to reposition the bullet-point content area ─────────────────────────────
function DraggableBox({ box, onChange, children }) {
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const rect = containerRef.current.parentElement.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    if (d.mode === 'move') {
      onChange({
        ...box,
        x: clamp(d.orig.x + dx, 0, 1 - d.orig.w),
        y: clamp(d.orig.y + dy, 0, 1 - d.orig.h),
      })
    } else {
      onChange({
        ...box,
        w: clamp(d.orig.w + dx, 0.1, 1 - d.orig.x),
        h: clamp(d.orig.h + dy, 0.1, 1 - d.orig.y),
      })
    }
  }

  function onPointerUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function startDrag(e, mode) {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...box } }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        outline: '1px dashed rgba(0,0,0,0.25)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {children}
      </div>
      {/* Drag handle — kept separate from the editable content (and outside
          the overflow:hidden content layer) so clicking into text doesn't
          get swallowed by the box's move-drag, and the handle stays visible
          even when the box sits at the canvas edge. */}
      <div
        onPointerDown={e => startDrag(e, 'move')}
        title="Drag to move"
        style={{
          position: 'absolute', top: -10, left: -10, width: 20, height: 20,
          background: '#fff', border: '2px solid var(--color-accent)', borderRadius: '50%',
          cursor: 'move', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'var(--color-accent)', userSelect: 'none', zIndex: 2,
        }}
      >✛</div>
      <div
        onPointerDown={e => startDrag(e, 'resize')}
        style={{
          position: 'absolute', bottom: -6, right: -6, width: 14, height: 14,
          background: '#fff', border: '2px solid var(--color-accent)', borderRadius: 3,
          cursor: 'nwse-resize', zIndex: 2,
        }}
      />
    </div>
  )
}

// Stops a click meant for placing a text cursor / selecting text from also
// triggering the parent DraggableBox's move-drag.
function stopForEdit(e) {
  e.stopPropagation()
}

// ── Live slide preview canvas ─────────────────────────────────────────────────
function SlideCanvas({
  slide, bgImage, table, onImagesChange, onBodyBoxChange, onTableBoxChange,
  onTitleChange, onBulletChange, onTableHeaderChange, onTableCellChange, onSourceChange,
}) {
  const { title, bullets, source, style = {} } = slide
  const font    = style.font    ?? FONTS[0].value
  const layout  = style.layout  ?? 'title-top'
  const bg      = style.bg      ?? '#FFFFFF'
  const textCol = style.textCol ?? '#1a1a1a'
  const accent  = style.accent  ?? '#CD2F37'
  const contentImage = style.contentImage ?? null

  // containerType: 'inline-size' + cqw (container-query width) units below tie
  // every font size to this canvas's own rendered pixel width, instead of the
  // ambient root font-size. That's what kept the preview, the fullscreen
  // editor, and the deck grid/presenter views from matching each other —
  // each rendered the slide at a different pixel width but text sizes were
  // either fixed px or em (relative to the page's 16px root), so the same
  // slide looked like a different scale everywhere it was shown.
  const canvasStyle = {
    width: '100%',
    aspectRatio: '16/9',
    background: bgImage
      ? `url(${bgImage}) center/cover no-repeat`
      : bg,
    fontFamily: font,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 6,
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: layout === 'title-left' ? 'row' : 'column',
    containerType: 'inline-size',
  }

  const titleStyle = {
    color: accent,
    fontWeight: 700,
    lineHeight: 1.2,
    fontSize: layout === 'centered' ? '4.7cqw' : '3.6cqw',
    textAlign: layout === 'centered' ? 'center' : 'left',
    textShadow: bgImage ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
  }

  const bulletStyle = {
    color: textCol,
    fontSize: '1.8cqw',
    lineHeight: 1.6,
    textShadow: bgImage ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
  }

  const accentBar = (
    <div style={{ height: 3, background: accent, borderRadius: 2, margin: '8px 0 12px' }} />
  )

  if (layout === 'title-left') {
    return (
      <div style={canvasStyle}>
        <div style={{ width: '38%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5%' }}>
          <div style={{ ...titleStyle, color: '#fff', fontSize: '3.2cqw', textAlign: 'center' }}>{title}</div>
        </div>
        <div style={{ flex: 1, padding: '5%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 8, marginBottom: '0.5em' }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>—</span><RichText text={b} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (layout === 'split') {
    const half = Math.ceil((bullets || []).length / 2)
    return (
      <div style={{ ...canvasStyle, flexDirection: 'column', padding: '5%' }}>
        <div style={titleStyle}>{title}</div>
        {accentBar}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 5%', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).slice(0, half).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span><RichText text={b} />
              </li>
            ))}
          </ul>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).slice(half).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span><RichText text={b} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (layout === 'centered') {
    return (
      <div style={{ ...canvasStyle, alignItems: 'center', justifyContent: 'center', padding: '8%', flexDirection: 'column' }}>
        <div style={titleStyle}>{title}</div>
        <div style={{ width: '30%', height: 3, background: accent, borderRadius: 2, margin: '12px auto 16px' }} />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'center' }}>
          {(bullets || []).map((b, i) => (
            <li key={i} style={{ ...bulletStyle, marginBottom: '0.5em' }}><RichText text={b} /></li>
          ))}
        </ul>
      </div>
    )
  }

  if (layout === 'image-right') {
    return (
      <div style={{ ...canvasStyle, flexDirection: 'row' }}>
        <div style={{ flex: 1, padding: '5%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={titleStyle}>{title}</div>
          {accentBar}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span><RichText text={b} />
              </li>
            ))}
          </ul>
        </div>
        <div style={{ width: '40%', background: contentImage ? `url(${contentImage}) center/cover` : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '1.6cqw' }}>
          {!contentImage && 'Upload image →'}
        </div>
      </div>
    )
  }

  if (layout === 'full-image') {
    return (
      <div style={{ ...canvasStyle, alignItems: 'center', justifyContent: 'center', padding: '8%', flexDirection: 'column' }}>
        {bgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
          <div style={{ ...titleStyle, color: '#fff', fontSize: '4.2cqw' }}>{title}</div>
          <div style={{ width: '25%', height: 3, background: accent, borderRadius: 2, margin: '10px auto 14px' }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, color: 'rgba(255,255,255,0.92)', marginBottom: '0.4em' }}><RichText text={b} /></li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // Table preview component — headers/cells are directly editable in place.
  const TablePreview = ({ tbl }) => tbl ? (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '1.2cqw' }}>
        <thead>
          <tr>{tbl.headers.map((h, i) => (
            <th
              key={i}
              contentEditable={!!onTableHeaderChange}
              suppressContentEditableWarning
              onPointerDown={stopForEdit}
              onBlur={e => onTableHeaderChange?.(i, e.currentTarget.textContent)}
              style={{ background: accent, color: '#fff', padding: '3px 6px', border: '0.5px solid rgba(255,255,255,0.3)', fontWeight: 700, whiteSpace: 'nowrap', outline: 'none', cursor: onTableHeaderChange ? 'text' : 'default' }}
            >{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {tbl.rows.slice(0, 6).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'transparent' }}>
              {tbl.headers.map((_, ci) => (
                <td
                  key={ci}
                  contentEditable={!!onTableCellChange}
                  suppressContentEditableWarning
                  onPointerDown={stopForEdit}
                  onBlur={e => onTableCellChange?.(ri, ci, e.currentTarget.textContent)}
                  style={{ color: textCol, padding: '2px 6px', border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap', outline: 'none', cursor: onTableCellChange ? 'text' : 'default' }}
                >{row[ci] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {tbl.rows.length > 6 && <p style={{ fontSize: '1.1cqw', color: textCol, opacity: 0.6, margin: '2px 0 0' }}>+{tbl.rows.length - 6} more rows</p>}
    </div>
  ) : null

  // Default: title-top — this is the only layout the pptx exporter actually
  // produces (other layout choices only affect bgImage/contentImage
  // compositing), so render it using the real template background image and
  // the exact placeholder positions (lifted from the template's OOXML) so
  // this preview matches the exported pptx, not a CSS approximation of it.
  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      background: bgImage ? `url(${bgImage}) center/cover no-repeat` : `url(/branding/content-bg.jpg) center/cover no-repeat`,
      fontFamily: font,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 6,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      containerType: 'inline-size',
    }}>
      {bgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      <div
        contentEditable={!!onTitleChange}
        suppressContentEditableWarning
        onPointerDown={stopForEdit}
        onBlur={e => onTitleChange?.(e.currentTarget.textContent)}
        style={{ position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%', fontSize: '2.8cqw', fontWeight: 400, color: bgImage ? '#fff' : accent, lineHeight: 1.3, outline: 'none', cursor: onTitleChange ? 'text' : 'default' }}
      >{title}</div>
      <DraggableBox box={style.bodyBox || { x: 0.045, y: 0.19, w: 0.829, h: table ? 0.4 : 0.63 }} onChange={onBodyBoxChange}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {(bullets || []).map((b, i) => (
            <li key={i} style={{ color: bgImage ? '#fff' : textCol, fontSize: '1.7cqw', lineHeight: 1.6, display: 'flex', gap: 8, marginBottom: '0.5em', textShadow: bgImage ? '0 1px 3px rgba(0,0,0,0.6)' : 'none' }}>
              <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>•</span>
              <span
                contentEditable={!!onBulletChange}
                suppressContentEditableWarning
                onPointerDown={stopForEdit}
                onBlur={e => onBulletChange?.(i, e.currentTarget.innerText)}
                style={{ outline: 'none', cursor: onBulletChange ? 'text' : 'default' }}
              ><RichText text={b} /></span>
            </li>
          ))}
        </ul>
      </DraggableBox>
      {table && (
        <DraggableBox box={style.tableBox || { x: 0.045, y: 0.55, w: 0.829, h: 0.32 }} onChange={onTableBoxChange}>
          <TablePreview tbl={table} />
        </DraggableBox>
      )}
      <div style={{ position: 'absolute', left: '1.8%', top: '90.4%', width: '48.4%', fontSize: '1.2cqw', fontStyle: 'italic', color: bgImage ? 'rgba(255,255,255,0.7)' : '#7F7F7F', display: 'flex', gap: '0.3em' }}>
        <span style={{ flexShrink: 0 }}>Source:</span>
        <span
          contentEditable={!!onSourceChange}
          suppressContentEditableWarning
          onPointerDown={stopForEdit}
          onBlur={e => onSourceChange?.(e.currentTarget.textContent)}
          style={{ outline: 'none', cursor: onSourceChange ? 'text' : 'default' }}
        >{source}</span>
      </div>
      <FreeImageLayer images={style.images || []} onChange={onImagesChange} />
    </div>
  )
}

// ── Main editor modal ─────────────────────────────────────────────────────────
export default function SlideEditor({ slide, onSave, onClose }) {
  const [draft,    setDraft]    = useState({
    title:   slide.title   ?? '',
    body:    slide.body    ?? '',
    source:  slide.source  ?? '',
    notes:   slide.notes   ?? '',
    bullets: slide.bullets?.length
      ? [...slide.bullets]
      : (slide.body ?? '').split('\n').filter(Boolean),
    style: {
      font:    slide.style?.font    ?? FONTS[0].value,
      layout:  slide.style?.layout  ?? 'title-top',
      bg:      slide.style?.bg      ?? '#FFFFFF',
      textCol: slide.style?.textCol ?? '#1a1a1a',
      accent:  slide.style?.accent  ?? '#CD2F37',
      contentImage: slide.style?.contentImage ?? null,
      images:  slide.style?.images  ?? [],
      bodyBox: slide.style?.bodyBox ?? { x: 0.045, y: 0.19, w: 0.829, h: 0.63 },
    },
  })
  const [bgImage,       setBgImage]       = useState(slide.style?.bgImage ?? null)
  const [activePanel,   setActivePanel]   = useState('content') // content | layout | style | notes
  const [fullscreen,    setFullscreen]    = useState(false)
  const [controlsWidth, setControlsWidth] = useState(300)
  const splitterDragRef = useRef(null)

  function onSplitterPointerDown(e) {
    e.preventDefault()
    splitterDragRef.current = { startX: e.clientX, startW: controlsWidth }
    const onMove = (ev) => {
      const dx = ev.clientX - splitterDragRef.current.startX
      setControlsWidth(Math.max(200, Math.min(600, splitterDragRef.current.startW + dx)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  // Table state — separate from draft so edits are granular
  const [table, setTable] = useState(
    slide.table
      ? { headers: [...slide.table.headers], rows: slide.table.rows.map(r => [...r]) }
      : null
  )
  const bgInputRef      = useRef(null)
  const contentImgRef   = useRef(null)
  const freeImgRef      = useRef(null)
  const bulletInputRefs = useRef([])

  function update(key, val) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function updateStyle(key, val) {
    setDraft(d => ({ ...d, style: { ...d.style, [key]: val } }))
  }

  function updateBullet(i, val) {
    const b = [...draft.bullets]; b[i] = val; update('bullets', b)
  }

  function addBullet() {
    update('bullets', [...draft.bullets, ''])
  }

  function removeBullet(i) {
    update('bullets', draft.bullets.filter((_, idx) => idx !== i))
  }

  function moveBullet(i, dir) {
    const b = [...draft.bullets]
    const j = i + dir
    if (j < 0 || j >= b.length) return
    ;[b[i], b[j]] = [b[j], b[i]]
    update('bullets', b)
  }

  // Wrap the selected text of bullet `i` in markdown-style markers (** for
  // bold, * for italic), or wrap the whole bullet if nothing is selected.
  function toggleBulletFormat(i, marker) {
    const input = bulletInputRefs.current[i]
    const text = draft.bullets[i] ?? ''
    let start = input?.selectionStart ?? 0
    let end   = input?.selectionEnd   ?? text.length
    if (start === end) { start = 0; end = text.length }

    const before  = text.slice(0, start)
    const selected = text.slice(start, end)
    const after   = text.slice(end)
    const wrapped = `${marker}${selected}${marker}`
    const already = selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2
    const next = already
      ? `${before}${selected.slice(marker.length, selected.length - marker.length)}${after}`
      : `${before}${wrapped}${after}`

    updateBullet(i, next)
    requestAnimationFrame(() => input?.focus())
  }

  // ── Table helpers ──────────────────────────────────────────────────────────
  function addTableRow() {
    if (!table) return
    const emptyRow = Array(table.headers.length).fill('')
    setTable(t => ({ ...t, rows: [...t.rows, emptyRow] }))
  }

  function removeTableRow(ri) {
    setTable(t => ({ ...t, rows: t.rows.filter((_, i) => i !== ri) }))
  }

  function addTableCol() {
    setTable(t => ({
      headers: [...t.headers, `Column ${t.headers.length + 1}`],
      rows:    t.rows.map(r => [...r, '']),
    }))
  }

  function removeTableCol(ci) {
    setTable(t => ({
      headers: t.headers.filter((_, i) => i !== ci),
      rows:    t.rows.map(r => r.filter((_, i) => i !== ci)),
    }))
  }

  function setTableHeader(ci, val) {
    setTable(t => { const h = [...t.headers]; h[ci] = val; return { ...t, headers: h } })
  }

  function setTableCell(ri, ci, val) {
    setTable(t => ({ ...t, rows: t.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r) }))
  }

  function initTable() {
    setTable({ headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', ''], ['', '', '']] })
    // Give bullets and table their own non-overlapping regions by default —
    // both stay independently draggable/resizable after this.
    if (!draft.style.tableBox) {
      updateStyle('bodyBox', draft.style.bodyBox ?? { x: 0.045, y: 0.19, w: 0.829, h: 0.4 })
      updateStyle('tableBox', { x: 0.045, y: 0.6, w: 0.829, h: 0.32 })
    }
  }

  function applyPreset(preset) {
    if (!preset.bg) return
    updateStyle('bg', preset.bg)
    updateStyle('textCol', preset.text)
    updateStyle('accent', preset.accent)
  }

  function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setBgImage(ev.target.result)
      updateStyle('bgImage', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function handleContentImgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updateStyle('contentImage', ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleFreeImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const next = [...(draft.style.images || []), { src: ev.target.result, x: 0.3, y: 0.3, w: 0.3, h: 0.3 }]
      updateStyle('images', next)
    }
    reader.readAsDataURL(file)
  }

  function removeFreeImage(i) {
    updateStyle('images', draft.style.images.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    const saved = {
      ...slide,
      title:   draft.title,
      bullets: draft.bullets.filter(Boolean),
      body:    draft.bullets.filter(Boolean).join('\n'),
      source:  draft.source,
      notes:   draft.notes,
      style:   draft.style,
      table:   table && table.headers.length > 0 ? table : null,
    }
    onSave(saved)
    onClose()
  }

  return (
    <div style={fullscreen ? styles.overlayFull : styles.overlay}>
      <div style={fullscreen ? styles.modalFull : styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>Edit Slide</span>
          <div style={styles.headerBtns}>
            <button style={styles.btnFullscreen} onClick={() => setFullscreen(f => !f)}>
              {fullscreen ? '⤡ Exit fullscreen' : '⤢ Fullscreen'}
            </button>
            <button style={styles.btnSave} onClick={handleSave}>Save changes</button>
            <button style={styles.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={styles.body}>

          {/* Left — controls */}
          <div style={{ ...styles.controls, width: controlsWidth }}>
            {/* Panel tabs */}
            <div style={styles.panelTabs}>
              {[
                { id: 'content', label: 'Content' },
                { id: 'layout',  label: 'Layout' },
                { id: 'style',   label: 'Style' },
                { id: 'notes',   label: 'Notes', badge: draft.notes?.trim() ? '●' : null },
              ].map(p => (
                <button
                  key={p.id}
                  style={{ ...styles.panelTab, ...(activePanel === p.id ? styles.panelTabActive : {}) }}
                  onClick={() => setActivePanel(p.id)}
                >
                  {p.label}
                  {p.badge && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--color-accent)' }}>{p.badge}</span>}
                </button>
              ))}
            </div>

            {/* Content panel */}
            {activePanel === 'content' && (
              <div style={styles.panel}>
                <label style={styles.label}>Slide title</label>
                <input
                  style={styles.input}
                  value={draft.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="Enter slide title"
                />

                <label style={styles.label}>Bullet points</label>
                <div style={styles.bulletList}>
                  {draft.bullets.map((b, i) => (
                    <div key={i} style={styles.bulletRow}>
                      <div style={styles.bulletDragBtns}>
                        <button style={styles.microBtn} onClick={() => moveBullet(i, -1)} disabled={i === 0}>↑</button>
                        <button style={styles.microBtn} onClick={() => moveBullet(i, 1)} disabled={i === draft.bullets.length - 1}>↓</button>
                      </div>
                      <input
                        ref={el => { bulletInputRefs.current[i] = el }}
                        style={styles.bulletInput}
                        value={b}
                        onChange={e => updateBullet(i, e.target.value)}
                        placeholder={`Bullet ${i + 1}`}
                      />
                      <button style={styles.formatBtn} title="Bold" onMouseDown={e => e.preventDefault()} onClick={() => toggleBulletFormat(i, '**')}><b>B</b></button>
                      <button style={styles.formatBtn} title="Italic" onMouseDown={e => e.preventDefault()} onClick={() => toggleBulletFormat(i, '*')}><i>I</i></button>
                      <button style={styles.microBtn} onClick={() => removeBullet(i)}>✕</button>
                    </div>
                  ))}
                  <button style={styles.addBulletBtn} onClick={addBullet}>+ Add bullet</button>
                </div>

                {/* ── Table editor ── */}
                <div style={styles.tableSectionHeader}>
                  <label style={styles.label}>Data table</label>
                  {!table ? (
                    <button style={styles.microBtn} onClick={initTable}>+ Add table</button>
                  ) : (
                    <button style={{ ...styles.microBtn, color: '#ef4444', borderColor: '#ef444466' }}
                      onClick={() => setTable(null)}>Remove table</button>
                  )}
                </div>

                {table && (
                  <div style={styles.tableEditor}>
                    <div style={styles.tableScroll}>
                      <table style={styles.editorTable}>
                        <thead>
                          <tr>
                            <th style={styles.editorCorner} />
                            {table.headers.map((h, ci) => (
                              <th key={ci} style={styles.editorTh}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <input
                                    style={styles.editorHeaderInput}
                                    value={h}
                                    onChange={e => setTableHeader(ci, e.target.value)}
                                    placeholder={`Col ${ci + 1}`}
                                  />
                                  <button style={styles.microBtn} onClick={() => removeTableCol(ci)}>✕</button>
                                </div>
                              </th>
                            ))}
                            <th style={styles.editorCorner}>
                              <button style={styles.microBtn} onClick={addTableCol}>+ Col</button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, ri) => (
                            <tr key={ri}>
                              <td style={styles.editorRowNum}>{ri + 1}</td>
                              {row.map((cell, ci) => (
                                <td key={ci} style={styles.editorTd}>
                                  <input
                                    style={styles.editorCellInput}
                                    value={cell}
                                    onChange={e => setTableCell(ri, ci, e.target.value)}
                                  />
                                </td>
                              ))}
                              <td style={styles.editorTd}>
                                <button style={styles.microBtn} onClick={() => removeTableRow(ri)}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button style={styles.addBulletBtn} onClick={addTableRow}>+ Add row</button>
                  </div>
                )}

                <label style={styles.label}>Source</label>
                <input
                  style={styles.input}
                  value={draft.source}
                  onChange={e => update('source', e.target.value)}
                  placeholder="e.g. Internal CRM data, Q2 2026"
                />
              </div>
            )}

            {/* Layout panel */}
            {activePanel === 'layout' && (
              <div style={styles.panel}>
                <label style={styles.label}>Layout</label>
                <div style={styles.layoutGrid}>
                  {LAYOUTS.map(l => (
                    <button
                      key={l.id}
                      style={{ ...styles.layoutBtn, ...(draft.style.layout === l.id ? styles.layoutBtnActive : {}) }}
                      onClick={() => updateStyle('layout', l.id)}
                    >
                      <span style={styles.layoutIcon}>{l.icon}</span>
                      <span style={styles.layoutLabel}>{l.label}</span>
                    </button>
                  ))}
                </div>

                <label style={styles.label}>Background image</label>
                <div style={styles.uploadRow}>
                  <button style={styles.uploadBtn} onClick={() => bgInputRef.current?.click()}>
                    {bgImage ? '↺ Replace image' : '↑ Upload image'}
                  </button>
                  {bgImage && (
                    <button style={styles.clearBtn} onClick={() => { setBgImage(null); updateStyle('bgImage', null) }}>
                      Remove
                    </button>
                  )}
                  <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
                </div>

                <label style={styles.label}>Images (drag in preview to position/resize)</label>
                <div style={styles.uploadRow}>
                  <button style={styles.uploadBtn} onClick={() => freeImgRef.current?.click()}>+ Add image</button>
                  <input ref={freeImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFreeImageUpload} />
                </div>
                {draft.style.images?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {draft.style.images.map((img, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={img.src} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>Image {i + 1}</span>
                        <button style={styles.microBtn} onClick={() => removeFreeImage(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {(draft.style.layout === 'image-right') && (
                  <>
                    <label style={styles.label}>Content image (right panel)</label>
                    <div style={styles.uploadRow}>
                      <button style={styles.uploadBtn} onClick={() => contentImgRef.current?.click()}>
                        {draft.style.contentImage ? '↺ Replace' : '↑ Upload'}
                      </button>
                      {draft.style.contentImage && (
                        <button style={styles.clearBtn} onClick={() => updateStyle('contentImage', null)}>Remove</button>
                      )}
                      <input ref={contentImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleContentImgUpload} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Style panel */}
            {activePanel === 'style' && (
              <div style={styles.panel}>
                <label style={styles.label}>Color preset</label>
                <div style={styles.presetGrid}>
                  {BG_PRESETS.filter(p => p.bg).map(p => (
                    <button
                      key={p.label}
                      style={{ ...styles.presetBtn, background: p.bg, color: p.text, border: draft.style.bg === p.bg ? `2px solid ${p.accent}` : '0.5px solid rgba(0,0,0,0.15)' }}
                      onClick={() => applyPreset(p)}
                      title={p.label}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <label style={styles.label}>Custom background color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.bg} onChange={e => updateStyle('bg', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.bg}</span>
                </div>

                <label style={styles.label}>Text color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.textCol} onChange={e => updateStyle('textCol', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.textCol}</span>
                </div>

                <label style={styles.label}>Accent color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.accent} onChange={e => updateStyle('accent', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.accent}</span>
                </div>

                <label style={styles.label}>Font</label>
                <select style={styles.select} value={draft.style.font} onChange={e => updateStyle('font', e.target.value)}>
                  {FONTS.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes panel */}
            {activePanel === 'notes' && (
              <div style={styles.panel}>
                <label style={styles.label}>Presenter notes</label>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                  Notes appear below the slide in the preview and in the PowerPoint notes section when exported.
                </p>
                <textarea
                  style={{
                    ...styles.input,
                    minHeight: 220,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                  value={draft.notes}
                  onChange={e => update('notes', e.target.value)}
                  placeholder="Add presenter notes, talking points, or reminders for this slide…"
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                  {draft.notes?.trim().split(/\s+/).filter(Boolean).length || 0} words
                </p>
              </div>
            )}
          </div>

          {/* Drag splitter */}
          <div style={styles.splitter} onPointerDown={onSplitterPointerDown} title="Drag to resize" />

          {/* Right — live preview */}
          <div style={styles.preview}>
            <div style={styles.previewInner}>
              <div style={styles.previewLabel}>Live preview</div>
              <SlideCanvas
                slide={draft}
                bgImage={bgImage}
                table={table}
                onImagesChange={next => updateStyle('images', next)}
                onBodyBoxChange={next => updateStyle('bodyBox', next)}
                onTableBoxChange={next => updateStyle('tableBox', next)}
                onTitleChange={text => update('title', text.trim())}
                onBulletChange={(i, text) => updateBullet(i, text.trim())}
                onTableHeaderChange={(ci, text) => setTableHeader(ci, text.trim())}
                onTableCellChange={(ri, ci, text) => setTableCell(ri, ci, text.trim())}
                onSourceChange={text => update('source', text.trim())}
              />
              <div style={styles.previewHint}>
                {draft.bullets.length} bullet{draft.bullets.length !== 1 ? 's' : ''} · {draft.style.layout.replace('-', ' ')} layout
              </div>
              {/* Notes strip below canvas */}
              <div style={styles.notesStrip}>
                <div style={styles.notesStripHeader}>
                  <span style={styles.notesStripLabel}>Notes</span>
                  <button
                    style={styles.notesStripEdit}
                    onClick={() => setActivePanel('notes')}
                  >Edit</button>
                </div>
                {draft.notes?.trim()
                  ? <p style={styles.notesStripText}>{draft.notes}</p>
                  : <p style={{ ...styles.notesStripText, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No notes — click Edit to add presenter notes</p>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:            { background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  overlayFull:      { position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', padding: 0 },
  modalFull:        { background: 'var(--color-bg)', borderRadius: 0, width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'none' },
  header:           { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  headerTitle:      { fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-primary)' },
  headerBtns:       { display: 'flex', gap: 8, alignItems: 'center' },
  btnSave:          { background: 'var(--color-accent)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnClose:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  btnFullscreen:    { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  body:             { display: 'flex', flex: 1, overflow: 'hidden' },
  controls:         { flexShrink: 0, borderRight: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  splitter:         { width: 5, flexShrink: 0, cursor: 'col-resize', background: 'var(--color-border)', transition: 'background 0.15s', userSelect: 'none' },
  panelTabs:        { display: 'flex', borderBottom: '0.5px solid var(--color-border)', padding: '0 12px' },
  panelTab:         { flex: 1, padding: '10px 4px', fontSize: 12, background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: -1 },
  panelTabActive:   { color: 'var(--color-accent)', borderBottomColor: 'var(--color-accent)', fontWeight: 600 },
  panel:            { flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  label:            { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:            { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none', width: '100%' },
  bulletList:       { display: 'flex', flexDirection: 'column', gap: 6 },
  bulletRow:        { display: 'flex', alignItems: 'center', gap: 5 },
  bulletDragBtns:   { display: 'flex', flexDirection: 'column', gap: 2 },
  bulletInput:      { flex: 1, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-primary)', outline: 'none' },
  microBtn:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  formatBtn:        { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: 'var(--color-text-secondary)', lineHeight: 1.4 },
  addBulletBtn:     { background: 'none', border: '0.5px dashed var(--color-border)', borderRadius: 6, padding: '6px', fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer', textAlign: 'center' },
  tableSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tableEditor:      { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  tableScroll:      { overflowX: 'auto', border: '0.5px solid var(--color-border)', borderRadius: 6 },
  editorTable:      { borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' },
  editorCorner:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text-muted)' },
  editorTh:         { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: 0, minWidth: 80 },
  editorHeaderInput:{ border: 'none', background: 'none', padding: '4px 6px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none', width: 70 },
  editorRowNum:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '2px 6px', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', width: 24 },
  editorTd:         { border: '0.5px solid var(--color-border)', padding: 0 },
  editorCellInput:  { border: 'none', background: 'none', padding: '4px 6px', fontSize: 11, color: 'var(--color-text-primary)', outline: 'none', width: '100%', minWidth: 70 },
  layoutGrid:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  layoutBtn:        { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '10px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  layoutBtnActive:  { border: '2px solid var(--color-text-primary)', background: 'var(--color-bg-tertiary)' },
  layoutIcon:       { fontSize: 20, lineHeight: 1 },
  layoutLabel:      { fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 500 },
  uploadRow:        { display: 'flex', gap: 8, alignItems: 'center' },
  uploadBtn:        { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)' },
  clearBtn:         { background: 'none', border: '0.5px solid #ef444466', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: '#ef4444' },
  presetGrid:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  presetBtn:        { borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer', fontWeight: 500, textAlign: 'center' },
  colorRow:         { display: 'flex', alignItems: 'center', gap: 10 },
  colorPicker:      { width: 36, height: 36, border: '0.5px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', padding: 2 },
  colorVal:         { fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' },
  select:           { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, color: 'var(--color-text-primary)', width: '100%', outline: 'none' },
  preview:          { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 12, background: 'var(--color-bg-secondary)', overflow: 'auto' },
  previewInner:     { width: '100%' },
  previewLabel:     { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  previewHint:      { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' },
  notesStrip:       { marginTop: 12, border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 },
  notesStripHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  notesStripLabel:  { fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  notesStripEdit:   { fontSize: 11, background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'var(--color-text-secondary)' },
  notesStripText:   { margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
}