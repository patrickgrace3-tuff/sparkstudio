import React, { useState, useEffect, useCallback } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'

function deptColor(deptName) {
  const d = DEPARTMENTS.find(d => d.name.toLowerCase() === (deptName || '').toLowerCase())
  return d ? d.color : '#CD2F37'
}

function CoverSlidePreview({ scale = 1 }) {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #8B0000 0%, #1a0000 60%, #111 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: 20 * scale }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11 * scale, fontWeight: 800, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>SPARK STUDIO</div>
        <div style={{ fontSize: 13 * scale, color: '#CD2F37', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 * scale }}>PRESENTATION</div>
        <div style={{ fontSize: 10 * scale, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>The Center for Conversion's Factory of Ideas</div>
      </div>
    </div>
  )
}

function ClosingSlidePreview({ scale = 1 }) {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #1a0000 0%, #111 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 * scale }}>
      <span style={{ fontSize: 16 * scale, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>Thank You for Joining Us</span>
      <div style={{ width: 40 * scale, height: 2, background: '#CD2F37', borderRadius: 1 }} />
      <span style={{ fontSize: 9 * scale, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>Spark Studio</span>
    </div>
  )
}

function SectionSlidePreview({ dept, scale = 1 }) {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #1a0000 0%, #111 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 18 * scale, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{dept}</span>
    </div>
  )
}

function ContentSlidePreview({ slide, scale = 1 }) {
  const { title, bullets = [], style = {}, table } = slide
  const bg     = style.bg      || '#1a1a1a'
  const tc     = style.textCol || 'rgba(255,255,255,0.88)'
  const accent = style.accent  || deptColor(slide.dept)
  const font   = style.font    || 'Arial, sans-serif'
  const bgImg  = style.bgImage || null
  const layout = style.layout  || 'title-top'

  const wrap = {
    ...S.slide,
    background: bgImg ? `url(${bgImg}) center/cover no-repeat` : bg,
    fontFamily: font,
    padding: `${12 * scale}px ${14 * scale}px`,
    display: 'flex',
    flexDirection: layout === 'title-left' ? 'row' : 'column',
    position: 'relative',
    overflow: 'hidden',
  }

  const titleEl = <p style={{ fontSize: 12 * scale, fontWeight: 700, color: accent, margin: `0 0 ${6 * scale}px`, lineHeight: 1.3 }}>{title}</p>
  const bar     = <div style={{ height: 2, background: accent, borderRadius: 1, marginBottom: 7 * scale, width: layout === 'centered' ? '30%' : '100%', alignSelf: layout === 'centered' ? 'center' : 'auto' }} />
  const bulletEls = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {bullets.slice(0, 5).map((b, i) => (
        <li key={i} style={{ fontSize: 10 * scale, color: tc, padding: `${1 * scale}px 0 ${1 * scale}px ${10 * scale}px`, position: 'relative', lineHeight: 1.4 }}>
          <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>
          {b.replace(/^[-–•]\s*/, '')}
        </li>
      ))}
    </ul>
  )

  const tableEl = table?.headers?.length > 0 ? (
    <div style={{ overflowX: 'auto', marginTop: 4 * scale }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 8 * scale }}>
        <thead>
          <tr>{table.headers.map((h, i) => <th key={i} style={{ background: accent, color: '#fff', padding: `${2 * scale}px ${5 * scale}px`, border: '0.5px solid rgba(255,255,255,0.2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
              {table.headers.map((_, ci) => <td key={ci} style={{ color: tc, padding: `${2 * scale}px ${5 * scale}px`, border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap' }}>{row[ci] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null

  if (layout === 'title-left') {
    return (
      <div style={wrap}>
        {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />}
        <div style={{ width: '35%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 * scale, zIndex: 1 }}>
          <p style={{ fontSize: 11 * scale, fontWeight: 700, color: '#fff', textAlign: 'center', margin: 0 }}>{title}</p>
        </div>
        <div style={{ flex: 1, padding: `${8 * scale}px ${10 * scale}px`, zIndex: 1, overflow: 'hidden' }}>{bulletEls}</div>
      </div>
    )
  }

  if (layout === 'centered') {
    return (
      <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          {titleEl}{bar}{bulletEls}
        </div>
      </div>
    )
  }

  if (layout === 'split') {
    const half = Math.ceil(bullets.length / 2)
    return (
      <div style={wrap}>
        {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />}
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          {titleEl}{bar}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${10 * scale}px` }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.slice(0, half).map((b, i) => <li key={i} style={{ fontSize: 10 * scale, color: tc, padding: `${1 * scale}px 0 ${1 * scale}px ${10 * scale}px`, position: 'relative', lineHeight: 1.4 }}><span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{b.replace(/^[-–•]\s*/, '')}</li>)}
            </ul>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.slice(half).map((b, i) => <li key={i} style={{ fontSize: 10 * scale, color: tc, padding: `${1 * scale}px 0 ${1 * scale}px ${10 * scale}px`, position: 'relative', lineHeight: 1.4 }}><span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{b.replace(/^[-–•]\s*/, '')}</li>)}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'image-right') {
    return (
      <div style={{ ...wrap, flexDirection: 'row' }}>
        {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />}
        <div style={{ flex: 1, zIndex: 1, overflow: 'hidden' }}>{titleEl}{bar}{bulletEls}</div>
        <div style={{ width: '38%', background: style.contentImage ? `url(${style.contentImage}) center/cover` : '#333', marginLeft: 8 * scale, borderRadius: 4, zIndex: 1 }} />
      </div>
    )
  }

  // full-image + default title-top
  return (
    <div style={wrap}>
      {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', overflow: 'hidden' }}>
        {titleEl}{bar}{bulletEls}{tableEl}
      </div>
    </div>
  )
}

// ── Group slides by department (one section per dept) ─────────────────────────
function groupByDept(slides) {
  const groups = []
  let current  = null
  for (const slide of slides) {
    if (!current || current.dept !== slide.dept) {
      current = { dept: slide.dept, slides: [] }
      groups.push(current)
    }
    current.slides.push(slide)
  }
  return groups
}

// ── Build a flat, ordered list of slide descriptors shared by grid + presenter view ──
function buildSlideList(deck) {
  const groups = groupByDept(deck.slides)
  const list = [{ kind: 'cover', label: 'Cover' }]
  for (const group of groups) {
    list.push({ kind: 'section', label: `${group.dept} — section`, dept: group.dept })
    for (const slide of group.slides) {
      list.push({ kind: 'content', label: group.dept, slide })
    }
  }
  list.push({ kind: 'closing', label: 'Closing' })
  return list
}

function renderSlide(item, scale = 1) {
  switch (item.kind) {
    case 'cover':   return <CoverSlidePreview scale={scale} />
    case 'section': return <SectionSlidePreview dept={item.dept} scale={scale} />
    case 'closing': return <ClosingSlidePreview scale={scale} />
    default:        return <ContentSlidePreview slide={item.slide} scale={scale} />
  }
}

function PresenterView({ slides, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)

  const next = useCallback(() => setIndex(i => Math.min(i + 1, slides.length - 1)), [slides.length])
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  const item = slides[index]

  return (
    <div style={S.presenterOverlay} onClick={onClose}>
      <div style={S.presenterStage} onClick={(e) => e.stopPropagation()}>
        {renderSlide(item, 4)}
      </div>
      <button style={S.presenterClose} onClick={onClose}>✕ Exit</button>
      <button style={{ ...S.presenterNav, left: 16 }} onClick={(e) => { e.stopPropagation(); prev() }} disabled={index === 0}>‹</button>
      <button style={{ ...S.presenterNav, right: 16 }} onClick={(e) => { e.stopPropagation(); next() }} disabled={index === slides.length - 1}>›</button>
      <div style={S.presenterCounter}>{index + 1} / {slides.length}</div>
    </div>
  )
}

export default function PreviewPanel({ deck, isGenerating, onExport, isExporting }) {
  const [presenting, setPresenting] = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  if (isGenerating) {
    return (
      <div style={S.center}>
        <div style={S.spinner} />
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>AI agent is assembling the deck…</p>
      </div>
    )
  }

  if (!deck) {
    return (
      <div style={S.center}>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Generate the presentation to see a preview</p>
      </div>
    )
  }

  const slides = buildSlideList(deck)

  return (
    <div style={S.wrapper}>
      <div style={S.toolbar}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {slides.length} slides · Spark Studio template
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={S.presentBtn}
            onClick={() => { setStartIndex(0); setPresenting(true) }}
          >
            ▶ Present
          </button>
          <button
            style={{ ...S.exportBtn, opacity: isExporting ? 0.5 : 1, cursor: isExporting ? 'not-allowed' : 'pointer' }}
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export PowerPoint ↓'}
          </button>
        </div>
      </div>

      <div style={S.grid}>
        {slides.map((item, i) => (
          <div
            key={i}
            style={S.slideWrapper}
            onClick={() => { setStartIndex(i); setPresenting(true) }}
          >
            <div style={S.slideLabel}>Slide {i + 1} · {item.label}</div>
            <div style={S.slideTile}>{renderSlide(item, 1)}</div>
          </div>
        ))}
      </div>

      {presenting && (
        <PresenterView slides={slides} startIndex={startIndex} onClose={() => setPresenting(false)} />
      )}
    </div>
  )
}

const S = {
  wrapper:        { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  toolbar:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '0.5px solid var(--color-border)' },
  presentBtn:     { background: 'transparent', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  exportBtn:      { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid:           { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignContent: 'start' },
  slideWrapper:   { display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer' },
  slideLabel:     { fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 },
  // Fixed 16:9 box so every slide tile renders at the same size/shape regardless of content
  slideTile:      { width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '0.5px solid var(--color-border)' },
  slide:          { width: '100%', height: '100%', boxSizing: 'border-box' },
  center:         { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:        { width: 20, height: 20, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  presenterOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  presenterStage:   { width: '85vw', maxWidth: 1280, aspectRatio: '16 / 9' },
  presenterClose:   { position: 'fixed', top: 20, right: 24, background: 'transparent', color: '#fff', border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  presenterNav:     { position: 'fixed', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 22, cursor: 'pointer' },
  presenterCounter: { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 13 },
}