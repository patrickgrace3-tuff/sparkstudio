import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'
import { parseRichText } from '../lib/richtext.js'
import { FunnelSlidePreview } from './FunnelBuilder.jsx'
import { TeamSlidePreview } from './TeamBuilder.jsx'

function RichText({ text }) {
  return parseRichText(text).map((seg, i) => {
    let node = seg.text
    if (seg.bold && seg.italic) return <strong key={i}><em>{node}</em></strong>
    if (seg.bold)   return <strong key={i}>{node}</strong>
    if (seg.italic) return <em key={i}>{node}</em>
    return <React.Fragment key={i}>{node}</React.Fragment>
  })
}

function deptColor(deptName) {
  const d = DEPARTMENTS.find(d => d.name.toLowerCase() === (deptName || '').toLowerCase())
  return d ? d.color : '#CD2F37'
}

function CoverSlidePreview() {
  return <div style={{ ...S.slide, background: `url(/branding/cover-bg.jpg) center/cover no-repeat` }} />
}

function ClosingSlidePreview() {
  return (
    <div style={{ ...S.slide, containerType: 'inline-size', background: `url(/branding/section-bg.jpg) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '5.1cqw', fontWeight: 800, color: '#fff', letterSpacing: 0.5, textAlign: 'center', width: '91%' }}>Thank You for Joining Us</span>
    </div>
  )
}

function SectionSlidePreview({ dept }) {
  return (
    <div style={{ ...S.slide, containerType: 'inline-size', background: `url(/branding/section-bg.jpg) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '5.8cqw', fontWeight: 800, color: '#fff', letterSpacing: 0.5, textAlign: 'center', width: '91%' }}>{dept}</span>
    </div>
  )
}

function ContentSlidePreview({ slide }) {
  const { title, bullets = [], style = {}, table, source } = slide
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
    containerType: 'inline-size',
  }

  const titleEl = (
    <p style={{ position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%', fontSize: '2.8cqw', fontWeight: 400, color: accent, margin: 0, lineHeight: 1.3 }}>{title}</p>
  )

  const bulletEls = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {bullets.slice(0, 6).map((b, i) => (
        <li key={i} style={{ fontSize: '1.7cqw', color: tc, padding: '0.2em 0 0.2em 1.1em', position: 'relative', lineHeight: 1.4 }}>
          <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>
          <RichText text={b.replace(/^[-–•]\s*/, '')} />
        </li>
      ))}
    </ul>
  )

  const bodyBox = style.bodyBox || { x: 0.045, y: 0.19, w: 0.829, h: 0.63 }

  const tableEl = table?.headers?.length > 0 ? (
    <div style={{ overflowX: 'auto', marginTop: '0.8cqw' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '1.2cqw' }}>
        <thead>
          <tr>{table.headers.map((h, i) => <th key={i} style={{ background: accent, color: '#fff', padding: '0.3em 0.6em', border: '0.5px solid rgba(255,255,255,0.2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'transparent' }}>
              {table.headers.map((_, ci) => <td key={ci} style={{ color: tc, padding: '0.3em 0.6em', border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap' }}>{row[ci] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null

  const sourceEl = (
    <div style={{ position: 'absolute', left: '1.8%', top: '90.4%', width: '48.4%', fontSize: '1.2cqw', fontStyle: 'italic', color: '#7F7F7F' }}>Source: {source}</div>
  )

  return (
    <div style={wrap}>
      {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      {titleEl}
      <div style={{ position: 'absolute', left: `${bodyBox.x * 100}%`, top: `${bodyBox.y * 100}%`, width: showContentImage ? '52%' : `${bodyBox.w * 100}%`, height: `${bodyBox.h * 100}%`, overflow: 'hidden' }}>
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

function buildSlideList(deck, funnelConfig, teamConfig) {
  const groups = groupByDept(deck.slides)
  const list = [{ kind: 'cover', label: 'Cover' }]
  for (const group of groups) {
    list.push({ kind: 'section', label: `${group.dept} — section`, dept: group.dept })
    for (const slide of group.slides) {
      list.push({ kind: 'content', label: group.dept, slide })
    }
  }
  if (funnelConfig?.current) {
    list.push({ kind: 'funnel', label: 'Current Funnel', funnelConfig: funnelConfig.current, funnelLabel: 'CURRENT' })
    list.push({ kind: 'funnel', label: 'Target Funnel',  funnelConfig: funnelConfig.target,  funnelLabel: 'TARGET' })
  } else if (funnelConfig) {
    list.push({ kind: 'funnel', label: 'Funnel', funnelConfig })
  }
  if (teamConfig) {
    list.push({ kind: 'team', label: 'My Team', teamConfig })
  }
  list.push({ kind: 'closing', label: 'Closing' })
  return list
}

function renderSlide(item) {
  switch (item.kind) {
    case 'cover':   return <CoverSlidePreview />
    case 'section': return <SectionSlidePreview dept={item.dept} />
    case 'closing': return <ClosingSlidePreview />
    case 'funnel':  return <FunnelSlidePreview config={item.funnelConfig} label={item.funnelLabel} />
    case 'team':    return <TeamSlidePreview config={item.teamConfig} />
    default:        return <ContentSlidePreview slide={item.slide} />
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
        {renderSlide(item)}
      </div>
      <button style={S.presenterClose} onClick={onClose}>✕ Exit</button>
      <button style={{ ...S.presenterNav, left: 16 }} onClick={(e) => { e.stopPropagation(); prev() }} disabled={index === 0}>‹</button>
      <button style={{ ...S.presenterNav, right: 16 }} onClick={(e) => { e.stopPropagation(); next() }} disabled={index === slides.length - 1}>›</button>
      <div style={S.presenterCounter}>{index + 1} / {slides.length}</div>
    </div>
  )
}

export default function PreviewPanel({ deck, funnelConfig, teamConfig, isGenerating, onExport, isExporting, onEditSlide }) {
  const [presenting,  setPresenting]  = useState(false)
  const [startIndex,  setStartIndex]  = useState(0)
  const [order,       setOrder]       = useState(null)
  const dragIdx = useRef(null)
  const overIdx = useRef(null)

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

  const baseSlides = buildSlideList(deck, funnelConfig, teamConfig)
  const slides = order ? order.map(i => baseSlides[i]) : baseSlides

  function onDragStart(e, i) {
    dragIdx.current = i
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, i) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    overIdx.current = i
  }

  function onDrop(e, i) {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === i) return
    const base = order || baseSlides.map((_, idx) => idx)
    const next = [...base]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    setOrder(next)
    dragIdx.current = null
    overIdx.current = null
  }

  function onDragEnd() {
    dragIdx.current = null
    overIdx.current = null
  }

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
            onClick={() => onExport(slides)}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export PowerPoint ↓'}
          </button>
        </div>
      </div>

      <div style={S.grid}>
        {slides.map((item, i) => (
          <div
            key={`${item.kind}-${i}`}
            draggable
            onDragStart={e => onDragStart(e, i)}
            onDragOver={e => onDragOver(e, i)}
            onDrop={e => onDrop(e, i)}
            onDragEnd={onDragEnd}
            style={{ ...S.slideWrapper, cursor: 'grab' }}
            onClick={() => { setStartIndex(i); setPresenting(true) }}
          >
            <div style={S.slideLabel}>Slide {i + 1} · {item.label}</div>
            <div style={S.slideTile}>{renderSlide(item)}</div>
            {item.kind === 'content' && (
              <div style={S.notesStrip}>
                {item.slide?.notes?.trim()
                  ? <>
                      <span style={S.notesIcon}>📝</span>
                      <span style={S.notesText}>{item.slide.notes.trim()}</span>
                    </>
                  : <span style={{ ...S.notesText, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No notes</span>
                }
                {onEditSlide && (
                  <button
                    style={S.notesEditBtn}
                    onClick={e => { e.stopPropagation(); onEditSlide(item) }}
                  >Edit</button>
                )}
              </div>
            )}
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
  slideTile:      { width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '0.5px solid var(--color-border)' },
  slide:          { width: '100%', height: '100%', boxSizing: 'border-box' },
  center:         { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:        { width: 20, height: 20, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  presenterOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  presenterStage:   { width: '85vw', maxWidth: 1280, aspectRatio: '16 / 9' },
  presenterClose:   { position: 'fixed', top: 20, right: 24, background: 'transparent', color: '#fff', border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  presenterNav:     { position: 'fixed', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 22, cursor: 'pointer' },
  presenterCounter: { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  notesStrip:       { display: 'flex', gap: 5, alignItems: 'flex-start', padding: '5px 8px', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginTop: 2 },
  notesIcon:        { fontSize: 10, flexShrink: 0, lineHeight: 1.6 },
  notesText:        { fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1 },
  notesEditBtn:     { flexShrink: 0, fontSize: 9, background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: 'var(--color-text-muted)' },
}
