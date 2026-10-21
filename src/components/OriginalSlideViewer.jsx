import React, { useEffect, useState, useCallback } from 'react'
import { SlideThumbnail } from './SlideCard.jsx'

// Full-size viewer for any slide (built in the platform or imported). Arrow
// keys move between slides; Esc closes.
export default function OriginalSlideViewer({ slides, startIndex = 0, onClose, onEdit, subtitle = '' }) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, slides.length - 1)))
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex(i => Math.min(slides.length - 1, i + 1)), [slides.length])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  const slide = slides[index]
  if (!slide) return null
  const original = slide.style?.original

  return (
    <div style={S.overlay} onClick={onClose} role="dialog" aria-label="View slides">
      <div style={S.header} onClick={e => e.stopPropagation()}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title}>{slide.title || 'Untitled slide'}</div>
          <div style={S.sub}>
            {original?.ref ? `${original.fileName ? `From ${original.fileName} · ` : ''}Original styling` : subtitle}
          </div>
        </div>
        <span style={S.count}>{index + 1} / {slides.length}</span>
        {onEdit && <button style={S.close} onClick={() => onEdit(slide)}>✎ Edit</button>}
        <button style={S.close} onClick={onClose}>✕ Close</button>
      </div>

      <div style={S.stage} onClick={e => e.stopPropagation()}>
        <button style={{ ...S.nav, visibility: index > 0 ? 'visible' : 'hidden' }} onClick={prev} aria-label="Previous slide">‹</button>
        <div style={S.frame}>
          <SlideThumbnail slide={slide} />
        </div>
        <button style={{ ...S.nav, visibility: index < slides.length - 1 ? 'visible' : 'hidden' }} onClick={next} aria-label="Next slide">›</button>
      </div>

      {slide.notes?.trim() && (
        <div style={S.notes} onClick={e => e.stopPropagation()}>
          <span style={{ fontWeight: 700 }}>Notes: </span>{slide.notes.trim()}
        </div>
      )}
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,10,12,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 20px', gap: 12 },
  header:  { width: '100%', maxWidth: 'min(92vw, calc((100vh - 190px) * 16 / 9 + 120px))', display: 'flex', alignItems: 'center', gap: 12, color: '#fff' },
  title:   { fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub:     { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  count:   { marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' },
  close:   { background: 'none', border: '0.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 99, padding: '5px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  stage:   { flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  frame:   { width: 'min(calc(92vw - 100px), calc((100vh - 190px) * 16 / 9))', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden', background: '#fff' },
  nav:     { background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 40, height: 64, borderRadius: 8, fontSize: 30, cursor: 'pointer', flexShrink: 0 },
  notes:   { maxWidth: 'min(92vw, 1100px)', maxHeight: 80, overflowY: 'auto', fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 12px' },
}
