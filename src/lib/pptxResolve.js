/**
 * pptxResolve.js
 *
 * Turns a slide from an imported PowerPoint into stand-alone shapes that look
 * exactly the same on any other deck (the Spark Studio template). A slide's
 * shapes normally inherit a lot from the file they came from: placeholder
 * positions and text styles from the layout and master, theme colours
 * ("accent 1"), theme fonts ("+mn-lt"), and shape styles from the theme. All of
 * that is written into the shapes themselves here, so nothing changes when
 * they're moved onto the template's background.
 *
 * Works on XML strings from a stored package: get(path) → string | null.
 */

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'

const parse  = xml => new DOMParser().parseFromString(xml, 'text/xml')
const elKids = el => Array.from(el?.childNodes ?? []).filter(n => n.nodeType === 1)
const kid    = (el, ns, name) => elKids(el).find(n => n.namespaceURI === ns && n.localName === name) ?? null
const desc   = (el, ns, name) => el?.getElementsByTagNameNS(ns, name)[0] ?? null
const dirOf  = p => p.split('/').slice(0, -1).join('/')

function resolvePath(baseDir, target) {
  if (target.startsWith('/')) return target.slice(1)
  const out = baseDir ? baseDir.split('/') : []
  for (const seg of target.split('/')) {
    if (seg === '..') out.pop()
    else if (seg && seg !== '.') out.push(seg)
  }
  return out.join('/')
}

export const relsPathOf = p => `${dirOf(p)}/_rels/${p.split('/').pop()}.rels`

// id → { type, target, external, path }
export function readRels(get, partPath) {
  const xml = get(relsPathOf(partPath))
  const map = {}
  if (typeof xml !== 'string') return map
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const attr = n => tag.match(new RegExp(`\\s${n}="([^"]*)"`))?.[1] ?? null
    const external = attr('TargetMode') === 'External'
    const target = attr('Target') ?? ''
    map[attr('Id')] = { type: attr('Type') ?? '', target, external, path: external ? null : resolvePath(dirOf(partPath), target) }
  }
  return map
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const relOfType = (rels, suffix) => Object.values(rels).find(r => r.type.endsWith(suffix) && !r.external)

export function themeContext(get, slidePath, defaultTextStyleXml = null) {
  const load = p => (p && typeof get(p) === 'string' ? parse(get(p)) : null)
  const slideDoc   = load(slidePath)
  const slideRels  = readRels(get, slidePath)
  const layoutPath = relOfType(slideRels, '/slideLayout')?.path ?? null
  const layoutDoc  = load(layoutPath)
  const masterPath = layoutPath ? relOfType(readRels(get, layoutPath), '/slideMaster')?.path ?? null : null
  const masterDoc  = load(masterPath)
  const themePath  = masterPath ? relOfType(readRels(get, masterPath), '/theme')?.path ?? null : null
  const themeDoc   = load(themePath)

  const scheme = {}
  for (const c of elKids(desc(themeDoc, NS_A, 'clrScheme'))) {
    const v = desc(c, NS_A, 'srgbClr')?.getAttribute('val') ?? desc(c, NS_A, 'sysClr')?.getAttribute('lastClr')
    if (v) scheme[c.localName] = v.toUpperCase()
  }
  const clrMap = {}
  const mapFrom = el => { for (const a of Array.from(el?.attributes ?? [])) if (!a.name.startsWith('xmlns')) clrMap[a.localName] = a.value }
  mapFrom(desc(masterDoc, NS_P, 'clrMap'))
  mapFrom(desc(desc(layoutDoc, NS_P, 'clrMapOvr'), NS_A, 'overrideClrMapping'))
  mapFrom(desc(desc(slideDoc, NS_P, 'clrMapOvr'), NS_A, 'overrideClrMapping'))

  const fontSet = name => {
    const f = desc(themeDoc, NS_A, name)
    return { lt: kid(f, NS_A, 'latin')?.getAttribute('typeface') ?? 'Calibri', ea: kid(f, NS_A, 'ea')?.getAttribute('typeface') ?? '', cs: kid(f, NS_A, 'cs')?.getAttribute('typeface') ?? '' }
  }

  let defaultTextStyle = null
  if (defaultTextStyleXml) {
    const d = parse(defaultTextStyleXml).documentElement
    if (d && d.localName !== 'parsererror') defaultTextStyle = d
  }
  if (!defaultTextStyle) defaultTextStyle = desc(desc(masterDoc, NS_P, 'txStyles'), NS_P, 'otherStyle')

  return {
    get, slidePath, slideDoc, slideRels, layoutDoc, masterDoc,
    scheme, clrMap,
    fonts: { mj: fontSet('majorFont'), mn: fontSet('minorFont') },
    fmt: desc(themeDoc, NS_A, 'fmtScheme'),
    defaultTextStyle,
  }
}

export function schemeHex(ctx, val) {
  const key = ctx.clrMap[val] ?? val
  return ctx.scheme[key] ?? ctx.scheme[val] ?? (/^(bg|lt)/.test(key) ? 'FFFFFF' : '000000')
}

// Theme colours and fonts → fixed values, in any XML string
export function resolveThemeRefs(ctx, xml) {
  const stack = []
  let out = xml.replace(/<a:schemeClr\b([^>]*?)(\/?)>|<\/a:schemeClr>/g, (m, attrs, selfClose) => {
    if (m.startsWith('</')) return stack.pop() ? '</a:srgbClr>' : m
    const val = /\bval="([^"]*)"/.exec(attrs)?.[1]
    const keep = !val || val === 'phClr'
    if (!selfClose) stack.push(!keep)
    return keep ? m : `<a:srgbClr val="${schemeHex(ctx, val)}"${selfClose ? '/' : ''}>`
  })
  out = out.replace(/typeface="\+(mj|mn)-(lt|ea|cs)"/g, (_, w, k) => `typeface="${escapeAttr(ctx.fonts[w][k] ?? '')}"`)
  return out
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// ── Merging inherited properties ─────────────────────────────────────────────
// Each list is the element's child order from the file format; names in one
// group replace each other (a run has one fill, one bullet type…).
const ORDERS = {
  pPr:    [['lnSpc'], ['spcBef'], ['spcAft'], ['buClrTx', 'buClr'], ['buSzTx', 'buSzPct', 'buSzPts'], ['buFontTx', 'buFont'], ['buNone', 'buAutoNum', 'buChar', 'buBlip'], ['tabLst'], ['defRPr'], ['extLst']],
  rPr:    [['ln'], ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'], ['effectLst', 'effectDag'], ['highlight'], ['uLnTx', 'uLn'], ['uFillTx', 'uFill'], ['latin'], ['ea'], ['cs'], ['sym'], ['hlinkClick'], ['hlinkMouseOver'], ['rtl'], ['extLst']],
  bodyPr: [['prstTxWarp'], ['noAutofit', 'normAutofit', 'spAutoFit'], ['scene3d'], ['sp3d', 'flatTx'], ['extLst']],
  spPr:   [['xfrm'], ['custGeom', 'prstGeom'], ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'], ['ln'], ['effectLst', 'effectDag'], ['scene3d'], ['sp3d'], ['extLst']],
  ln:     [['noFill', 'solidFill', 'gradFill', 'pattFill'], ['prstDash', 'custDash'], ['round', 'bevel', 'miter'], ['headEnd'], ['tailEnd'], ['extLst']],
  xfrm:   [['off'], ['ext'], ['chOff'], ['chExt']],
}
// A shape can set part of its position (e.g. only the width) and take the rest
// from its layout
const SPPR_NESTED = { ln: 'ln', xfrm: 'xfrm' }
const slotOf = (order, name) => order.findIndex(g => g.includes(name))

// `over` wins; attributes and child groups missing from it come from `base`
function merge(base, over, order, nested = null) {
  if (!base) return over ? over.cloneNode(true) : null
  if (!over) return base.cloneNode(true)
  const out = over.cloneNode(false)
  for (const a of Array.from(base.attributes)) {
    if (a.name.startsWith('xmlns')) continue
    if (!out.hasAttribute(a.name)) out.setAttribute(a.name, a.value)
  }
  const slots = new Map()
  const extra = []
  for (const c of elKids(base)) {
    const i = slotOf(order, c.localName)
    if (i < 0) extra.push(c.cloneNode(true)); else slots.set(i, c.cloneNode(true))
  }
  for (const c of elKids(over)) {
    const i = slotOf(order, c.localName)
    if (i < 0) { extra.push(c.cloneNode(true)); continue }
    const prev = slots.get(i)
    const sub = nested?.[c.localName]
    slots.set(i, sub && prev?.localName === c.localName ? merge(prev, c, ORDERS[sub]) : c.cloneNode(true))
  }
  for (const i of [...slots.keys()].sort((a, b) => a - b)) out.appendChild(slots.get(i))
  for (const e of extra) out.appendChild(e)
  return out
}

const LEVELS = ['defPPr', ...Array.from({ length: 9 }, (_, i) => `lvl${i + 1}pPr`)]

function mergeLists(doc, lists) {
  const out = doc.createElementNS(NS_A, 'a:lstStyle')
  for (const name of LEVELS) {
    let acc = null
    for (const l of lists) acc = merge(acc, kid(l, NS_A, name), ORDERS.pPr, { defRPr: 'rPr' })
    if (acc) out.appendChild(acc)
  }
  return out
}

// ── Placeholders ──────────────────────────────────────────────────────────────

function nvPrOf(shape) {
  const nv = elKids(shape).find(n => n.namespaceURI === NS_P && n.localName.startsWith('nv'))
  return kid(nv, NS_P, 'nvPr')
}
const phOf = shape => kid(nvPrOf(shape), NS_P, 'ph')
const normType = t => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t)

function findPlaceholder(doc, type, idx, byIdx) {
  const tree = desc(doc, NS_P, 'spTree')
  if (!tree) return null
  const all = Array.from(tree.getElementsByTagNameNS(NS_P, 'ph')).map(ph => ({ ph, shape: ph.parentNode?.parentNode?.parentNode }))
  if (byIdx && idx != null) {
    const m = all.find(a => a.ph.getAttribute('idx') === idx)
    if (m) return m.shape
  }
  const typeOf = a => a.ph.getAttribute('type') || 'obj'
  return (all.find(a => typeOf(a) === type) ?? all.find(a => normType(typeOf(a)) === normType(type)))?.shape ?? null
}

const spPrOf = shape => kid(shape, NS_P, 'spPr')
const hasText = shape => Array.from(shape.getElementsByTagNameNS(NS_A, 't')).some(t => t.textContent.trim())

// ── Theme shape styles (p:style) ──────────────────────────────────────────────

// Replaces placeholder colours (phClr) in a theme style with the ref's colour
function withRefColor(styleEl, ref) {
  const color = elKids(ref).find(n => n.namespaceURI === NS_A)
  const out = styleEl.cloneNode(true)
  if (!color) return out
  for (const ph of Array.from(out.getElementsByTagNameNS(NS_A, 'schemeClr')).filter(e => e.getAttribute('val') === 'phClr')) {
    const c = color.cloneNode(true)
    for (const m of elKids(ph)) c.appendChild(m.cloneNode(true))
    ph.parentNode.replaceChild(c, ph)
  }
  return out
}

function themeStyleEntry(ctx, listName, idx) {
  const list = desc(ctx.fmt, NS_A, listName)
  return elKids(list)[idx - 1] ?? null
}

// Writes the shape's theme style (fill, outline, effects, text font/colour)
// into the shape. Returns the text defaults the style gives.
function bakeShapeStyle(ctx, shape) {
  const style = kid(shape, NS_P, 'style')
  if (!style) return null
  const doc = shape.ownerDocument
  let spPr = spPrOf(shape)
  if (!spPr) { spPr = doc.createElementNS(NS_P, 'p:spPr'); shape.insertBefore(spPr, style) }
  const base = doc.createElementNS(NS_P, 'p:spPr')
  const has = names => elKids(spPr).some(n => names.includes(n.localName))

  const fillRef = kid(style, NS_A, 'fillRef')
  const fIdx = +(fillRef?.getAttribute('idx') ?? 0)
  if (fIdx > 0 && !has(ORDERS.spPr[2])) {
    const entry = fIdx >= 1001 ? themeStyleEntry(ctx, 'bgFillStyleLst', fIdx - 1000) : themeStyleEntry(ctx, 'fillStyleLst', fIdx)
    if (entry) base.appendChild(withRefColor(entry, fillRef))
  }
  const lnRef = kid(style, NS_A, 'lnRef')
  const lIdx = +(lnRef?.getAttribute('idx') ?? 0)
  if (lIdx > 0) {
    const entry = themeStyleEntry(ctx, 'lnStyleLst', lIdx)
    if (entry) base.appendChild(withRefColor(entry, lnRef))
  }
  const effectRef = kid(style, NS_A, 'effectRef')
  const eIdx = +(effectRef?.getAttribute('idx') ?? 0)
  if (eIdx > 0 && !has(['effectLst', 'effectDag'])) {
    const entry = themeStyleEntry(ctx, 'effectStyleLst', eIdx)
    const eff = entry && elKids(entry).find(n => n.localName === 'effectLst' || n.localName === 'effectDag')
    if (eff) base.appendChild(withRefColor(eff, effectRef))
  }
  const merged = merge(base, spPr, ORDERS.spPr, SPPR_NESTED)
  shape.replaceChild(merged, spPr)

  const fontRef = kid(style, NS_A, 'fontRef')
  const fontIdx = fontRef?.getAttribute('idx')
  const textColor = fontRef && elKids(fontRef).find(n => n.namespaceURI === NS_A)
  shape.removeChild(style)
  return {
    font: fontIdx === 'major' ? ctx.fonts.mj.lt : fontIdx === 'minor' ? ctx.fonts.mn.lt : null,
    color: textColor ? textColor.cloneNode(true) : null,
  }
}

// ── Shapes ────────────────────────────────────────────────────────────────────

// Text settings for every level: size (only when given), colour and font
function textDefaults(doc, { sz = null, font = null, colorEl = null }) {
  const lst = doc.createElementNS(NS_A, 'a:lstStyle')
  for (const name of LEVELS.slice(1)) {
    const lvl = doc.createElementNS(NS_A, `a:${name}`)
    const def = doc.createElementNS(NS_A, 'a:defRPr')
    if (sz) def.setAttribute('sz', sz)
    if (colorEl) {
      const fill = doc.createElementNS(NS_A, 'a:solidFill')
      fill.appendChild(colorEl.cloneNode(true))
      def.appendChild(fill)
    }
    if (font) {
      const latin = doc.createElementNS(NS_A, 'a:latin')
      latin.setAttribute('typeface', font)
      def.appendChild(latin)
    }
    lvl.appendChild(def)
    lst.appendChild(lvl)
  }
  return lst
}

function setTextStyles(ctx, shape, lists, styleText, isTitle) {
  const txBody = kid(shape, NS_P, 'txBody')
  if (!txBody) return
  const doc = shape.ownerDocument
  const tx1 = doc.createElementNS(NS_A, 'a:schemeClr')
  tx1.setAttribute('val', 'tx1')
  // Base: PowerPoint's own defaults. Then the inherited styles, then the
  // shape's theme style (its text colour/font beat the deck's defaults), then
  // the shape's own settings.
  const base = textDefaults(doc, { sz: '1800', font: isTitle ? ctx.fonts.mj.lt : ctx.fonts.mn.lt, colorEl: tx1 })
  const fromStyle = styleText && (styleText.font || styleText.color) ? textDefaults(doc, { font: styleText.font, colorEl: styleText.color }) : null
  const merged = mergeLists(doc, [base, ...lists, fromStyle, kid(txBody, NS_A, 'lstStyle')].filter(Boolean))
  const old = kid(txBody, NS_A, 'lstStyle')
  if (old) txBody.replaceChild(merged, old)
  else txBody.insertBefore(merged, elKids(txBody).find(n => n.localName === 'p') ?? null)
}

function resolvePlaceholder(ctx, shape) {
  const ph = phOf(shape)
  const type = ph.getAttribute('type') || 'obj'
  const idx  = ph.getAttribute('idx')
  const layoutSh = findPlaceholder(ctx.layoutDoc, type, idx, true)
  const lph = layoutSh && phOf(layoutSh)
  const masterSh = findPlaceholder(ctx.masterDoc, lph?.getAttribute('type') || type, null, false)

  // Position, outline and fill
  if (shape.localName === 'graphicFrame') {
    if (!kid(shape, NS_P, 'xfrm')) {
      const src = desc(spPrOf(layoutSh), NS_A, 'xfrm') ?? desc(spPrOf(masterSh), NS_A, 'xfrm')
      if (src) {
        const x = shape.ownerDocument.createElementNS(NS_P, 'p:xfrm')
        for (const c of elKids(src)) x.appendChild(c.cloneNode(true))
        shape.insertBefore(x, kid(shape, NS_A, 'graphic'))
      }
    }
  } else {
    const merged = merge(merge(spPrOf(masterSh), spPrOf(layoutSh), ORDERS.spPr, SPPR_NESTED), spPrOf(shape), ORDERS.spPr, SPPR_NESTED)
    if (merged) {
      // A zero width or height on the slide means "not set" — use the layout's
      const ext = kid(kid(merged, NS_A, 'xfrm'), NS_A, 'ext')
      const inherited = kid(desc(spPrOf(layoutSh), NS_A, 'xfrm'), NS_A, 'ext') ?? kid(desc(spPrOf(masterSh), NS_A, 'xfrm'), NS_A, 'ext')
      if (ext && inherited) for (const a of ['cx', 'cy']) if (!+ext.getAttribute(a)) ext.setAttribute(a, inherited.getAttribute(a))
      const own = spPrOf(shape)
      if (own) shape.replaceChild(merged, own)
      else shape.insertBefore(merged, elKids(shape)[1] ?? null)
    }
  }

  // Text box settings and text styles
  const txBody = kid(shape, NS_P, 'txBody')
  if (txBody) {
    const bp = merge(merge(desc(kid(masterSh, NS_P, 'txBody'), NS_A, 'bodyPr'), desc(kid(layoutSh, NS_P, 'txBody'), NS_A, 'bodyPr'), ORDERS.bodyPr), kid(txBody, NS_A, 'bodyPr'), ORDERS.bodyPr)
    if (bp) {
      const own = kid(txBody, NS_A, 'bodyPr')
      if (own) txBody.replaceChild(bp, own); else txBody.insertBefore(bp, txBody.firstChild)
    }
    const nt = normType(lph?.getAttribute('type') || type)
    const txStyles = desc(ctx.masterDoc, NS_P, 'txStyles')
    const master = kid(txStyles, NS_P, nt === 'title' ? 'titleStyle' : nt === 'body' ? 'bodyStyle' : 'otherStyle')
    const styleText = bakeShapeStyle(ctx, shape)
    setTextStyles(ctx, shape, [ctx.defaultTextStyle, master, desc(kid(masterSh, NS_P, 'txBody'), NS_A, 'lstStyle'), desc(kid(layoutSh, NS_P, 'txBody'), NS_A, 'lstStyle')], styleText, nt === 'title')
  }
  ph.parentNode.removeChild(ph)
}

function resolveShape(ctx, shape, opts) {
  if (shape.namespaceURI !== NS_P && shape.localName !== 'AlternateContent') return shape
  if (shape.localName === 'AlternateContent') {
    for (const branch of elKids(shape)) for (const s of elKids(branch)) resolveShape(ctx, s, opts)
    return shape
  }
  if (shape.localName === 'grpSp') {
    for (const c of elKids(shape)) {
      if (['nvGrpSpPr', 'grpSpPr'].includes(c.localName)) continue
      const r = resolveShape(ctx, c, opts)
      if (!r) shape.removeChild(c)
    }
    return shape
  }
  const ph = phOf(shape)
  if (ph) {
    const type = ph.getAttribute('type') || 'obj'
    if (shape.localName === 'sp' && !hasText(shape)) return null // empty placeholders don't show
    if (['sldNum', 'dt', 'ftr', 'hdr'].includes(type)) return null    // the template has its own
    resolvePlaceholder(ctx, shape)
  } else if (['sp', 'cxnSp', 'pic'].includes(shape.localName)) {
    const styleText = bakeShapeStyle(ctx, shape)
    setTextStyles(ctx, shape, [ctx.defaultTextStyle], styleText, false)
  }
  if (shape.localName === 'graphicFrame') useExplicitTableStyle(shape, opts.defaultTableStyleId)
  return shape
}

// Tables with no style use the deck's default — name it, so it can be copied
function useExplicitTableStyle(frame, defaultId) {
  const tbl = desc(frame, NS_A, 'tbl')
  if (!tbl || !defaultId) return
  const doc = frame.ownerDocument
  let tblPr = kid(tbl, NS_A, 'tblPr')
  if (!tblPr) { tblPr = doc.createElementNS(NS_A, 'a:tblPr'); tbl.insertBefore(tblPr, tbl.firstChild) }
  if (kid(tblPr, NS_A, 'tableStyleId')) return
  const id = doc.createElementNS(NS_A, 'a:tableStyleId')
  id.textContent = defaultId
  tblPr.insertBefore(id, kid(tblPr, NS_A, 'extLst'))
}

// ── Placement on the template ─────────────────────────────────────────────────

const LINE_TAGS = new Set(['ln', 'lnL', 'lnR', 'lnT', 'lnB', 'lnTlToBr', 'lnBlToTr'])
const EFFECT_ATTRS = ['dist', 'blurRad', 'rad']

function scaleAttr(el, name, s, fallback = null, min = -Infinity) {
  const v = el.getAttribute(name)
  if (v == null && fallback == null) return
  el.setAttribute(name, String(Math.max(min, Math.round((v == null ? fallback : +v) * s))))
}

function xfrmOf(shape) {
  if (shape.localName === 'graphicFrame') return kid(shape, NS_P, 'xfrm')
  if (shape.localName === 'grpSp') return kid(kid(shape, NS_P, 'grpSpPr'), NS_A, 'xfrm')
  return kid(spPrOf(shape), NS_A, 'xfrm')
}

// Moves and scales the slide's content into the template's content area.
// Text sizes, line widths, spacing and table sizes shrink by the same factor
// so everything keeps its proportions.
function topShapes(tree) {
  const tops = []
  for (const c of elKids(tree)) {
    if (c.localName === 'AlternateContent') for (const b of elKids(c)) tops.push(...elKids(b))
    else tops.push(c)
  }
  return tops
}

// The area the visible shapes cover, in the slide's own units
function contentBounds(tree) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const shape of topShapes(tree)) {
    const nv = elKids(shape).find(n => n.namespaceURI === NS_P && n.localName.startsWith('nv'))
    const cNvPr = kid(nv, NS_P, 'cNvPr')
    if (cNvPr?.getAttribute('hidden') === '1' || cNvPr?.getAttribute('hidden') === 'true') continue
    const x = xfrmOf(shape)
    const off = kid(x, NS_A, 'off'), ext = kid(x, NS_A, 'ext')
    if (!off || !ext) continue
    const ox = +off.getAttribute('x'), oy = +off.getAttribute('y')
    x1 = Math.min(x1, ox); y1 = Math.min(y1, oy)
    x2 = Math.max(x2, ox + +ext.getAttribute('cx')); y2 = Math.max(y2, oy + +ext.getAttribute('cy'))
  }
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null
}

function place(tree, { s, dx, dy }) {
  for (const shape of topShapes(tree)) {
    const x = xfrmOf(shape)
    const off = kid(x, NS_A, 'off'), ext = kid(x, NS_A, 'ext')
    if (off) { off.setAttribute('x', String(Math.round(dx + +off.getAttribute('x') * s))); off.setAttribute('y', String(Math.round(dy + +off.getAttribute('y') * s))) }
    if (ext) { scaleAttr(ext, 'cx', s); scaleAttr(ext, 'cy', s) }
  }
  for (const el of Array.from(tree.getElementsByTagName('*'))) {
    const n = el.localName
    if (el.namespaceURI !== NS_A) continue
    if (n === 'rPr' || n === 'defRPr' || n === 'endParaRPr') { scaleAttr(el, 'sz', s, null, 100); scaleAttr(el, 'spc', s) }
    else if (n === 'spcPts' || n === 'buSzPts') scaleAttr(el, 'val', s, null, 1)
    else if (LINE_TAGS.has(n)) scaleAttr(el, 'w', s)
    else if (n === 'pPr' || /^lvl\dpPr$/.test(n)) { scaleAttr(el, 'marL', s); scaleAttr(el, 'indent', s) }
    else if (n === 'tab') scaleAttr(el, 'pos', s)
    else if (n === 'bodyPr') { scaleAttr(el, 'lIns', s, 91440); scaleAttr(el, 'rIns', s, 91440); scaleAttr(el, 'tIns', s, 45720); scaleAttr(el, 'bIns', s, 45720) }
    else if (n === 'tcPr') { scaleAttr(el, 'marL', s, 91440); scaleAttr(el, 'marR', s, 91440); scaleAttr(el, 'marT', s, 45720); scaleAttr(el, 'marB', s, 45720) }
    else if (n === 'gridCol') scaleAttr(el, 'w', s)
    else if (n === 'tr') scaleAttr(el, 'h', s)
    else if (['outerShdw', 'innerShdw', 'glow', 'softEdge', 'prstShdw', 'reflection'].includes(n)) for (const a of EFFECT_ATTRS) scaleAttr(el, a, s)
  }
}

// ── Edits made in the app ─────────────────────────────────────────────────────
// edits: { [shape id]: { deleted, from, box, paras, cells, crop, radius } }
// from/box are the element's area before/after (fractions of the slide);
// paras are its paragraphs' text; cells a table's cell text; crop [l,t,r,b].

export const shapeKey = shape => {
  const nv = elKids(shape).find(n => n.namespaceURI === NS_P && n.localName.startsWith('nv'))
  return kid(nv, NS_P, 'cNvPr')?.getAttribute('id') ?? null
}

// A paragraph's text as the app shows it (line breaks inside a paragraph as spaces)
export function paragraphText(p) {
  return elKids(p).map(n => (n.localName === 'br' ? ' ' : n.localName === 'r' || n.localName === 'fld' ? kid(n, NS_A, 't')?.textContent ?? '' : '')).join('')
}

// Replaces paragraph text, keeping each paragraph's formatting (its settings
// and the look of its first run). Unchanged paragraphs are left exactly as they were.
function setParagraphs(txBody, texts) {
  if (!txBody || !Array.isArray(texts)) return
  const doc = txBody.ownerDocument
  const ps = elKids(txBody).filter(n => n.namespaceURI === NS_A && n.localName === 'p')
  if (!ps.length) return
  const out = texts.map((text, i) => {
    const orig = ps[i]
    if (orig && paragraphText(orig) === text) return orig.cloneNode(true)
    const tpl = orig ?? ps[ps.length - 1]
    const p = doc.createElementNS(NS_A, 'a:p')
    const pPr = kid(tpl, NS_A, 'pPr')
    if (pPr) p.appendChild(pPr.cloneNode(true))
    const firstRun = elKids(tpl).find(n => n.localName === 'r')
    const rPr = kid(firstRun, NS_A, 'rPr') ?? kid(tpl, NS_A, 'endParaRPr')
    if (text) {
      const r = doc.createElementNS(NS_A, 'a:r')
      if (rPr) {
        const rp = doc.createElementNS(NS_A, 'a:rPr')
        for (const a of Array.from(rPr.attributes)) if (!a.name.startsWith('xmlns')) rp.setAttribute(a.name, a.value)
        for (const c of elKids(rPr)) rp.appendChild(c.cloneNode(true))
        r.appendChild(rp)
      }
      const t = doc.createElementNS(NS_A, 'a:t')
      t.textContent = text
      r.appendChild(t)
      p.appendChild(r)
    }
    const end = kid(tpl, NS_A, 'endParaRPr') ?? (rPr ? (() => {
      const e = doc.createElementNS(NS_A, 'a:endParaRPr')
      for (const a of Array.from(rPr.attributes)) if (!a.name.startsWith('xmlns')) e.setAttribute(a.name, a.value)
      return e
    })() : null)
    if (end) p.appendChild(end.cloneNode(true))
    return p
  })
  for (const p of ps) txBody.removeChild(p)
  const before = elKids(txBody).find(n => n.localName === 'extLst') ?? null
  for (const p of out) txBody.insertBefore(p, before)
}

function applyEdits(tree, edits, W, H) {
  const entries = []
  for (const c of elKids(tree)) {
    if (c.localName === 'AlternateContent') {
      for (const b of elKids(c)) for (const sh of elKids(b)) entries.push({ shape: sh, holder: c })
    } else entries.push({ shape: c, holder: c })
  }
  for (const { shape, holder } of entries) {
    const e = edits[shapeKey(shape)]
    if (!e) continue
    if (e.deleted) { holder.parentNode?.removeChild(holder); continue }

    if (e.box && e.from && e.from.w > 0 && e.from.h > 0) {
      const sx = e.box.w / e.from.w, sy = e.box.h / e.from.h
      const x = xfrmOf(shape)
      const off = kid(x, NS_A, 'off'), ext = kid(x, NS_A, 'ext')
      if (off) {
        off.setAttribute('x', String(Math.round((e.box.x + (+off.getAttribute('x') / W - e.from.x) * sx) * W)))
        off.setAttribute('y', String(Math.round((e.box.y + (+off.getAttribute('y') / H - e.from.y) * sy) * H)))
      }
      if (ext) {
        ext.setAttribute('cx', String(Math.max(1, Math.round(+ext.getAttribute('cx') * sx))))
        ext.setAttribute('cy', String(Math.max(1, Math.round(+ext.getAttribute('cy') * sy))))
      }
      // A table's own columns and rows decide its size
      const tbl = desc(shape, NS_A, 'tbl')
      if (tbl) {
        for (const g of Array.from(tbl.getElementsByTagNameNS(NS_A, 'gridCol'))) g.setAttribute('w', String(Math.round(+g.getAttribute('w') * sx)))
        for (const tr of Array.from(tbl.getElementsByTagNameNS(NS_A, 'tr'))) tr.setAttribute('h', String(Math.round(+tr.getAttribute('h') * sy)))
      }
    }

    if (e.paras) setParagraphs(kid(shape, NS_P, 'txBody'), e.paras)

    if (e.cells) {
      const tbl = desc(shape, NS_A, 'tbl')
      kids(tbl, 'tr').forEach((tr, r) => kids(tr, 'tc').forEach((tc, c) => {
        const text = e.cells[r]?.[c]
        if (text == null) return
        const body = kid(tc, NS_A, 'txBody')
        const current = kids(body, 'p').map(paragraphText).join('\n')
        if (current !== text) setParagraphs(body, String(text).split('\n'))
      }))
    }

    const spPr = kid(shape, NS_P, 'spPr')
    const blipFill = kid(shape, NS_P, 'blipFill') ?? kid(spPr, NS_A, 'blipFill')
    if (e.crop && blipFill) {
      const doc = shape.ownerDocument
      const old = kid(blipFill, NS_A, 'srcRect')
      if (old) blipFill.removeChild(old)
      const [l, t, r, b] = e.crop.map(v => Math.round((+v || 0) * 100000))
      if (l || t || r || b) {
        const rect = doc.createElementNS(NS_A, 'a:srcRect')
        rect.setAttribute('l', String(l)); rect.setAttribute('t', String(t)); rect.setAttribute('r', String(r)); rect.setAttribute('b', String(b))
        const blip = kid(blipFill, NS_A, 'blip')
        blipFill.insertBefore(rect, blip ? blip.nextSibling : blipFill.firstChild)
      }
    }
    if (e.radius != null && spPr) {
      const geom = kid(spPr, NS_A, 'prstGeom')
      const prst = geom?.getAttribute('prst') ?? 'rect'
      if (['rect', 'roundRect', 'ellipse'].includes(prst) || !kid(spPr, NS_A, 'custGeom')) {
        const doc = shape.ownerDocument
        const r = Math.max(0, Math.min(0.5, +e.radius || 0))
        const next = doc.createElementNS(NS_A, 'a:prstGeom')
        next.setAttribute('prst', r > 0 ? 'roundRect' : 'rect')
        const av = doc.createElementNS(NS_A, 'a:avLst')
        if (r > 0) {
          const gd = doc.createElementNS(NS_A, 'a:gd')
          gd.setAttribute('name', 'adj')
          gd.setAttribute('fmla', `val ${Math.round(r * 100000)}`)
          av.appendChild(gd)
        }
        next.appendChild(av)
        if (geom) spPr.replaceChild(next, geom)
        else spPr.insertBefore(next, elKids(spPr).find(n => n.localName !== 'xfrm') ?? null)
      }
    }
  }
}
const kids = (el, name) => elKids(el).filter(n => n.namespaceURI === NS_A && n.localName === name)

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * The slide's content as stand-alone shapes (XML for inside a p:spTree).
 *   placement:   { s, dx, dy } to move it into the template's content area
 *                (EMU) — or a function of the content's bounds returning
 *                one — or null to keep the original coordinates
 *   rIdMap:      old relationship id → new id (ids missing from it are kept)
 *   firstId:     first shape id to use
 */
export function resolveSlideShapes(ctx, { placement = null, rIdMap = null, firstId = 1000, defaultTableStyleId = null, keepIds = false, edits = null, slideW = null, slideH = null } = {}) {
  const doc  = ctx.slideDoc
  const tree = desc(doc, NS_P, 'spTree')
  if (!tree) return ''
  const work = tree.cloneNode(true)
  for (const c of elKids(work)) {
    if (c.localName === 'nvGrpSpPr' || c.localName === 'grpSpPr') { work.removeChild(c); continue }
    const r = resolveShape(ctx, c, { defaultTableStyleId })
    if (!r) work.removeChild(c)
  }
  // Where the content sits before any edits (placement keeps it there)
  const bounds = contentBounds(work)
  if (edits && slideW && slideH) applyEdits(work, edits, slideW, slideH)
  // placement can depend on where the content sits: (bounds) => { s, dx, dy }
  if (placement) place(work, typeof placement === 'function' ? placement(bounds) : placement)

  if (keepIds) {
    const ser = new XMLSerializer()
    return resolveThemeRefs(ctx, elKids(work).map(c => ser.serializeToString(c)).join(''))
  }

  // Fresh shape ids (connectors refer to shapes by id)
  const ids = new Map()
  let next = firstId
  for (const c of Array.from(work.getElementsByTagNameNS(NS_P, 'cNvPr'))) {
    const old = c.getAttribute('id')
    if (!ids.has(old)) ids.set(old, String(next++))
    c.setAttribute('id', ids.get(old))
  }
  for (const tag of ['stCxn', 'endCxn']) {
    for (const c of Array.from(work.getElementsByTagNameNS(NS_A, tag))) if (ids.has(c.getAttribute('id'))) c.setAttribute('id', ids.get(c.getAttribute('id')))
  }
  if (rIdMap) {
    for (const el of Array.from(work.getElementsByTagName('*'))) {
      for (const a of Array.from(el.attributes)) {
        if (a.namespaceURI === NS_R && rIdMap[a.value]) el.setAttributeNS(NS_R, a.name, rIdMap[a.value])
      }
    }
  }
  const ser = new XMLSerializer()
  return resolveThemeRefs(ctx, elKids(work).map(c => ser.serializeToString(c)).join(''))
}

// Charts: theme colours become fixed ones, and series that rely on the theme
// for their colour get it written in (accent 1, 2, 3…)
export function resolveChartXml(ctx, xml) {
  const doc = parse(xml)
  const accent = i => schemeHex(ctx, `accent${(i % 6) + 1}`)
  const mk = (name, ns = NS_C) => doc.createElementNS(ns, ns === NS_C ? `c:${name}` : `a:${name}`)
  const solid = hex => {
    const f = mk('solidFill', NS_A)
    const c = mk('srgbClr', NS_A)
    c.setAttribute('val', hex)
    f.appendChild(c)
    return f
  }
  const lineTypes = new Set(['lineChart', 'line3DChart', 'scatterChart', 'radarChart', 'stockChart'])
  const pieTypes  = new Set(['pieChart', 'pie3DChart', 'doughnutChart', 'ofPieChart'])
  for (const ser of Array.from(doc.getElementsByTagNameNS(NS_C, 'ser'))) {
    const chartType = ser.parentNode?.localName ?? ''
    const i = +(kid(ser, NS_C, 'idx')?.getAttribute('val') ?? 0)
    const after = kid(ser, NS_C, 'tx') ?? kid(ser, NS_C, 'order') ?? kid(ser, NS_C, 'idx')
    if (!kid(ser, NS_C, 'spPr')) {
      const spPr = mk('spPr')
      if (lineTypes.has(chartType)) {
        const ln = mk('ln', NS_A)
        ln.setAttribute('w', '28575')
        ln.appendChild(solid(accent(i)))
        spPr.appendChild(ln)
      } else spPr.appendChild(solid(accent(i)))
      ser.insertBefore(spPr, after?.nextSibling ?? null)
    }
    const vary = kid(ser.parentNode, NS_C, 'varyColors')?.getAttribute('val')
    if (pieTypes.has(chartType) && vary !== '0' && !kid(ser, NS_C, 'dPt')) {
      const n = +(desc(kid(ser, NS_C, 'val'), NS_C, 'ptCount')?.getAttribute('val') ?? 0)
      const before = elKids(ser).find(c => ['dLbls', 'cat', 'val', 'extLst'].includes(c.localName)) ?? null
      for (let p = 0; p < n; p++) {
        const dPt = mk('dPt')
        const idx = mk('idx'); idx.setAttribute('val', String(p))
        const b3d = mk('bubble3D'); b3d.setAttribute('val', '0')
        const spPr = mk('spPr'); spPr.appendChild(solid(accent(p)))
        dPt.appendChild(idx); dPt.appendChild(b3d); dPt.appendChild(spPr)
        ser.insertBefore(dPt, before)
      }
    }
  }
  // Chart text: the original theme's body font and text colour
  const space = doc.documentElement
  if (space?.namespaceURI === NS_C && !kid(space, NS_C, 'txPr')) {
    const txPr = parse(`<c:txPr xmlns:c="${NS_C}" xmlns:a="${NS_A}"><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:solidFill><a:srgbClr val="${schemeHex(ctx, 'tx1')}"/></a:solidFill><a:latin typeface="${escapeAttr(ctx.fonts.mn.lt)}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`).documentElement
    const before = elKids(space).find(c => ['externalData', 'printSettings', 'userShapes', 'extLst'].includes(c.localName)) ?? null
    space.insertBefore(doc.importNode(txPr, true), before)
  }
  return resolveThemeRefs(ctx, new XMLSerializer().serializeToString(doc))
}

// ── Table styles ──────────────────────────────────────────────────────────────
// Built-in table styles aren't stored in the file — PowerPoint draws them from
// the deck's theme. "Medium Style 2" (PowerPoint's default) is written out
// here so its colours come from the original theme instead of the template's.
const MEDIUM_STYLE_2 = {
  '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'dk1',
  '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'accent1',
  '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'accent2',
  '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'accent3',
  '{00A15C55-8517-42AA-B614-E9B94910E393}': 'accent4',
  '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'accent5',
  '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'accent6',
}

function mediumStyle2(id, accent) {
  const fill = (val, mod = '') => `<a:fill><a:solidFill><a:schemeClr val="${val}">${mod}</a:schemeClr></a:solidFill></a:fill>`
  const side = (n, w = 12700) => `<a:${n}><a:ln w="${w}" cmpd="sng"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln></a:${n}>`
  const txt = (color, bold) => `<a:tcTxStyle${bold ? ' b="on"' : ''}><a:font><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:font><a:schemeClr val="${color}"/></a:tcTxStyle>`
  const band = `<a:tcStyle><a:tcBdr/>${fill(accent, '<a:tint val="40000"/>')}</a:tcStyle>`
  const strong = border => `${txt('lt1', true)}<a:tcStyle><a:tcBdr>${border}</a:tcBdr>${fill(accent)}</a:tcStyle>`
  return `<a:tblStyle styleId="${id}" styleName="Medium Style 2">`
    + `<a:wholeTbl>${txt('dk1')}<a:tcStyle><a:tcBdr>${['left', 'right', 'top', 'bottom', 'insideH', 'insideV'].map(n => side(n)).join('')}</a:tcBdr>${fill(accent, '<a:tint val="20000"/>')}</a:tcStyle></a:wholeTbl>`
    + `<a:band1H>${band}</a:band1H><a:band2H><a:tcStyle><a:tcBdr/></a:tcStyle></a:band2H>`
    + `<a:band1V>${band}</a:band1V><a:band2V><a:tcStyle><a:tcBdr/></a:tcStyle></a:band2V>`
    + `<a:lastCol>${strong('')}</a:lastCol><a:firstCol>${strong('')}</a:firstCol>`
    + `<a:lastRow>${strong(side('top', 38100))}</a:lastRow><a:firstRow>${strong(side('bottom', 38100))}</a:firstRow>`
    + '</a:tblStyle>'
}

// The table style with this id from the original file, colours and fonts
// fixed, renamed to newId — or null when it isn't known
export function resolvedTableStyle(ctx, tableStylesXml, id, newId) {
  const stored = tableStylesXml?.match(/<a:tblStyle\b[\s\S]*?<\/a:tblStyle>/g)?.find(m => m.includes(`styleId="${id}"`))
  const xml = stored ?? (MEDIUM_STYLE_2[id] ? mediumStyle2(id, MEDIUM_STYLE_2[id]) : null)
  if (!xml) return null
  return resolveThemeRefs(ctx, xml.replace(/styleId="[^"]*"/, `styleId="${newId}"`))
}

export const defaultTableStyleId = tableStylesXml => tableStylesXml?.match(/<a:tblStyleLst\b[^>]*\bdef="([^"]+)"/)?.[1] ?? '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}'

// A table style's fills and text colours for a preview
export function tableStyleLook(xml) {
  if (!xml) return null
  const doc = parse(`<r xmlns:a="${NS_A}">${xml}</r>`)
  const look = {}
  for (const part of ['wholeTbl', 'band1H', 'band2H', 'firstRow', 'lastRow', 'firstCol', 'lastCol']) {
    const el = desc(doc, NS_A, part)
    if (!el) continue
    const fill = desc(desc(kid(el, NS_A, 'tcStyle'), NS_A, 'fill'), NS_A, 'solidFill')
    const tx = kid(el, NS_A, 'tcTxStyle')
    const bdr = desc(desc(kid(el, NS_A, 'tcStyle'), NS_A, 'tcBdr'), NS_A, 'solidFill')
    look[part] = {
      fill: fill ? colorOf(fill) : null,
      border: bdr ? colorOf(bdr) : null,
      color: tx ? colorOf(tx) : null,
      bold: tx?.getAttribute('b') === 'on',
    }
  }
  return look
}

// ── Colours for previews ──────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = rgb => `#${rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hslToRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = t => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

const PRESET = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080' }

// First colour inside an element (solidFill, tcTxStyle…) → '#rrggbb' or 'rgba(…)'
export function colorOf(el) {
  const c = elKids(el).find(n => n.namespaceURI === NS_A && /Clr$/.test(n.localName))
  if (!c) return null
  let hex = c.localName === 'srgbClr' ? c.getAttribute('val')
    : c.localName === 'sysClr' ? c.getAttribute('lastClr')
    : c.localName === 'prstClr' ? PRESET[c.getAttribute('val')] ?? '000000'
    : null
  if (!hex) return null
  let rgb = hexToRgb(hex)
  let alpha = 1
  for (const m of elKids(c)) {
    const v = +(m.getAttribute('val') ?? 100000) / 100000
    if (m.localName === 'lumMod' || m.localName === 'lumOff') {
      const hsl = rgbToHsl(rgb)
      hsl[2] = m.localName === 'lumMod' ? hsl[2] * v : hsl[2] + v
      hsl[2] = Math.max(0, Math.min(1, hsl[2]))
      rgb = hslToRgb(hsl)
    } else if (m.localName === 'tint') rgb = rgb.map(x => 255 - (255 - x) * v)
    else if (m.localName === 'shade') rgb = rgb.map(x => x * v)
    else if (m.localName === 'alpha') alpha = v
  }
  return alpha < 1 ? `rgba(${rgb.map(Math.round).join(',')},${alpha})` : toHex(rgb)
}
