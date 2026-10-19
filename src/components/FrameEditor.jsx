import React, { useRef, useEffect } from 'react'
import { fullRect, cropFrom, cropOf } from '../lib/imageFrame.js'

// PowerPoint-style selection frame for one element on a slide.
//   • Drag to move (it can go partly off the slide — nothing snaps back)
//   • 8 handles: corners keep the shape's proportions (images; Shift toggles),
//     sides stretch one way
//   • Images: double-click (or the Crop button) for crop mode — the whole
//     picture shows faded, side/corner handles trim the frame, dragging moves
//     the picture underneath, the faded picture's corners scale it. Enter or
//     Esc finishes.
// frame = { x, y, w, h } in fractions of the area (areaRef); crop as in
// imageFrame.js. onChange gets { x, y, w, h, crop? }.

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
const MIN = 0.01

const pos = (h, r) => ({
  left: `${(h.includes('w') ? r.x : h.includes('e') ? r.x + r.w : r.x + r.w / 2) * 100}%`,
  top:  `${(h.includes('n') ? r.y : h.includes('s') ? r.y + r.h : r.y + r.h / 2) * 100}%`,
})

export default function FrameEditor({
  frame, areaRef, selected, onSelect, onChange, onChangeEnd,
  image = null, cropMode = false, onCropModeChange, keepAspect = false,
  onDoubleClick, accent = '#2563eb', title,
}) {
  const drag = useRef(null)
  const latest = useRef({ onChange, onChangeEnd })
  latest.current = { onChange, onChangeEnd }

  useEffect(() => {
    if (!selected || !cropMode) return
    const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onCropModeChange?.(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, cropMode, onCropModeChange])

  function start(e, kind, handle = null) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    // preventDefault keeps focus where it was — let a text box being typed in
    // finish, so keys (Delete, arrows) apply to the selected element
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.()
    if (!selected) onSelect?.()
    const rect = areaRef.current.getBoundingClientRect()
    const crop = image ? cropOf(image) : null
    drag.current = {
      kind, handle, rect, sx: e.clientX, sy: e.clientY,
      frame: { ...frame },
      full: image ? fullRect({ ...frame, crop }) : null,
      moved: false,
    }
    const move = ev => {
      const d = drag.current
      if (!d) return
      const dx = (ev.clientX - d.sx) / d.rect.width
      const dy = (ev.clientY - d.sy) / d.rect.height
      if (!d.moved && Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) < 2) return
      d.moved = true
      const next = compute(d, dx, dy, ev.shiftKey)
      if (next) latest.current.onChange(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (drag.current?.moved) latest.current.onChangeEnd?.()
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function compute(d, dx, dy, shift) {
    const f = d.frame
    if (d.kind === 'move') return { ...f, x: f.x + dx, y: f.y + dy, ...(image ? { crop: cropOf(image) } : {}) }

    if (d.kind === 'resize') {
      const r = resizeRect(f, d.handle, dx, dy, (keepAspect !== shift) && d.handle.length === 2)
      return { ...r, ...(image ? { crop: cropOf(image) } : {}) }
    }

    // Crop mode
    const full = d.full
    if (d.kind === 'crop') {
      let x1 = f.x, y1 = f.y, x2 = f.x + f.w, y2 = f.y + f.h
      if (d.handle.includes('w')) x1 = Math.min(x2 - MIN, Math.max(full.x, x1 + dx))
      if (d.handle.includes('e')) x2 = Math.max(x1 + MIN, Math.min(full.x + full.w, x2 + dx))
      if (d.handle.includes('n')) y1 = Math.min(y2 - MIN, Math.max(full.y, y1 + dy))
      if (d.handle.includes('s')) y2 = Math.max(y1 + MIN, Math.min(full.y + full.h, y2 + dy))
      const nf = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
      return { ...nf, crop: cropFrom(nf, full) }
    }
    if (d.kind === 'pan') {
      // Move the picture under the frame; the frame always stays covered
      const nx = Math.min(f.x, Math.max(f.x + f.w - full.w, full.x + dx))
      const ny = Math.min(f.y, Math.max(f.y + f.h - full.h, full.y + dy))
      const nfull = { ...full, x: nx, y: ny }
      return { ...f, crop: cropFrom(f, nfull) }
    }
    if (d.kind === 'scalePic') {
      // Scale the whole picture from the opposite corner, keeping its shape
      const r = resizeRect(full, d.handle, dx, dy, true)
      // The frame shows only what's left of the picture
      const x1 = Math.max(f.x, r.x), y1 = Math.max(f.y, r.y)
      const x2 = Math.min(f.x + f.w, r.x + r.w), y2 = Math.min(f.y + f.h, r.y + r.h)
      if (x2 - x1 < MIN || y2 - y1 < MIN) return null
      const nf = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
      return { ...nf, crop: cropFrom(nf, r) }
    }
    return null
  }

  const full = image ? fullRect({ ...frame, crop: cropOf(image) }) : null
  const box = r => ({ position: 'absolute', left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` })
  const handle = (h, r, kind, color) => (
    <div
      key={`${kind}-${h}`}
      onPointerDown={e => start(e, kind, h)}
      style={{
        position: 'absolute', ...pos(h, r), transform: 'translate(-50%, -50%)',
        width: kind === 'crop' ? (h.length === 2 ? 12 : h === 'n' || h === 's' ? 16 : 5) : 10,
        height: kind === 'crop' ? (h.length === 2 ? 12 : h === 'e' || h === 'w' ? 16 : 5) : 10,
        background: kind === 'crop' ? '#111' : '#fff',
        border: kind === 'crop' ? '1.5px solid #fff' : `1.5px solid ${color}`,
        borderRadius: kind === 'scalePic' ? '50%' : kind === 'crop' ? 1 : 2,
        cursor: CURSOR[h], zIndex: 6, pointerEvents: 'auto', boxSizing: 'border-box',
      }}
    />
  )

  return (
    <>
      {/* Crop mode: the whole picture, faded, behind the frame */}
      {selected && cropMode && image && (
        <>
          <div
            onPointerDown={e => start(e, 'pan')}
            style={{ ...box(full), pointerEvents: 'auto', cursor: 'move', zIndex: 4, outline: '1px dashed rgba(0,0,0,0.5)' }}
          >
            <img src={image.src} alt="" draggable={false} style={{ width: '100%', height: '100%', opacity: 0.35, display: 'block', pointerEvents: 'none' }} />
          </div>
          {['nw', 'ne', 'se', 'sw'].map(h => handle(h, full, 'scalePic', accent))}
        </>
      )}

      {/* The frame */}
      <div
        title={title}
        onPointerDown={e => start(e, selected && cropMode ? 'pan' : 'move')}
        onDoubleClick={e => {
          e.stopPropagation()
          if (image) onCropModeChange?.(!cropMode)
          else onDoubleClick?.()
        }}
        style={{
          ...box(frame), pointerEvents: 'auto', zIndex: selected ? 5 : 3,
          cursor: selected && cropMode ? 'move' : 'move',
          outline: selected ? `1.5px solid ${cropMode ? '#111' : accent}` : 'none',
          outlineOffset: 0, boxSizing: 'border-box',
        }}
      />
      {selected && !cropMode && HANDLES.map(h => handle(h, frame, 'resize', accent))}
      {selected && cropMode && HANDLES.map(h => handle(h, frame, 'crop', accent))}
    </>
  )
}

// Moves the edges named by the handle; with keepRatio the opposite corner stays put
function resizeRect(f, h, dx, dy, keepRatio) {
  let x1 = f.x, y1 = f.y, x2 = f.x + f.w, y2 = f.y + f.h
  if (h.includes('w')) x1 = Math.min(x2 - MIN, x1 + dx)
  if (h.includes('e')) x2 = Math.max(x1 + MIN, x2 + dx)
  if (h.includes('n')) y1 = Math.min(y2 - MIN, y1 + dy)
  if (h.includes('s')) y2 = Math.max(y1 + MIN, y2 + dy)
  if (keepRatio && h.length === 2) {
    const ratio = f.w / f.h
    let w = x2 - x1, hh = y2 - y1
    // Follow whichever way the pointer moved further
    if (Math.abs(w / f.w - 1) >= Math.abs(hh / f.h - 1)) hh = w / ratio
    else w = hh * ratio
    if (h.includes('w')) x1 = x2 - w; else x2 = x1 + w
    if (h.includes('n')) y1 = y2 - hh; else y2 = y1 + hh
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
