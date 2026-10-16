import JSZip from 'jszip'

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
const MAX_IMG_DIM   = 1600
const MAX_IMG_BYTES = 350 * 1024

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
      const resized = await new Promise(res => canvas.toBlob(res, outMime, 0.85))
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
  if (!mime || !file) return null // EMF/WMF/SVG/TIFF can't be rendered in the browser
  return bytesToDataUrl(await file.async('uint8array'), mime)
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
  const doc    = parseXml(await zip.file(rel.path).async('string'))
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
  const legend = isPie ? chart.cats.map((c, i) => ({ label: c, color: chart.series[0].color && i === 0 ? `#${chart.series[0].color}` : PALETTE[i % PALETTE.length] }))
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
        if (src) out.push({ kind: 'image', rect, src })
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
      if (src) out.push({ kind: 'image', rect: transform(rect), src })
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
      images.push({ src: e.src, ...box, mode: 'scale' })
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
