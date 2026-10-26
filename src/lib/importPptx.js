import JSZip from 'jszip'
import { emfToDataUrl } from './emf.js'
import { themeContext, resolveSlideShapes, resolveChartXml, resolvedTableStyle, defaultTableStyleId, tableStyleLook, colorOf, schemeHex } from './pptxResolve.js'

// Reads a .pptx and extracts each slide's content — title, bullets, free text
// boxes, pictures, tables, charts (redrawn as images), SmartArt text and speaker notes — with
// positions remapped onto the Spark Studio template's content area. The
// source deck's own design (backgrounds, masters, layouts) is not carried over.

const NS_A   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_P   = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const NS_R   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_C   = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const NS_DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

// Template content area (fractions of the 16:9 slide) — below the title bar,
// above the Source line. Matches the editor's default bodyBox.
const TARGET   = { x: 0.045, y: 0.19, w: 0.91, h: 0.69 }
const TPL_W    = 12192000
const TPL_H    = 6858000
const SKIP_PH  = new Set(['sldNum', 'dt', 'ftr', 'hdr', 'sldImg'])
// Pictures are kept sharp: only very large ones are scaled down
const MAX_IMG_DIM   = 2560
const MAX_IMG_BYTES = 1200 * 1024

const parseXml = xml => new DOMParser().parseFromString(xml, 'text/xml')
const kids = (el, ns, name) => Array.from(el?.childNodes ?? []).filter(n => n.namespaceURI === ns && n.localName === name)
const kid  = (el, ns, name) => kids(el, ns, name)[0] ?? null
const desc = (el, ns, name) => el?.getElementsByTagNameNS(ns, name)[0] ?? null

// ── Paths & relationships ─────────────────────────────────────────────────────
function resolvePath(base, target) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

async function loadRels(zip, partPath) {
  const dir  = partPath.split('/').slice(0, -1).join('/')
  const file = zip.file(`${dir}/_rels/${partPath.split('/').pop()}.rels`)
  const map  = {}
  if (!file) return map
  const doc = parseXml(await file.async('string'))
  for (const r of doc.getElementsByTagNameNS(NS_PKG, 'Relationship')) {
    if (r.getAttribute('TargetMode') === 'External') continue
    map[r.getAttribute('Id')] = { path: resolvePath(partPath, r.getAttribute('Target')), type: r.getAttribute('Type') ?? '' }
  }
  return map
}

// ── Text ──────────────────────────────────────────────────────────────────────
// Paragraph → markdown-style rich text (**bold**, *italic*) used across the app
function paragraphText(p) {
  const runs = []
  for (const n of Array.from(p.childNodes)) {
    if (n.namespaceURI !== NS_A) continue
    if (n.localName === 'br') { runs.push({ t: ' ', b: false, i: false }); continue }
    if (n.localName === 'fld' && n.getAttribute('type') === 'slidenum') continue
    if (n.localName !== 'r' && n.localName !== 'fld') continue
    const rPr = kid(n, NS_A, 'rPr')
    runs.push({
      t: kid(n, NS_A, 't')?.textContent ?? '',
      b: rPr?.getAttribute('b') === '1',
      i: rPr?.getAttribute('i') === '1',
    })
  }
  // Merge adjacent runs with the same formatting so markers don't nest oddly
  const merged = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (last && last.b === r.b && last.i === r.i) last.t += r.t
    else merged.push({ ...r })
  }
  return merged.map(({ t, b, i }) => {
    const core = t.trim().replace(/\*/g, '')
    if (!core || (!b && !i)) return t
    const mark = b && i ? '***' : b ? '**' : '*'
    const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0]
    return `${lead}${mark}${core}${mark}${trail}`
  }).join('').trim()
}

function bodyParagraphs(txBody) {
  if (!txBody) return []
  return kids(txBody, NS_A, 'p').map(paragraphText).filter(Boolean)
}

function plainText(el) {
  return Array.from(el.getElementsByTagNameNS(NS_A, 't')).map(t => t.textContent).join('').trim()
}

function firstFontSize(el) {
  for (const tag of ['rPr', 'defRPr', 'endParaRPr']) {
    for (const r of el.getElementsByTagNameNS(NS_A, tag)) {
      const sz = r.getAttribute('sz')
      if (sz) return parseInt(sz, 10) / 100
    }
  }
  return null
}

function alignOf(txBody) {
  const algn = desc(txBody, NS_A, 'pPr')?.getAttribute('algn')
  return algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left'
}

// ── Geometry ──────────────────────────────────────────────────────────────────
function readXfrm(xfrm) {
  const off = kid(xfrm, NS_A, 'off'), ext = kid(xfrm, NS_A, 'ext')
  if (!off || !ext) return null
  return { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx'), h: +ext.getAttribute('cy') }
}

// Group shapes store children in their own coordinate space (chOff/chExt)
function groupTransform(grpSp, parent) {
  const xfrm = kid(kid(grpSp, NS_P, 'grpSpPr'), NS_A, 'xfrm')
  const b    = readXfrm(xfrm)
  const chOff = kid(xfrm, NS_A, 'chOff'), chExt = kid(xfrm, NS_A, 'chExt')
  if (!b || !chOff || !chExt) return parent
  const cx = +chOff.getAttribute('x'), cy = +chOff.getAttribute('y')
  const cw = +chExt.getAttribute('cx') || 1, ch = +chExt.getAttribute('cy') || 1
  return r => parent({
    x: b.x + (r.x - cx) * (b.w / cw),
    y: b.y + (r.y - cy) * (b.h / ch),
    w: r.w * (b.w / cw),
    h: r.h * (b.h / ch),
  })
}

function placeholderInfo(el, nvTag) {
  const ph = desc(kid(el, NS_P, nvTag), NS_P, 'ph')
  if (!ph) return null
  return { type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') ?? null }
}

// Placeholders usually inherit their position from the layout, then the master
async function placeholderPositions(zip, slideRels) {
  const out = { layout: [], master: [] }
  const layoutRel = Object.values(slideRels).find(r => r.type.endsWith('/slideLayout'))
  if (!layoutRel || !zip.file(layoutRel.path)) return out
  const collect = doc => Array.from(doc.getElementsByTagNameNS(NS_P, 'sp')).map(sp => ({
    ph: placeholderInfo(sp, 'nvSpPr'),
    rect: readXfrm(desc(kid(sp, NS_P, 'spPr'), NS_A, 'xfrm')),
  })).filter(p => p.ph && p.rect)
  out.layout = collect(parseXml(await zip.file(layoutRel.path).async('string')))
  const masterRel = Object.values(await loadRels(zip, layoutRel.path)).find(r => r.type.endsWith('/slideMaster'))
  if (masterRel && zip.file(masterRel.path)) out.master = collect(parseXml(await zip.file(masterRel.path).async('string')))
  return out
}

function inheritedRect(ph, positions) {
  const norm = t => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t)
  for (const list of [positions.layout, positions.master]) {
    const hit = (ph.idx != null && list.find(p => p.ph.idx === ph.idx)) || list.find(p => norm(p.ph.type) === norm(ph.type))
    if (hit) return hit.rect
  }
  return null
}

// ── Images ────────────────────────────────────────────────────────────────────
const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }

async function bytesToDataUrl(bytes, mime) {
  let blob = new Blob([bytes], { type: mime })
  // Downscale/re-encode large or non-PNG/JPEG images so they stay small in the
  // database and export cleanly (the exporter embeds PNG/JPEG/GIF).
  const needsResize = bytes.length > MAX_IMG_BYTES || mime === 'image/bmp' || mime === 'image/webp'
  if (needsResize && typeof createImageBitmap === 'function') {
    try {
      const bmp   = await createImageBitmap(blob)
      const scale = Math.min(1, MAX_IMG_DIM / Math.max(bmp.width, bmp.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(bmp.width * scale))
      canvas.height = Math.max(1, Math.round(bmp.height * scale))
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
      const outMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
      const resized = await new Promise(res => canvas.toBlob(res, outMime, 0.92))
      if (resized && resized.size < blob.size) blob = resized
      else if (mime !== 'image/png' && mime !== 'image/jpeg' && resized) blob = resized
    } catch { /* keep original */ }
  }
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload  = () => res(fr.result)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}

async function loadImage(zip, rels, rId) {
  const rel = rels[rId]
  if (!rel) return null
  const ext  = rel.path.split('.').pop().toLowerCase()
  const mime = IMG_MIME[ext]
  const file = zip.file(rel.path)
  // EMF (Office's format for pasted pictures): the bitmap inside, as a PNG
  if (ext === 'emf' && file && typeof document !== 'undefined') return emfToDataUrl(await file.async('uint8array'))
  if (!mime || !file) return null // WMF/SVG/TIFF can't be rendered in the browser
  return bytesToDataUrl(await file.async('uint8array'), mime)
}

// A picture's cropping (srcRect) and rounded corners (roundRect/ellipse frame)
function pictureLook(spPr, blipFill) {
  const src = desc(blipFill, NS_A, 'srcRect')
  const v = k => +(src?.getAttribute(k) ?? 0) / 100000
  const geom = kid(spPr, NS_A, 'prstGeom')
  const prst = geom?.getAttribute('prst')
  let radius = 0
  if (prst === 'roundRect') {
    const fmla = Array.from(geom.getElementsByTagNameNS(NS_A, 'gd')).find(g => g.getAttribute('name') === 'adj')?.getAttribute('fmla')
    radius = Math.min(0.5, (fmla ? +fmla.replace(/^val\s+/, '') : 16667) / 100000)
  } else if (prst === 'ellipse') radius = 0.5
  return { crop: { l: v('l'), t: v('t'), r: v('r'), b: v('b') }, radius }
}

// ── Tables, charts, SmartArt ──────────────────────────────────────────────────
function readTable(tbl) {
  const rows = kids(tbl, NS_A, 'tr')
    .map(tr => kids(tr, NS_A, 'tc').map(tc => bodyParagraphs(kid(tc, NS_A, 'txBody')).join(' ')))
    .filter(r => r.some(c => c))
  if (!rows.length) return null
  const [headers, ...body] = rows
  return { headers, rows: body }
}

async function readChart(zip, rels, rId) {
  const rel = rels[rId]
  if (!rel || !zip.file(rel.path)) return null
  return readChartXml(await zip.file(rel.path).async('string'))
}

function readChartXml(xml) {
  const doc    = parseXml(xml)
  const points = el => {
    const out = []
    for (const pt of el?.getElementsByTagNameNS(NS_C, 'pt') ?? []) out[+pt.getAttribute('idx')] = desc(pt, NS_C, 'v')?.textContent ?? ''
    return out
  }
  const plotArea = desc(doc, NS_C, 'plotArea')
  const typeEl   = Array.from(plotArea?.childNodes ?? []).find(n => n.namespaceURI === NS_C && /Chart$/.test(n.localName))
  const type     = typeEl?.localName ?? 'barChart'
  const horizontal = desc(typeEl, NS_C, 'barDir')?.getAttribute('val') === 'bar'
  const series = Array.from(doc.getElementsByTagNameNS(NS_C, 'ser')).map((ser, i) => ({
    name:   desc(kid(ser, NS_C, 'tx'), NS_C, 'v')?.textContent ?? `Series ${i + 1}`,
    cats:   points(kid(ser, NS_C, 'cat') ?? kid(ser, NS_C, 'xVal')),
    values: points(kid(ser, NS_C, 'val') ?? kid(ser, NS_C, 'yVal')).map(v => Number(v) || 0),
    color:  desc(desc(kid(ser, NS_C, 'spPr'), NS_A, 'solidFill'), NS_A, 'srgbClr')?.getAttribute('val') ?? null,
    pointColors: kids(ser, NS_C, 'dPt').reduce((acc, dPt) => {
      const c = desc(desc(kid(dPt, NS_C, 'spPr'), NS_A, 'solidFill'), NS_A, 'srgbClr')?.getAttribute('val')
      if (c) acc[+(kid(dPt, NS_C, 'idx')?.getAttribute('val') ?? 0)] = `#${c}`
      return acc
    }, []),
  }))
  if (!series.length) return null
  const titleEl = kid(desc(doc, NS_C, 'chart'), NS_C, 'title')
  const title   = titleEl ? plainText(titleEl) : ''
  const cats    = series[0].cats.length ? series[0].cats : series[0].values.map((_, i) => String(i + 1))
  return { type, horizontal, title, cats, series }
}

// Draws the chart's data as a PNG so it lands on the template as an image
const PALETTE = ['#CD2F37', '#1E2761', '#378ADD', '#1D9E75', '#F59E0B', '#7F77DD', '#D85A30', '#36454F']

function renderChartImage(chart, rect) {
  const W = 800, H = Math.max(240, Math.min(1100, Math.round(W * (rect.h / Math.max(1, rect.w)))))
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H)
  g.font = '22px Arial'; g.textBaseline = 'middle'
  const colorOf = (s, i) => (s.color ? `#${s.color}` : PALETTE[i % PALETTE.length])
  const fmt = v => (Math.abs(v) >= 1000 ? v.toLocaleString() : String(Math.round(v * 100) / 100))
  let top = 20
  if (chart.title) {
    g.font = 'bold 30px Arial'; g.fillStyle = '#1a1a1a'; g.textAlign = 'center'
    g.fillText(chart.title, W / 2, top + 18); top += 50; g.font = '22px Arial'
  }

  const isPie = chart.type === 'pieChart' || chart.type === 'doughnutChart' || chart.type === 'pie3DChart'
  // Legend (series for bar/line, categories for pie)
  const legend = isPie ? chart.cats.map((c, i) => ({ label: c, color: chart.series[0].pointColors?.[i] ?? (chart.series[0].color && i === 0 ? `#${chart.series[0].color}` : PALETTE[i % PALETTE.length]) }))
    : chart.series.length > 1 ? chart.series.map((s, i) => ({ label: s.name, color: colorOf(s, i) })) : []
  const bottomPad = legend.length ? 60 : 20
  if (legend.length) {
    g.textAlign = 'left'
    const widths = legend.map(l => 34 + g.measureText(l.label).width + 24)
    let x = Math.max(10, (W - widths.reduce((a, b) => a + b, 0)) / 2)
    legend.forEach((l, i) => {
      g.fillStyle = l.color; g.fillRect(x, H - 40, 22, 22)
      g.fillStyle = '#333'; g.fillText(l.label, x + 30, H - 29); x += widths[i]
    })
  }

  if (isPie) {
    const vals  = chart.series[0].values
    const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1
    const r  = Math.min(W, H - top - bottomPad) / 2 - 20
    const cx = W / 2, cy = top + (H - top - bottomPad) / 2
    let a = -Math.PI / 2
    vals.forEach((v, i) => {
      const sweep = (Math.max(0, v) / total) * Math.PI * 2
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a, a + sweep); g.closePath()
      g.fillStyle = legend[i]?.color ?? PALETTE[i % PALETTE.length]; g.fill()
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke()
      if (sweep > 0.25) {
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 22px Arial'
        g.fillText(`${Math.round((v / total) * 100)}%`, cx + Math.cos(a + sweep / 2) * r * 0.65, cy + Math.sin(a + sweep / 2) * r * 0.65)
      }
      a += sweep
    })
    if (chart.type === 'doughnutChart') { g.beginPath(); g.arc(cx, cy, r * 0.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill() }
    return canvas.toDataURL('image/png')
  }

  const all  = chart.series.flatMap(s => s.values)
  const max  = Math.max(0, ...all), min = Math.min(0, ...all)
  const span = max - min || 1
  g.font = '20px Arial'
  const left = 20 + (chart.horizontal ? Math.max(...chart.cats.map(c => g.measureText(String(c)).width), 40) : g.measureText(fmt(max)).width + 10)
  const plot = { x: left + 10, y: top + 10, w: W - left - 40, h: H - top - bottomPad - 60 }
  const n = chart.cats.length, k = chart.series.length
  g.strokeStyle = '#999'; g.lineWidth = 2

  if (chart.horizontal) {
    const zeroX = plot.x + ((0 - min) / span) * plot.w
    g.beginPath(); g.moveTo(zeroX, plot.y); g.lineTo(zeroX, plot.y + plot.h); g.stroke()
    const band = plot.h / n, barH = (band * 0.75) / k
    chart.cats.forEach((c, ci) => {
      g.fillStyle = '#333'; g.textAlign = 'right'; g.fillText(String(c), plot.x - 10, plot.y + band * ci + band / 2)
      chart.series.forEach((s, si) => {
        const v = s.values[ci] ?? 0, x1 = plot.x + ((Math.min(0, v) - min) / span) * plot.w
        const y = plot.y + band * ci + band * 0.125 + barH * si
        g.fillStyle = colorOf(s, si); g.fillRect(x1, y, (Math.abs(v) / span) * plot.w, barH - 2)
        g.fillStyle = '#333'; g.textAlign = 'left'; g.fillText(fmt(v), x1 + (Math.abs(v) / span) * plot.w + 6, y + barH / 2)
      })
    })
    return canvas.toDataURL('image/png')
  }

  const yOf  = v => plot.y + plot.h - ((v - min) / span) * plot.h
  g.beginPath(); g.moveTo(plot.x, yOf(0)); g.lineTo(plot.x + plot.w, yOf(0)); g.stroke()
  g.fillStyle = '#666'; g.textAlign = 'right'
  g.fillText(fmt(max), plot.x - 8, yOf(max)); if (min < 0) g.fillText(fmt(min), plot.x - 8, yOf(min))
  const band = plot.w / n
  g.textAlign = 'center'; g.fillStyle = '#333'
  chart.cats.forEach((c, ci) => g.fillText(String(c), plot.x + band * ci + band / 2, plot.y + plot.h + 26))

  if (chart.type === 'lineChart' || chart.type === 'areaChart' || chart.type === 'scatterChart') {
    chart.series.forEach((s, si) => {
      g.strokeStyle = colorOf(s, si); g.fillStyle = colorOf(s, si); g.lineWidth = 5
      g.beginPath()
      s.values.forEach((v, ci) => { const x = plot.x + band * ci + band / 2; ci ? g.lineTo(x, yOf(v)) : g.moveTo(x, yOf(v)) })
      g.stroke()
      s.values.forEach((v, ci) => {
        const x = plot.x + band * ci + band / 2
        g.beginPath(); g.arc(x, yOf(v), 7, 0, Math.PI * 2); g.fill()
        if (k === 1) { g.fillStyle = '#333'; g.fillText(fmt(v), x, yOf(v) - 22); g.fillStyle = colorOf(s, si) }
      })
    })
    return canvas.toDataURL('image/png')
  }

  const barW = (band * 0.75) / k
  chart.series.forEach((s, si) => {
    s.values.forEach((v, ci) => {
      const x = plot.x + band * ci + band * 0.125 + barW * si
      const y = yOf(Math.max(0, v)), h = Math.abs(yOf(v) - yOf(0))
      g.fillStyle = colorOf(s, si); g.fillRect(x, y, barW - 3, h)
      g.fillStyle = '#333'; g.textAlign = 'center'; g.fillText(fmt(v), x + barW / 2, v >= 0 ? y - 14 : y + h + 14)
    })
  })
  return canvas.toDataURL('image/png')
}

async function readSmartArtText(zip, rels, relIds) {
  const rId = relIds?.getAttributeNS(NS_R, 'dm')
  const rel = rId && rels[rId]
  if (!rel || !zip.file(rel.path)) return []
  const doc = parseXml(await zip.file(rel.path).async('string'))
  const lines = []
  for (const t of doc.getElementsByTagNameNS(NS_DGM, 't')) lines.push(...bodyParagraphs(t))
  return lines
}

// ── Slide walk ────────────────────────────────────────────────────────────────
async function collectElements(zip, rels, positions, container, transform, out) {
  for (const el of Array.from(container.childNodes)) {
    if (el.namespaceURI !== NS_P) continue

    if (el.localName === 'grpSp') {
      await collectElements(zip, rels, positions, el, groupTransform(el, transform), out)
      continue
    }

    if (el.localName === 'sp') {
      const ph = placeholderInfo(el, 'nvSpPr')
      if (ph && SKIP_PH.has(ph.type)) continue
      const spPr = kid(el, NS_P, 'spPr')
      let rect   = readXfrm(kid(spPr, NS_A, 'xfrm'))
      if (!rect && ph) rect = inheritedRect(ph, positions)
      if (rect) rect = transform(rect)

      // Shape filled with a picture
      const blip = desc(kid(spPr, NS_A, 'blipFill'), NS_A, 'blip')
      if (blip && rect) {
        const src = await loadImage(zip, rels, blip.getAttributeNS(NS_R, 'embed'))
        if (src) out.push({ kind: 'image', rect, src, ...pictureLook(spPr, kid(spPr, NS_A, 'blipFill')) })
      }

      const txBody = kid(el, NS_P, 'txBody')
      const lines  = bodyParagraphs(txBody)
      if (!lines.length) continue
      out.push({ kind: 'text', ph, rect, lines, fontSize: firstFontSize(txBody), align: alignOf(txBody) })
      continue
    }

    if (el.localName === 'pic') {
      const rect = readXfrm(desc(kid(el, NS_P, 'spPr'), NS_A, 'xfrm'))
      const blip = desc(kid(el, NS_P, 'blipFill'), NS_A, 'blip')
      if (!rect || !blip) continue
      const src = await loadImage(zip, rels, blip.getAttributeNS(NS_R, 'embed'))
      if (src) out.push({ kind: 'image', rect: transform(rect), src, ...pictureLook(kid(el, NS_P, 'spPr'), kid(el, NS_P, 'blipFill')) })
      continue
    }

    if (el.localName === 'graphicFrame') {
      const rect = readXfrm(kid(el, NS_P, 'xfrm'))
      const data = desc(el, NS_A, 'graphicData')
      if (!rect || !data) continue
      const uri = data.getAttribute('uri') ?? ''
      if (uri.endsWith('/table')) {
        const table = readTable(desc(data, NS_A, 'tbl'))
        if (table) out.push({ kind: 'table', rect: transform(rect), table })
      } else if (uri.endsWith('/chart')) {
        const chartRef = desc(data, NS_C, 'chart')
        const chart = chartRef && await readChart(zip, rels, chartRef.getAttributeNS(NS_R, 'id'))
        const r = transform(rect)
        if (chart) out.push({ kind: 'image', rect: r, src: renderChartImage(chart, r) })
      } else if (uri.endsWith('/diagram')) {
        const lines = await readSmartArtText(zip, rels, desc(data, NS_DGM, 'relIds'))
        if (lines.length) out.push({ kind: 'text', ph: null, rect: transform(rect), lines, fontSize: null, align: 'left' })
      }
    }
  }
}

async function readNotes(zip, rels) {
  const rel = Object.values(rels).find(r => r.type.endsWith('/notesSlide'))
  if (!rel || !zip.file(rel.path)) return ''
  const doc = parseXml(await zip.file(rel.path).async('string'))
  for (const sp of doc.getElementsByTagNameNS(NS_P, 'sp')) {
    if (placeholderInfo(sp, 'nvSpPr')?.type === 'body') return bodyParagraphs(kid(sp, NS_P, 'txBody')).join('\n')
  }
  return ''
}

// ── Build the Spark Studio slide ──────────────────────────────────────────────
function buildSlide(elements, slideW, slideH, notes) {
  const isTitlePh = e => e.kind === 'text' && (e.ph?.type === 'title' || e.ph?.type === 'ctrTitle')
  let titleEl = elements.find(isTitlePh)
  // No title placeholder → topmost short text near the top of the slide
  if (!titleEl) {
    titleEl = elements
      .filter(e => e.kind === 'text' && e.rect && e.rect.y < slideH * 0.2 && e.lines.length <= 2)
      .sort((a, b) => a.rect.y - b.rect.y)[0]
  }
  let title = titleEl ? titleEl.lines.join(' ').replace(/\*/g, '') : ''

  // "Source: …" text becomes the slide's source line
  let source = ''
  const rest = elements.filter(e => {
    if (e === titleEl) return false
    if (e.kind === 'text' && /^source[s]?\s*:/i.test(e.lines[0]?.replace(/\*/g, '') ?? '')) {
      source = e.lines.join(' ').replace(/\*/g, '').replace(/^sources?\s*:\s*/i, '')
      return false
    }
    // Small images hugging the top/bottom edge are almost always logos or
    // decoration from the source deck — the template supplies its own.
    if (e.kind === 'image' && e.rect) {
      const small = (e.rect.w * e.rect.h) / (slideW * slideH) < 0.02
      const cy    = (e.rect.y + e.rect.h / 2) / slideH
      if (small && (cy < 0.12 || cy > 0.88)) return false
    }
    return true
  })

  // Uniformly scale the remaining content's bounding box into the template's
  // content area so the relative layout (and image aspect ratios) survive.
  const placed = rest.filter(e => e.rect)
  const bb = placed.reduce((b, { rect: r }) => ({
    x1: Math.min(b.x1, r.x), y1: Math.min(b.y1, r.y),
    x2: Math.max(b.x2, r.x + r.w), y2: Math.max(b.y2, r.y + r.h),
  }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity })
  const tw = TARGET.w * TPL_W, th = TARGET.h * TPL_H
  const natural = TPL_W / slideW
  const scale = placed.length
    ? Math.min(natural, tw / Math.max(1, bb.x2 - bb.x1), th / Math.max(1, bb.y2 - bb.y1))
    : natural
  const offX = TARGET.x * TPL_W + (placed.length ? (tw - (bb.x2 - bb.x1) * scale) / 2 : 0)
  const offY = TARGET.y * TPL_H
  const round = v => Math.round(v * 10000) / 10000
  const toBox = r => r ? {
    x: round((offX + (r.x - bb.x1) * scale) / TPL_W),
    y: round((offY + (r.y - bb.y1) * scale) / TPL_H),
    w: round((r.w * scale) / TPL_W),
    h: round((r.h * scale) / TPL_H),
  } : null

  const style = {}
  const freeTextBoxes = []
  const images = []
  let bullets = []
  let table = null

  // Main body placeholder → bullets; every other text shape → free text box
  const bodyEl = rest.find(e => e.kind === 'text' && e.ph && !isTitlePh(e))
  // Only one native table per slide; any others become text boxes
  const primaryTable = rest.find(e => e.kind === 'table')
  for (const e of rest) {
    const box = toBox(e.rect)
    if (e.kind === 'image') {
      images.push({ src: e.src, ...box, crop: e.crop ?? { l: 0, t: 0, r: 0, b: 0 }, ...(e.radius ? { radius: e.radius } : {}) })
    } else if (e.kind === 'table') {
      if (e === primaryTable) {
        table = { headers: e.table.headers, rows: e.table.rows }
        if (box) style.tableBox = box
      } else {
        const lines = [e.table.headers.join(' | '), ...e.table.rows.map(r => r.join(' | '))]
        freeTextBoxes.push({ text: lines.join('\n'), box: box ?? { x: 0.045, y: 0.55, w: 0.829, h: 0.25 }, fontSize: 10 })
      }
    } else if (e === bodyEl) {
      bullets = e.lines
      if (box) style.bodyBox = box
    } else {
      freeTextBoxes.push({
        text: e.lines.join('\n'),
        box: box ?? { x: 0.045, y: 0.55, w: 0.829, h: 0.25 },
        fontSize: Math.max(8, Math.round((e.fontSize ?? 18) * scale)),
        textAlign: e.align,
      })
    }
  }

  // No title anywhere → promote the first line of content
  if (!title) {
    if (bullets.length) title = bullets.shift().replace(/\*/g, '')
    else if (freeTextBoxes.length && !freeTextBoxes[0].text.includes('\n')) title = freeTextBoxes.shift().text.replace(/\*/g, '')
  }

  if (images.length) style.images = images
  return {
    title: title || 'Imported Slide',
    bullets,
    body: bullets.join('\n'),
    table,
    source,
    notes,
    freeTextBoxes: freeTextBoxes.length ? freeTextBoxes : null,
    style,
  }
}

export async function importSlidesFromPptx(file) {
  const zip = await JSZip.loadAsync(file)

  let slideW = TPL_W, slideH = TPL_H
  const presXml = zip.file('ppt/presentation.xml')
  if (presXml) {
    const sz = desc(parseXml(await presXml.async('string')), NS_P, 'sldSz')
    if (sz) { slideW = +sz.getAttribute('cx') || slideW; slideH = +sz.getAttribute('cy') || slideH }
  }

  // Collect slide files in numeric order
  const slideEntries = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const num = s => parseInt(s.match(/(\d+)\.xml$/)[1])
      return num(a) - num(b)
    })

  const slides = []
  for (const path of slideEntries) {
    const doc    = parseXml(await zip.file(path).async('string'))
    if (doc.documentElement.getAttribute('show') === '0') continue // hidden slide
    const rels   = await loadRels(zip, path)
    const spTree = desc(doc, NS_P, 'spTree')
    if (!spTree) continue
    const positions = await placeholderPositions(zip, rels)
    const elements  = []
    await collectElements(zip, rels, positions, spTree, r => r, elements)
    if (!elements.length) continue
    slides.push(buildSlide(elements, slideW, slideH, await readNotes(zip, rels)))
  }

  return slides
}

// ── Keep original styling ─────────────────────────────────────────────────────
// For "Keep original styling" imports the slide's own parts are kept (the
// slide, its pictures and charts, plus the layout, master and theme its look
// comes from). The export turns them into stand-alone shapes on the Spark
// Studio template (see pptxResolve.js) so text, fonts, sizes, colours, images,
// tables and charts stay exactly as they were. A description of the result is
// saved for previews.

const TEXT_PART = /\.(xml|rels|vml)$/i

// Pictures in previews only need to look sharp on screen (the export uses the
// original files), so big ones are scaled down — this keeps saved slides small
const PREVIEW_MAX_PX = 1600
const PREVIEW_MIN_BYTES = 150000
async function previewPicture(dataUrl) {
  if (!dataUrl || dataUrl.length < PREVIEW_MIN_BYTES || typeof document === 'undefined') return dataUrl
  try {
    const img = new window.Image()
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = dataUrl })
    const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    // WebP keeps transparency and is small; where it's unsupported, PNGs stay PNG
    let out = canvas.toDataURL('image/webp', 0.85)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL(/^data:image\/(png|gif)/.test(dataUrl) ? 'image/png' : 'image/jpeg', 0.85)
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
}

async function collectParts(zip, path, parts, seen) {
  if (seen.has(path) || !zip.file(path)) return
  seen.add(path)
  parts.push(path)
  const relsPath = `${path.split('/').slice(0, -1).join('/')}/_rels/${path.split('/').pop()}.rels`
  if (zip.file(relsPath)) parts.push(relsPath)
  if (path.includes('/theme/')) return
  for (const rel of Object.values(await loadRels(zip, path))) {
    const t = rel.type
    if (/\/(notesSlide|notesMaster|handoutMaster|slide)$/.test(t)) continue
    // From the layout and master only what the look comes from is needed
    if (path.includes('/slideLayouts/') && !t.endsWith('/slideMaster')) continue
    if (path.includes('/slideMasters/') && !t.endsWith('/theme')) continue
    await collectParts(zip, rel.path, parts, seen)
  }
}

const isOn = v => v === '1' || v === 'true'
const elKids = el => Array.from(el?.childNodes ?? []).filter(n => n.nodeType === 1)
const childOf = (el, names) => elKids(el).find(n => n.namespaceURI === NS_A && names.includes(n.localName)) ?? null

function spacing(el) {
  if (!el) return null
  const pct = kid(el, NS_A, 'spcPct'), pts = kid(el, NS_A, 'spcPts')
  if (pct) return { pct: +pct.getAttribute('val') / 100000 }
  if (pts) return { pt: +pts.getAttribute('val') / 100 }
  return null
}

function fillColor(spPr) {
  if (!spPr) return null
  const f = childOf(spPr, ['noFill', 'solidFill', 'gradFill', 'pattFill'])
  if (!f || f.localName === 'noFill') return null
  if (f.localName === 'solidFill') return colorOf(f)
  if (f.localName === 'gradFill') {
    const stops = Array.from(f.getElementsByTagNameNS(NS_A, 'gs')).map(gs => ({ pos: +gs.getAttribute('pos') / 1000, color: colorOf(gs) })).filter(s => s.color)
    if (!stops.length) return null
    const ang = (+(desc(f, NS_A, 'lin')?.getAttribute('ang') ?? 0) / 60000 + 90) % 360
    return `linear-gradient(${ang}deg, ${stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`
  }
  return colorOf(kid(f, NS_A, 'fgClr'))
}

function lineOf(spPr) {
  const ln = kid(spPr, NS_A, 'ln')
  if (!ln) return null
  const f = childOf(ln, ['noFill', 'solidFill', 'gradFill', 'pattFill'])
  if (!f || f.localName === 'noFill') return null
  const color = f.localName === 'solidFill' ? colorOf(f) : colorOf(desc(f, NS_A, 'gs')) ?? '#000000'
  return color ? { color, w: +(ln.getAttribute('w') ?? 9525), dash: kid(ln, NS_A, 'prstDash')?.getAttribute('val') ?? 'solid' } : null
}

function textOf(txBody, fallbackColor = null, fallbackFont = null) {
  if (!txBody) return null
  const bodyPr = kid(txBody, NS_A, 'bodyPr')
  const lst = kid(txBody, NS_A, 'lstStyle')
  const auto = kid(bodyPr, NS_A, 'normAutofit')
  const paras = kids(txBody, NS_A, 'p').map(p => {
    const pPr = kid(p, NS_A, 'pPr')
    const lvl = +(pPr?.getAttribute('lvl') ?? 0)
    const L = kid(lst, NS_A, `lvl${lvl + 1}pPr`)
    const defR = kid(L, NS_A, 'defRPr')
    const pick = n => pPr?.getAttribute(n) ?? L?.getAttribute(n) ?? null
    const child = names => childOf(pPr, names) ?? childOf(L, names)
    const bu = child(['buNone', 'buAutoNum', 'buChar', 'buBlip'])
    const runProps = rPr => {
      const a = n => rPr?.getAttribute(n) ?? defR?.getAttribute(n) ?? null
      const fill = childOf(rPr, ['noFill', 'solidFill', 'gradFill']) ?? childOf(defR, ['noFill', 'solidFill', 'gradFill'])
      return {
        sz: +(a('sz') ?? 1800) / 100,
        b: isOn(a('b')), i: isOn(a('i')),
        u: (a('u') ?? 'none') !== 'none',
        strike: (a('strike') ?? 'noStrike') !== 'noStrike',
        baseline: +(a('baseline') ?? 0) / 1000,
        caps: a('cap') === 'all',
        color: fill?.localName === 'noFill' ? 'transparent' : fill?.localName === 'gradFill' ? colorOf(desc(fill, NS_A, 'gs')) : fill ? colorOf(fill) : fallbackColor,
        font: kid(rPr, NS_A, 'latin')?.getAttribute('typeface') ?? kid(defR, NS_A, 'latin')?.getAttribute('typeface') ?? fallbackFont,
      }
    }
    const runs = []
    for (const n of elKids(p)) {
      if (n.localName === 'br') runs.push({ br: true })
      else if (n.localName === 'r' || n.localName === 'fld') runs.push({ t: kid(n, NS_A, 't')?.textContent ?? '', ...runProps(kid(n, NS_A, 'rPr')) })
    }
    // The paragraph mark: its own properties, else those of the last text
    // before it (as PowerPoint does) — not the text box's defaults
    const endPr = kid(p, NS_A, 'endParaRPr')
    const lastRun = [...runs].reverse().find(r => !r.br)
    const end = endPr || !lastRun ? runProps(endPr) : lastRun
    return {
      algn: pick('algn') ?? 'l', lvl,
      marL: +(pick('marL') ?? 0), indent: +(pick('indent') ?? 0),
      lnSpc: spacing(child(['lnSpc'])), spcBef: spacing(child(['spcBef'])), spcAft: spacing(child(['spcAft'])),
      bullet: bu?.localName === 'buChar' ? { char: bu.getAttribute('char') }
        : bu?.localName === 'buAutoNum' ? { auto: bu.getAttribute('type') ?? 'arabicPeriod', start: +(bu.getAttribute('startAt') ?? 1) }
        : null,
      buColor: colorOf(child(['buClr'])),
      buSize: child(['buSzPct']) ? +child(['buSzPct']).getAttribute('val') / 100000 : null,
      buFont: child(['buFont'])?.getAttribute('typeface') ?? null,
      runs, endSz: end.sz,
    }
  })
  if (!paras.some(p => p.runs.some(r => r.t?.trim()))) return null
  return {
    anchor: bodyPr?.getAttribute('anchor') ?? 't',
    ins: [+(bodyPr?.getAttribute('lIns') ?? 91440), +(bodyPr?.getAttribute('tIns') ?? 45720), +(bodyPr?.getAttribute('rIns') ?? 91440), +(bodyPr?.getAttribute('bIns') ?? 45720)],
    wrap: bodyPr?.getAttribute('wrap') !== 'none',
    vert: bodyPr?.getAttribute('vert') ?? null,
    fontScale: auto ? +(auto.getAttribute('fontScale') ?? 100000) / 100000 : 1,
    lnRed: auto ? +(auto.getAttribute('lnSpcReduction') ?? 0) / 100000 : 0,
    paras,
  }
}

// Drop shadow (outer shadow effect) → offsets and blur in EMU
function shadowOf(spPr) {
  const sh = desc(kid(spPr, NS_A, 'effectLst'), NS_A, 'outerShdw')
  if (!sh) return null
  const dist = +(sh.getAttribute('dist') ?? 0), dir = (+(sh.getAttribute('dir') ?? 0) / 60000) * Math.PI / 180
  return { dx: Math.cos(dir) * dist, dy: Math.sin(dir) * dist, blur: +(sh.getAttribute('blurRad') ?? 0), color: colorOf(sh) ?? 'rgba(0,0,0,0.35)' }
}

function tableOf(ctx, tbl, tableStyles) {
  const tblPr = kid(tbl, NS_A, 'tblPr')
  const flag = n => isOn(tblPr?.getAttribute(n))
  const styleId = kid(tblPr, NS_A, 'tableStyleId')?.textContent ?? null
  const look = styleId ? tableStyleLook(resolvedTableStyle(ctx, tableStyles, styleId, styleId)) ?? {} : {}
  const cols = kids(kid(tbl, NS_A, 'tblGrid'), NS_A, 'gridCol').map(c => +c.getAttribute('w'))
  const trs = kids(tbl, NS_A, 'tr')
  const nR = trs.length, nC = cols.length
  const rows = trs.map((tr, r) => ({
    h: +tr.getAttribute('h'),
    cells: kids(tr, NS_A, 'tc').map((tc, c) => {
      const parts = ['wholeTbl']
      const dataRow = r - (flag('firstRow') ? 1 : 0)
      if (flag('bandRow') && dataRow >= 0) parts.push(dataRow % 2 === 0 ? 'band1H' : 'band2H')
      if (flag('firstCol') && c === 0) parts.push('firstCol')
      if (flag('lastCol') && c === nC - 1) parts.push('lastCol')
      if (flag('firstRow') && r === 0) parts.push('firstRow')
      if (flag('lastRow') && r === nR - 1) parts.push('lastRow')
      let fill = null, color = null, bold = false, border = look.wholeTbl?.border ?? null
      for (const p of parts) {
        const l = look[p]
        if (!l) continue
        if (l.fill) fill = l.fill
        if (l.color) color = l.color
        if (l.bold) bold = true
      }
      const tcPr = kid(tc, NS_A, 'tcPr')
      const own = childOf(tcPr, ['noFill', 'solidFill', 'gradFill'])
      if (own) fill = own.localName === 'noFill' ? null : fillColor(tcPr)
      const lines = ['lnL', 'lnR', 'lnT', 'lnB'].map(n => {
        const ln = kid(tcPr, NS_A, n)
        const f = ln && childOf(ln, ['noFill', 'solidFill'])
        return f ? (f.localName === 'noFill' ? null : { color: colorOf(f), w: +(ln.getAttribute('w') ?? 12700) }) : undefined
      })
      const text = textOf(kid(tc, NS_A, 'txBody'), color, ctx.fonts.mn.lt)
      if (text && bold) for (const p of text.paras) for (const run of p.runs) run.b = true
      return {
        span: +(tc.getAttribute('gridSpan') ?? 1), rowSpan: +(tc.getAttribute('rowSpan') ?? 1),
        skip: isOn(tc.getAttribute('hMerge')) || isOn(tc.getAttribute('vMerge')),
        fill, border, lines,
        anchor: tcPr?.getAttribute('anchor') ?? 't',
        ins: [+(tcPr?.getAttribute('marL') ?? 91440), +(tcPr?.getAttribute('marT') ?? 45720), +(tcPr?.getAttribute('marR') ?? 91440), +(tcPr?.getAttribute('marB') ?? 45720)],
        text,
      }
    }),
  }))
  return { cols, rows }
}

async function describeShapes(zip, ctx, rels, container, transform, out, tableStyles, parentKey = null) {
  for (const el of elKids(container)) {
    if (el.localName === 'AlternateContent') {
      const branch = elKids(el).find(b => b.localName === 'Fallback') ?? elKids(el).find(b => b.localName === 'Choice')
      if (branch) await describeShapes(zip, ctx, rels, branch, transform, out, tableStyles, parentKey)
      continue
    }
    if (el.namespaceURI !== NS_P) continue
    const nv = elKids(el).find(n => n.localName.startsWith('nv'))
    if (isOn(kid(nv, NS_P, 'cNvPr')?.getAttribute('hidden'))) continue
    // Edits in the app refer to top-level shapes by id (a group moves as one)
    const key = parentKey ?? kid(nv, NS_P, 'cNvPr')?.getAttribute('id') ?? null

    if (el.localName === 'grpSp') {
      await describeShapes(zip, ctx, rels, el, groupTransform(el, transform), out, tableStyles, key)
      continue
    }

    if (el.localName === 'sp' || el.localName === 'cxnSp' || el.localName === 'pic') {
      const spPr = kid(el, NS_P, 'spPr')
      const xfrm = kid(spPr, NS_A, 'xfrm')
      const raw  = readXfrm(xfrm)
      if (!raw) continue
      const rect = transform(raw)
      const base = {
        ...rect,
        rot: +(xfrm.getAttribute('rot') ?? 0) / 60000,
        flipH: isOn(xfrm.getAttribute('flipH')), flipV: isOn(xfrm.getAttribute('flipV')),
        geom: kid(spPr, NS_A, 'prstGeom')?.getAttribute('prst') ?? (kid(spPr, NS_A, 'custGeom') ? 'custom' : 'rect'),
      }
      const line = lineOf(spPr)
      if (el.localName === 'cxnSp' || base.geom === 'line' || /Connector/.test(base.geom)) {
        if (line) out.push({ type: 'line', ...base, key, line })
        continue
      }
      const blip = desc(kid(el, el.localName === 'pic' ? NS_P : NS_A, 'blipFill') ?? kid(spPr, NS_A, 'blipFill'), NS_A, 'blip')
      const src  = blip ? await previewPicture(await loadImage(zip, rels, blip.getAttributeNS(NS_R, 'embed'))) : null
      const crop = desc(kid(el, NS_P, 'blipFill'), NS_A, 'srcRect')
      const look = pictureLook(spPr, kid(el, NS_P, 'blipFill') ?? kid(spPr, NS_A, 'blipFill'))
      out.push({
        type: src ? 'image' : 'shape', ...base, key,
        fill: src ? null : fillColor(spPr),
        line,
        src,
        crop: src || crop ? [look.crop.l, look.crop.t, look.crop.r, look.crop.b] : null,
        radius: look.radius,
        shadow: shadowOf(spPr),
        text: textOf(kid(el, NS_P, 'txBody')),
        // Part of the frame the picture actually shows (transparent edges left out)
        ...(src && !base.rot ? { vis: await visibleArea(src, look.crop) } : {}),
      })
      continue
    }

    if (el.localName === 'graphicFrame') {
      const raw = readXfrm(kid(el, NS_P, 'xfrm'))
      const data = desc(el, NS_A, 'graphicData')
      if (!raw || !data) continue
      const rect = transform(raw)
      const uri = data.getAttribute('uri') ?? ''
      if (uri.endsWith('/table')) {
        out.push({ type: 'table', ...rect, key, table: tableOf(ctx, desc(data, NS_A, 'tbl'), tableStyles) })
      } else if (uri.endsWith('/chart')) {
        const rel = rels[desc(data, NS_C, 'chart')?.getAttributeNS(NS_R, 'id')]
        const xml = rel && zip.file(rel.path) ? await zip.file(rel.path).async('string') : null
        const chart = xml && readChartXml(resolveChartXml(ctx, xml))
        if (chart) out.push({ type: 'image', ...rect, key, chart: true, src: renderChartImage(chart, rect) })
      } else if (uri.endsWith('/diagram')) {
        const lines = await readSmartArtText(zip, rels, desc(data, NS_DGM, 'relIds'))
        if (lines.length) out.push({ type: 'shape', ...rect, key, smartArt: true, geom: 'rect', text: { anchor: 't', ins: [91440, 45720, 91440, 45720], wrap: true, fontScale: 1, lnRed: 0, paras: lines.map(t => ({ algn: 'l', marL: 0, indent: 0, bullet: null, runs: [{ t: t.replace(/\*/g, ''), sz: 16, color: schemeHex(ctx, 'tx1') && `#${schemeHex(ctx, 'tx1')}` }], endSz: 16 })) } })
      }
    }
  }
}

async function originalPreview(zip, ctx, slidePath, slideW, slideH, tableStyles) {
  const rels = await loadRels(zip, slidePath)
  const xml  = resolveSlideShapes(ctx, { defaultTableStyleId: defaultTableStyleId(tableStyles), keepIds: true })
  const doc  = parseXml(`<p:spTree xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${xml}</p:spTree>`)
  const raw  = []
  await describeShapes(zip, ctx, rels, doc.documentElement, r => r, raw, tableStyles)
  const box = r => ({ x: r.x / slideW, y: r.y / slideH, w: r.w / slideW, h: r.h / slideH })
  const items = raw.map(it => ({ ...it, ...box(it) }))

  // Title, text and notes for the slide list and search
  const slideDoc = ctx.slideDoc
  let title = '', text = []
  for (const sp of slideDoc.getElementsByTagNameNS(NS_P, 'sp')) {
    const ph = placeholderInfo(sp, 'nvSpPr')
    const lines = bodyParagraphs(kid(sp, NS_P, 'txBody'))
    if (!lines.length) continue
    if (!title && (ph?.type === 'title' || ph?.type === 'ctrTitle')) title = lines.join(' ').replace(/\*/g, '')
    else if (!ph || !SKIP_PH.has(ph.type)) text.push(...lines.map(l => l.replace(/\*\*/g, '')))
  }
  return { version: 3, slideW, slideH, aspect: slideW / slideH, items, title, text, notes: await readNotes(zip, rels) }
}

// file → { pkg, slides }. pkg holds the parts the slides need (kept with the
// original file); slides are [{ slidePath, preview }] in presentation order.
export async function importOriginalSlidesFromPptx(file) {
  const zip = await JSZip.loadAsync(file)
  const { pkg, slidePaths } = await packageFromZip(zip)
  const get = p => (typeof pkg.parts[p] === 'string' ? pkg.parts[p] : null)
  const slides = []
  const seenBg = new Map()
  for (const slidePath of slidePaths) {
    const ctx = themeContext(get, slidePath, pkg.defaultTextStyle)
    const preview = await originalPreview(zip, ctx, slidePath, pkg.slideW, pkg.slideH, pkg.tableStyles)
    if (await onSparkTemplate(zip, slidePath, pkg.slideW, pkg.slideH, seenBg)) preview.onTemplate = true
    slides.push({ slidePath, preview })
  }
  return { pkg, slides }
}

// The part of a picture's frame that isn't transparent, as fractions of the
// frame { l, t, r, b } (insets), or undefined when the whole frame shows
async function visibleArea(src, crop) {
  if (typeof document === 'undefined' || !/^data:image\/(png|gif|webp)/.test(src)) return undefined
  try {
    const img = new window.Image()
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = src })
    const sc = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight))
    const W = Math.max(1, Math.round(img.naturalWidth * sc)), H = Math.max(1, Math.round(img.naturalHeight * sc))
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, W, H)
    const d = g.getImageData(0, 0, W, H).data
    let x1 = W, y1 = H, x2 = -1, y2 = -1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y }
    }
    if (x2 < 0) return undefined
    // Picture fractions → frame fractions (the frame shows the picture minus its crop)
    const c0 = crop ?? { l: 0, t: 0, r: 0, b: 0 }
    const vw = 1 - c0.l - c0.r, vh = 1 - c0.t - c0.b
    if (vw <= 0 || vh <= 0) return undefined
    const fx = v => Math.min(1, Math.max(0, (v - c0.l) / vw)), fy = v => Math.min(1, Math.max(0, (v - c0.t) / vh))
    const vis = { l: fx(x1 / W), t: fy(y1 / H), r: 1 - fx((x2 + 1) / W), b: 1 - fy((y2 + 1) / H) }
    return vis.l + vis.t + vis.r + vis.b > 0.02 ? vis : undefined
  } catch {
    return undefined
  }
}

// Is the slide already built on the Spark Studio content template (its layout
// or master shows the same background — logo, header line, corner art)? Then
// its content is already placed for that design and is kept exactly in place.
const SPARK_BG = '/branding/content-bg.jpg'
let sparkBgThumb = null
async function onSparkTemplate(zip, slidePath, slideW, slideH, seen) {
  if (typeof document === 'undefined' || Math.abs(slideW / slideH - 16 / 9) > 0.01) return false
  const slideRels = await loadRels(zip, slidePath)
  const layout = Object.values(slideRels).find(r => r.type?.endsWith('/slideLayout'))?.path
  if (!layout) return false
  const layoutRels = await loadRels(zip, layout)
  const master = Object.values(layoutRels).find(r => r.type?.endsWith('/slideMaster'))?.path
  const masterRels = master ? await loadRels(zip, master) : {}
  const pictures = [...Object.values(layoutRels), ...Object.values(masterRels)]
    .filter(r => r.type?.endsWith('/image') && IMG_MIME[r.path.split('.').pop().toLowerCase()])
  for (const r of pictures) {
    if (!seen.has(r.path)) seen.set(r.path, (async () => {
      const file = zip.file(r.path)
      if (!file) return false
      sparkBgThumb ??= thumbOf(SPARK_BG)
      const [a, b] = await Promise.all([sparkBgThumb, thumbOf(URL.createObjectURL(new Blob([await file.async('uint8array')])))])
      if (!a || !b) return false
      let diff = 0
      for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i])
      return diff / a.length < 6 // same picture (re-saved copies differ by a few levels)
    })())
    if (await seen.get(r.path)) return true
  }
  return false
}

// Small greyscale copy of a picture, for comparing
async function thumbOf(src) {
  try {
    const img = new window.Image()
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = src })
    if (Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) > 0.02) return null
    const c = document.createElement('canvas')
    c.width = 64; c.height = 36
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, 64, 36)
    const d = g.getImageData(0, 0, 64, 36).data
    const out = new Float32Array(64 * 36)
    for (let i = 0; i < out.length; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
    return out
  } catch {
    return null
  } finally {
    if (src.startsWith('blob:')) URL.revokeObjectURL(src)
  }
}

// The parts of a PowerPoint the visible slides need → { pkg, slidePaths }
// (also used to read an uploaded original file back)
export async function packageFromZip(zip) {
  const presXml = await zip.file('ppt/presentation.xml').async('string')
  const presDoc = parseXml(presXml)
  const sz = desc(presDoc, NS_P, 'sldSz')
  const slideW = +sz?.getAttribute('cx') || TPL_W
  const slideH = +sz?.getAttribute('cy') || TPL_H
  const defaultTextStyle = presXml.match(/<p:defaultTextStyle\b[\s\S]*?<\/p:defaultTextStyle>/)?.[0]
    ?.replace('<p:defaultTextStyle', `<p:defaultTextStyle xmlns:p="${NS_P}" xmlns:a="${NS_A}"`) ?? null
  const tableStyles = (await zip.file('ppt/tableStyles.xml')?.async('string')) ?? null

  // Slides in presentation order
  const presRels = await loadRels(zip, 'ppt/presentation.xml')
  const order = Array.from(presDoc.getElementsByTagNameNS(NS_P, 'sldId'))
    .map(s => presRels[s.getAttributeNS(NS_R, 'id')]?.path).filter(Boolean)

  // Content types for every part, from [Content_Types].xml
  const ctDoc = parseXml(await zip.file('[Content_Types].xml').async('string'))
  const ctNs  = 'http://schemas.openxmlformats.org/package/2006/content-types'
  const defaults  = Object.fromEntries(Array.from(ctDoc.getElementsByTagNameNS(ctNs, 'Default')).map(d => [d.getAttribute('Extension').toLowerCase(), d.getAttribute('ContentType')]))
  const overrides = Object.fromEntries(Array.from(ctDoc.getElementsByTagNameNS(ctNs, 'Override')).map(o => [o.getAttribute('PartName').replace(/^\//, ''), o.getAttribute('ContentType')]))

  const seen = new Set(), partList = [], slidePaths = []
  for (const slidePath of order) {
    const doc = parseXml(await zip.file(slidePath).async('string'))
    if (doc.documentElement.getAttribute('show') === '0') continue // hidden slide
    await collectParts(zip, slidePath, partList, seen)
    slidePaths.push(slidePath)
  }

  const parts = {}, types = {}
  for (const path of partList) {
    if (parts[path]) continue
    const f = zip.file(path)
    parts[path] = TEXT_PART.test(path) ? await f.async('string') : { b64: await f.async('base64') }
    if (!path.endsWith('.rels')) types[path] = overrides[path] ?? defaults[path.split('.').pop().toLowerCase()] ?? 'application/octet-stream'
  }
  return { pkg: { version: 2, slideW, slideH, parts, types, tableStyles, defaultTextStyle }, slidePaths }
}

// Rebuilds the preview description of an imported slide from its stored
// original parts (used when a slide imported by an older version is edited)
export async function rebuildOriginalPreview(pkg, slidePath) {
  const zip = new JSZip()
  for (const [path, data] of Object.entries(pkg.parts ?? {})) {
    if (typeof data === 'string') zip.file(path, data)
    else if (data?.b64 != null) zip.file(path, data.b64, { base64: true })
  }
  const get = p => (typeof pkg.parts[p] === 'string' ? pkg.parts[p] : null)
  const ctx = themeContext(get, slidePath, pkg.defaultTextStyle ?? null)
  return originalPreview(zip, ctx, slidePath, pkg.slideW, pkg.slideH, pkg.tableStyles ?? null)
}
