import React, { useState, useEffect, useCallback } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'

function deptColor(deptName) {
  const d = DEPARTMENTS.find(d => d.name.toLowerCase() === (deptName || '').toLowerCase())
  return d ? d.color : '#CD2F37'
}

function CoverSlidePreview({ scale = 1 }) {
  return <div style={{ ...S.slide, background: `url(/branding/cover-bg.jpg) center/cover no-repeat` }} />
}

function ClosingSlidePreview({ scale = 1 }) {
  return (
    <div style={{ ...S.slide, background: `url(/branding/section-bg.jpg) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 16 * scale, fontWeight: 800, color: '#fff', letterSpacing: 0.5, textAlign: 'center', width: '91%' }}>Thank You for Joining Us</span>
    </div>
  )
}

function SectionSlidePreview({ dept, scale = 1 }) {
  return (
    <div style={{ ...S.slide, background: `url(/branding/section-bg.jpg) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 18 * scale, fontWeight: 800, color: '#fff', letterSpacing: 0.5, textAlign: 'center', width: '91%' }}>{dept}</span>
    </div>
  )
}

// Positions below are lifted directly from the real template's slide3.xml
// placeholder coordinates (converted from EMU to % of slide), so this preview
// renders the same layout the pptx export actually produces — the exporter
// uses a single fixed content-slide template for every slide regardless of
// the "layout" style choice (only bgImage/contentImage are composited on top).
function ContentSlidePreview({ slide, scale = 1 }) {
  const { title, bullets = [], style = {}, table } = slide
  const tc     = style.textCol || '#1A1A1A'
  const accent = style.accent  || deptColor(slide.dept) || '#CD2F37'
  const font   = style.font    || 'Arial, sans-serif'
  const bgImg  = style.bgImage || null
  const showContentImage = style.layout === 'image-right' && style.contentImage

  const wrap = {
    ...S.slide,
    background: bgImg ? `url(${bgImg}) center/cover no-repeat` : `url(/branding/content-bg.jpg) center/cover no-repeat`,
    fontFamily: font,
    position: 'relative',
    overflow: 'hidden',
  }

  const titleEl = (
    <p style={{ position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%', fontSize: 11 * scale, fontWeight: 400, color: accent, margin: 0, lineHeight: 1.3 }}>{title}</p>
  )

  const bulletEls = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {bullets.slice(0, 6).map((b, i) => (
        <li key={i} style={{ fontSize: 8.5 * scale, color: tc, padding: `${1 * scale}px 0 ${1 * scale}px ${9 * scale}px`, position: 'relative', lineHeight: 1.4 }}>
          <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>
          {b.replace(/^[-–•]\s*/, '')}
        </li>
      ))}
    </ul>
  )

  const tableEl = table?.headers?.length > 0 ? (
    <div style={{ overflowX: 'auto', marginTop: 4 * scale }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 7.5 * scale }}>
        <thead>
          <tr>{table.headers.map((h, i) => <th key={i} style={{ background: accent, color: '#fff', padding: `${2 * scale}px ${5 * scale}px`, border: '0.5px solid rgba(255,255,255,0.2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'transparent' }}>
              {table.headers.map((_, ci) => <td key={ci} style={{ color: tc, padding: `${2 * scale}px ${5 * scale}px`, border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap' }}>{row[ci] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null

  const sourceEl = (
    <div style={{ position: 'absolute', left: '1.8%', top: '90.4%', width: '48.4%', fontSize: 6.5 * scale, fontStyle: 'italic', color: '#7F7F7F' }}>Source:</div>
  )

  return (
    <div style={wrap}>
      {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      {titleEl}
      <div style={{ position: 'absolute', left: '4.5%', top: '19%', width: showContentImage ? '52%' : '82.9%', height: '63%', overflow: 'hidden' }}>
        {bulletEls}{tableEl}
      </div>
      {showContentImage && (
        <div style={{ position: 'absolute', right: '3%', top: '19%', width: '38%', height: '63%', background: `url(${style.contentImage}) center/cover`, borderRadius: 4 }} />
      )}
      {sourceEl}
      {(style.images || []).map((img, i) => (
        <img
          key={i}
          src={img.src}
          style={{
            position: 'absolute',
            left: `${img.x * 100}%`,
            top: `${img.y * 100}%`,
            width: `${img.w * 100}%`,
            height: `${img.h * 100}%`,
            objectFit: 'cover',
          }}
        />
      ))}
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