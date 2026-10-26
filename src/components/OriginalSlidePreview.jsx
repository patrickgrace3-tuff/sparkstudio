import React from 'react'
import { placementOf, applyEditsToItems, effectiveEdits, TEMPLATE_W, TEMPLATE_H } from '../lib/originalSlides.js'
import FramedImage from './FramedImage.jsx'

// Preview of a slide imported with "Keep original styling": the original
// slide's content — text with its fonts, sizes and colours, shapes, pictures,
// tables and charts — scaled as one block onto the Spark Studio template
// background, as in the exported PowerPoint. Drawn from the description saved
// at import (see importPptx.js).

const ALIGN  = { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify', justLow: 'justify', thaiDist: 'justify' }
const ANCHOR = { t: 'flex-start', ctr: 'center', b: 'flex-end', just: 'space-between', dist: 'space-between' }

const CLIP = {
  triangle:      'polygon(50% 0, 100% 100%, 0 100%)',
  rtTriangle:    'polygon(0 0, 100% 100%, 0 100%)',
  diamond:       'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  parallelogram: 'polygon(25% 0, 100% 0, 75% 100%, 0 100%)',
  trapezoid:     'polygon(25% 0, 75% 0, 100% 100%, 0 100%)',
  pentagon:      'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)',
  hexagon:       'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
  octagon:       'polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%)',
  homePlate:     'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%)',
  chevron:       'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%)',
  rightArrow:    'polygon(0 25%, 70% 25%, 70% 0, 100% 50%, 70% 100%, 70% 75%, 0 75%)',
  leftArrow:     'polygon(30% 0, 30% 25%, 100% 25%, 100% 75%, 30% 75%, 30% 100%, 0 50%)',
  upArrow:       'polygon(50% 0, 100% 30%, 75% 30%, 75% 100%, 25% 100%, 25% 30%, 0 30%)',
  downArrow:     'polygon(25% 0, 75% 0, 75% 70%, 100% 70%, 50% 100%, 0 70%, 25% 70%)',
  plus:          'polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)',
}
const RADIUS = { ellipse: '50%', roundRect: '8%', round2SameRect: '8% 8% 0 0', snipRoundRect: '8%', flowChartTerminator: '50%' }

const shadowCss = (sh, u) => (sh ? `${u(sh.dx)} ${u(sh.dy)} ${u(sh.blur)} ${sh.color}` : undefined)

const fontStack = f => `${f ? `"${f}", ` : ''}${f === 'Calibri' ? 'Carlito, ' : ''}Arial, sans-serif`

function autoNumber(type, n) {
  const roman = num => {
    const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
    let out = ''
    for (const [v, s] of map) while (num >= v) { out += s; num -= v }
    return out
  }
  const alpha = num => String.fromCharCode(96 + ((num - 1) % 26) + 1)
  const base = /^alphaLc/.test(type) ? alpha(n) : /^alphaUc/.test(type) ? alpha(n).toUpperCase()
    : /^romanLc/.test(type) ? roman(n) : /^romanUc/.test(type) ? roman(n).toUpperCase() : String(n)
  if (/ParenBoth$/.test(type)) return `(${base})`
  if (/ParenR$/.test(type)) return `${base})`
  if (/Plain$/.test(type)) return base
  return `${base}.`
}

// Renders a text body. u(emu) and pt(points) give CSS lengths for the block.
function TextBody({ text, u, pt, fallbackColor = '#000000' }) {
  const counters = {}
  const scale = text.fontScale ?? 1
  return text.paras.map((p, pi) => {
    const firstRun = p.runs.find(r => !r.br) ?? { sz: p.endSz }
    const size = (firstRun.sz ?? p.endSz ?? 18) * scale
    const lh = p.lnSpc?.pct != null ? Math.max(0.6, p.lnSpc.pct * 1.2 * (1 - (text.lnRed ?? 0))) : p.lnSpc?.pt != null ? pt(p.lnSpc.pt * scale) : 1.2 * (1 - (text.lnRed ?? 0))
    const space = sp => (sp?.pt != null ? pt(sp.pt * scale) : sp?.pct != null ? pt(sp.pct * size * 1.2) : 0)
    let bullet = null
    if (p.bullet && p.runs.some(r => r.t?.trim())) {
      let mark = p.bullet.char
      if (p.bullet.auto) {
        const key = `${p.lvl}|${p.bullet.auto}`
        counters[key] = (counters[key] ?? p.bullet.start - 1) + 1
        mark = autoNumber(p.bullet.auto, counters[key])
      }
      const hang = p.indent < 0 ? u(-p.indent) : '1em'
      bullet = (
        <span style={{ display: 'inline-block', minWidth: hang, textIndent: 0, color: p.buColor ?? firstRun.color ?? fallbackColor, fontSize: pt(size * (p.buSize ?? 1)), fontFamily: p.buFont && !/Wingdings|Symbol/.test(p.buFont) ? fontStack(p.buFont) : undefined }}>
          {/Wingdings/.test(p.buFont ?? '') ? '▪' : mark}
        </span>
      )
    } else {
      for (const k of Object.keys(counters)) if (k.startsWith(`${p.lvl}|`)) delete counters[k]
    }
    return (
      <div key={pi} style={{
        fontSize: pt(size), // line boxes are sized from this, so it must match the text
        textAlign: ALIGN[p.algn] ?? 'left',
        paddingLeft: u(Math.max(0, p.marL)),
        textIndent: p.indent ? u(p.indent) : 0,
        lineHeight: lh, marginTop: space(p.spcBef), marginBottom: space(p.spcAft),
        minHeight: pt((p.endSz ?? 18) * scale * 1.2),
        whiteSpace: text.wrap ? 'pre-wrap' : 'pre', wordBreak: 'break-word',
      }}>
        {bullet}
        {p.runs.map((r, ri) => r.br ? <br key={ri} /> : (
          <span key={ri} style={{
            fontSize: pt(r.sz * scale * (r.baseline ? 0.7 : 1)),
            color: r.color ?? fallbackColor,
            fontWeight: r.b ? 700 : 400,
            fontStyle: r.i ? 'italic' : 'normal',
            textDecoration: [r.u && 'underline', r.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
            fontFamily: fontStack(r.font),
            verticalAlign: r.baseline > 0 ? 'super' : r.baseline < 0 ? 'sub' : undefined,
            textTransform: r.caps ? 'uppercase' : undefined,
          }}>{r.t}</span>
        ))}
        {!p.runs.some(r => r.t) && '​'}
      </div>
    )
  })
}

function TextLayer({ text, u, pt, style }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      justifyContent: ANCHOR[text.anchor] ?? 'flex-start',
      padding: `${u(text.ins[1])} ${u(text.ins[2])} ${u(text.ins[3])} ${u(text.ins[0])}`,
      boxSizing: 'border-box', ...style,
    }}>
      <TextBody text={text} u={u} pt={pt} />
    </div>
  )
}

function Item({ item, u, pt, aspect }) {
  const box = {
    position: 'absolute',
    left: `${item.x * 100}%`, top: `${item.y * 100}%`,
    width: `${item.w * 100}%`, height: `${item.h * 100}%`,
    transform: item.rot ? `rotate(${item.rot}deg)` : undefined,
  }
  const flip = [item.flipH && 'scaleX(-1)', item.flipV && 'scaleY(-1)'].filter(Boolean).join(' ') || undefined

  if (item.type === 'line') {
    const width = u(Math.max(item.line.w, 6350))
    const style = item.line.dash !== 'solid' ? 'dashed' : 'solid'
    // Straight horizontal or vertical lines have no height or width to draw an SVG in
    if (!item.h || !item.w) {
      return <div style={{ ...box, boxSizing: 'content-box', [!item.h ? 'borderTop' : 'borderLeft']: `${width} ${style} ${item.line.color}`, height: item.h ? box.height : 0, width: item.w ? box.width : 0 }} />
    }
    const [x1, x2] = item.flipH ? [100, 0] : [0, 100]
    const [y1, y2] = item.flipV ? [100, 0] : [0, 100]
    return (
      <svg style={{ ...box, overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={item.line.color} vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: u(Math.max(item.line.w, 6350)) }} strokeDasharray={item.line.dash !== 'solid' ? '4 3' : undefined} />
      </svg>
    )
  }

  if (item.type === 'image') {
    const [l, t, r, b] = item.crop ?? [0, 0, 0, 0]
    return (
      <FramedImage
        img={{ src: item.src, x: item.x, y: item.y, w: item.w, h: item.h, crop: { l, t, r, b }, radius: item.radius ?? 0 }}
        areaAspect={aspect}
        style={{ transform: item.rot ? `rotate(${item.rot}deg)` : undefined, boxShadow: shadowCss(item.shadow, u), border: item.line ? `${u(item.line.w)} solid ${item.line.color}` : undefined, boxSizing: 'border-box' }}
        imgStyle={{ transform: flip }}
      />
    )
  }

  if (item.type === 'table') {
    const { cols, rows } = item.table
    const total = cols.reduce((a, b) => a + b, 0) || 1
    const edge = (cell, i) => {
      const ln = cell.lines?.[i]
      if (ln === null) return 'none'
      if (ln) return `${u(ln.w)} solid ${ln.color}`
      return cell.border ? `${u(12700)} solid ${cell.border}` : 'none'
    }
    return (
      <div style={box}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{cols.map((c, i) => <col key={i} style={{ width: `${(c / total) * 100}%` }} />)}</colgroup>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ height: u(row.h) }}>
                {row.cells.map((cell, ci) => cell.skip ? null : (
                  <td key={ci} colSpan={cell.span} rowSpan={cell.rowSpan} style={{
                    background: cell.fill ?? 'transparent',
                    borderLeft: edge(cell, 0), borderRight: edge(cell, 1), borderTop: edge(cell, 2), borderBottom: edge(cell, 3),
                    padding: `${u(cell.ins[1])} ${u(cell.ins[2])} ${u(cell.ins[3])} ${u(cell.ins[0])}`,
                    verticalAlign: cell.anchor === 'ctr' ? 'middle' : cell.anchor === 'b' ? 'bottom' : 'top',
                    overflow: 'hidden',
                  }}>
                    {cell.text && <TextBody text={{ ...cell.text, wrap: true }} u={u} pt={pt} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // shape (with optional text)
  const clip = CLIP[item.geom]
  return (
    <div style={box}>
      {(item.fill || item.line) && (
        <div style={{
          position: 'absolute', inset: 0, background: item.fill ?? 'transparent',
          border: item.line && !clip ? `${u(item.line.w)} ${item.line.dash !== 'solid' ? 'dashed' : 'solid'} ${item.line.color}` : 'none',
          borderRadius: item.geom === 'roundRect' && item.radius ? `${item.radius * Math.min(item.w, item.h / aspect) * 100}cqw` : RADIUS[item.geom] ?? 0,
          clipPath: clip, transform: flip, boxSizing: 'border-box',
          boxShadow: item.fill && !clip ? shadowCss(item.shadow, u) : undefined,
        }} />
      )}
      {item.text && <TextLayer text={item.text} u={u} pt={pt} />}
    </div>
  )
}

export const TITLE_COLOR = '#CD2F37'
const TITLE_STYLE = {
  position: 'absolute', left: '15.25%', top: '5.1%', width: '77.9%', height: '8.33%',
  display: 'flex', alignItems: 'center', fontFamily: 'Arial, sans-serif',
  fontSize: '2.8cqw', fontWeight: 700, color: TITLE_COLOR, lineHeight: 1.1, // the template's title style is bold
  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
}

export function TemplateSlide({ p, fill, edits = null, children = null, clip = true, title = '' }) {
  // Same placement as the export: the area the (unedited) content covers,
  // scaled and centred — then any edits made in the app
  const eff = effectiveEdits(p, edits)
  const { s, dx, dy } = placementOf(p, p.slideW, p.slideH, eff)
  const items = applyEditsToItems(p.items ?? [], eff)
  const fit = { x: dx / TEMPLATE_W, y: dy / TEMPLATE_H, w: (s * p.slideW) / TEMPLATE_W, h: (s * p.slideH) / TEMPLATE_H }
  // Lengths inside the block, relative to its width (container query units)
  const u  = emu => `${(emu / p.slideW) * 100}cqw`
  const pt = points => `${((points * 12700) / p.slideW) * 100}cqw`
  return (
    <div style={{
      position: 'relative', overflow: clip ? 'hidden' : 'visible', aspectRatio: '16 / 9',
      background: 'url(/branding/content-bg.jpg) center/cover no-repeat #fff',
      containerType: 'inline-size',
      ...(fill ? { width: '100%', height: '100%' } : { width: '100%', borderRadius: 4 }),
    }}>
      {/* Slide title in the template's title area — same place and Spark red as slides made in the platform */}
      {title?.trim() && <div style={TITLE_STYLE}>{title}</div>}
      <div style={{
        position: 'absolute', left: `${fit.x * 100}%`, top: `${fit.y * 100}%`,
        width: `${fit.w * 100}%`, height: `${fit.h * 100}%`, containerType: 'inline-size',
        fontFamily: 'Arial, sans-serif',
      }}>
        {items.map((it, i) => <Item key={i} item={it} u={u} pt={pt} aspect={p.slideW / p.slideH} />)}
        {children}
      </div>
    </div>
  )
}

// Slides imported before the template look was added
const PT_CQW = 100 / 960
function LegacyItem({ item }) {
  const box = { position: 'absolute', left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.w * 100}%`, height: `${item.h * 100}%` }
  if (item.type === 'rect') return <div style={{ ...box, background: item.color, borderRadius: item.round ? '50%' : 0 }} />
  if (item.type === 'image') return <img src={item.src} alt="" style={{ ...box, objectFit: 'fill' }} />
  if (item.type === 'table') return null
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', justifyContent: ANCHOR[item.anchor] ?? 'flex-start', padding: '0.4cqw 0.7cqw', boxSizing: 'border-box', overflow: 'hidden', color: item.color, fontSize: `${(item.fontPt ?? 18) * PT_CQW}cqw`, lineHeight: 1.2, textAlign: ALIGN[item.align] ?? item.align ?? 'left' }}>
      {String(item.text ?? '').split('\n').map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{l.replace(/\*\*/g, '')}</div>)}
    </div>
  )
}

export default function OriginalSlidePreview({ original, fill = false }) {
  const p = original?.preview ?? {}
  if (p.version >= 2) {
    if (!fill) return <TemplateSlide p={p} edits={original.edits} title={original.headerTitle} />
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TemplateSlide p={p} fill edits={original.edits} title={original.headerTitle} />
      </div>
    )
  }
  const bg = p.background?.image ? `url(${p.background.image}) center/cover no-repeat` : (p.background?.color ?? '#FFFFFF')
  return (
    <div style={{ position: 'relative', overflow: 'hidden', containerType: 'inline-size', aspectRatio: `${p.aspect ?? 16 / 9}`, background: bg, ...(fill ? { height: '100%', maxWidth: '100%', margin: '0 auto' } : { width: '100%', borderRadius: 4 }) }}>
      {(p.items ?? []).map((it, i) => <LegacyItem key={i} item={it} />)}
    </div>
  )
}
