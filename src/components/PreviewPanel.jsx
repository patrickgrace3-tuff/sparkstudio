import React from 'react'
import { DEPARTMENTS } from '../lib/constants.js'

function deptColor(deptName) {
  const d = DEPARTMENTS.find(d => d.name.toLowerCase() === (deptName || '').toLowerCase())
  return d ? d.color : '#CD2F37'
}

function CoverSlidePreview() {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #8B0000 0%, #1a0000 60%, #111 100%)', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '20px 28px' }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>SPARK STUDIO</div>
        <div style={{ fontSize: 13, color: '#CD2F37', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>PRESENTATION</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>The Center for Conversion's Factory of Ideas</div>
      </div>
    </div>
  )
}

function ClosingSlidePreview() {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #1a0000 0%, #111 100%)', minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>Thank You for Joining Us</span>
      <div style={{ width: 40, height: 2, background: '#CD2F37', borderRadius: 1 }} />
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>Spark Studio</span>
    </div>
  )
}

function SectionSlidePreview({ dept }) {
  return (
    <div style={{ ...S.slide, background: 'linear-gradient(135deg, #1a0000 0%, #111 100%)', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{dept}</span>
    </div>
  )
}

function ContentSlidePreview({ slide }) {
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
    padding: '12px 14px',
    minHeight: 120,
    display: 'flex',
    flexDirection: layout === 'title-left' ? 'row' : 'column',
    position: 'relative',
    overflow: 'hidden',
  }

  const titleEl = <p style={{ fontSize: 12, fontWeight: 700, color: accent, margin: '0 0 6px', lineHeight: 1.3 }}>{title}</p>
  const bar     = <div style={{ height: 2, background: accent, borderRadius: 1, marginBottom: 7, width: layout === 'centered' ? '30%' : '100%', alignSelf: layout === 'centered' ? 'center' : 'auto' }} />
  const bulletEls = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {bullets.slice(0, 5).map((b, i) => (
        <li key={i} style={{ fontSize: 10, color: tc, padding: '1px 0 1px 10px', position: 'relative', lineHeight: 1.4 }}>
          <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>
          {b.replace(/^[-–•]\s*/, '')}
        </li>
      ))}
    </ul>
  )

  const tableEl = table?.headers?.length > 0 ? (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 8 }}>
        <thead>
          <tr>{table.headers.map((h, i) => <th key={i} style={{ background: accent, color: '#fff', padding: '2px 5px', border: '0.5px solid rgba(255,255,255,0.2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
              {table.headers.map((_, ci) => <td key={ci} style={{ color: tc, padding: '2px 5px', border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap' }}>{row[ci] ?? ''}</td>)}
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
        <div style={{ width: '35%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, zIndex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'center', margin: 0 }}>{title}</p>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', zIndex: 1 }}>{bulletEls}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.slice(0, half).map((b, i) => <li key={i} style={{ fontSize: 10, color: tc, padding: '1px 0 1px 10px', position: 'relative', lineHeight: 1.4 }}><span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{b.replace(/^[-–•]\s*/, '')}</li>)}
            </ul>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.slice(half).map((b, i) => <li key={i} style={{ fontSize: 10, color: tc, padding: '1px 0 1px 10px', position: 'relative', lineHeight: 1.4 }}><span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{b.replace(/^[-–•]\s*/, '')}</li>)}
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
        <div style={{ flex: 1, zIndex: 1 }}>{titleEl}{bar}{bulletEls}</div>
        <div style={{ width: '38%', background: style.contentImage ? `url(${style.contentImage}) center/cover` : '#333', marginLeft: 8, borderRadius: 4, zIndex: 1 }} />
      </div>
    )
  }

  // full-image + default title-top
  return (
    <div style={wrap}>
      {bgImg && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
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

export default function PreviewPanel({ deck, isGenerating, onExport, isExporting }) {
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

  const groups   = groupByDept(deck.slides)
  // Count total slides: 1 cover + 1 section per group + all content slides
  const total    = 1 + groups.length + deck.slides.length + 1 // +1 for closing slide
  let   slideNum = 1

  return (
    <div style={S.wrapper}>
      <div style={S.toolbar}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {total} slides · Spark Studio template
        </span>
        <button
          style={{ ...S.exportBtn, opacity: isExporting ? 0.5 : 1, cursor: isExporting ? 'not-allowed' : 'pointer' }}
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting…' : 'Export PowerPoint ↓'}
        </button>
      </div>

      <div style={S.grid}>
        {/* Cover */}
        <div style={S.slideWrapper}>
          <div style={S.slideLabel}>Slide {slideNum++} · Cover</div>
          <CoverSlidePreview />
        </div>

        {/* One section divider per dept, then all that dept's content slides */}
        {groups.map(group => (
          <React.Fragment key={group.dept}>
            <div style={S.slideWrapper}>
              <div style={S.slideLabel}>Slide {slideNum++} · {group.dept} — section</div>
              <SectionSlidePreview dept={group.dept} />
            </div>
            {group.slides.map((slide, i) => (
              <div key={i} style={S.slideWrapper}>
                <div style={S.slideLabel}>Slide {slideNum++} · {group.dept}</div>
                <ContentSlidePreview slide={slide} />
              </div>
            ))}
          </React.Fragment>
        ))}
        {/* Fixed closing slide */}
        <div style={S.slideWrapper}>
          <div style={S.slideLabel}>Slide {slideNum} · Closing</div>
          <ClosingSlidePreview />
        </div>
      </div>
    </div>
  )
}

const S = {
  wrapper:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  toolbar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '0.5px solid var(--color-border)' },
  exportBtn:    { background: '#CD2F37', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600 },
  grid:         { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignContent: 'start' },
  slideWrapper: { display: 'flex', flexDirection: 'column', gap: 5 },
  slideLabel:   { fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 },
  slide:        { borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--color-border)' },
  center:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:      { width: 20, height: 20, border: '2px solid var(--color-border)', borderTopColor: '#CD2F37', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
}