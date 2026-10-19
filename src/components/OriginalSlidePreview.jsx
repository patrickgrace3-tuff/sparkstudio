import React from 'react'

// Preview of a slide imported with "Keep original styling". Draws the
// description saved at import (background, shapes, pictures, tables and text
// at their original positions). It's a close likeness for the app — the export
// copies the real slide in unchanged.

const PT_CQW = 100 / 960 // 1pt as a share of a 13.33" (960pt) wide slide

const ALIGN  = { ctr: 'center', r: 'right', just: 'justify', l: 'left' }
const ANCHOR = { ctr: 'center', b: 'flex-end', t: 'flex-start' }

function Item({ item }) {
  const box = {
    position: 'absolute',
    left: `${item.x * 100}%`, top: `${item.y * 100}%`,
    width: `${item.w * 100}%`, height: `${item.h * 100}%`,
  }
  if (item.type === 'rect') {
    return <div style={{ ...box, background: item.color, borderRadius: item.round ? '50%' : 0 }} />
  }
  if (item.type === 'image') {
    return <img src={item.src} alt="" style={{ ...box, objectFit: 'fill' }} />
  }
  if (item.type === 'table') {
    const { headers = [], rows = [] } = item.table ?? {}
    const n = rows.length + 1
    return (
      <div style={{ ...box, overflow: 'hidden' }}>
        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: `${Math.max(0.7, Math.min(1.4, 22 / n))}cqw` }}>
          <thead><tr>{headers.map((h, i) => <th key={i} style={{ background: '#44546A', color: '#fff', border: '1px solid #fff', padding: '0.2em 0.4em', textAlign: 'left', overflow: 'hidden' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>{headers.map((_, ci) => <td key={ci} style={{ background: ri % 2 ? '#E9EBF5' : '#CFD5EA', border: '1px solid #fff', padding: '0.2em 0.4em', color: '#1a1a1a', overflow: 'hidden' }}>{r[ci] ?? ''}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  // text
  const lines = String(item.text ?? '').split('\n')
  return (
    <div style={{
      ...box, display: 'flex', flexDirection: 'column', justifyContent: ANCHOR[item.anchor] ?? 'flex-start',
      padding: '0.4cqw 0.7cqw', boxSizing: 'border-box', overflow: 'hidden',
      color: item.color, fontSize: `${(item.fontPt ?? 18) * PT_CQW}cqw`, lineHeight: 1.2, textAlign: ALIGN[item.align] ?? 'left',
    }}>
      {lines.map((l, i) => {
        const text = l.replace(/\*\*/g, '')
        return (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: '1.2em', ...(item.bullets && text.trim() ? { paddingLeft: '1em', textIndent: '-0.8em' } : {}) }}>
            {item.bullets && text.trim() ? '• ' : ''}{text}
          </div>
        )
      })}
    </div>
  )
}

export default function OriginalSlidePreview({ original, fill = false, rounded = false }) {
  const p = original?.preview ?? {}
  const bg = p.background?.image
    ? `url(${p.background.image}) center/cover no-repeat`
    : (p.background?.color ?? '#FFFFFF')
  const slide = (
    <div style={{
      position: 'relative', overflow: 'hidden', containerType: 'inline-size',
      aspectRatio: `${p.aspect ?? 16 / 9}`, background: bg, fontFamily: 'Calibri, Arial, sans-serif',
      borderRadius: rounded ? 4 : 0,
      ...(fill ? { height: '100%', maxWidth: '100%' } : { width: '100%' }),
    }}>
      {(p.items ?? []).map((it, i) => <Item key={i} item={it} />)}
    </div>
  )
  if (!fill) return slide
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      {slide}
    </div>
  )
}
