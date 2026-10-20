import JSZip from 'jszip'
import { WHEEL_QUADS, uid } from './team.js'

// Builds a My Team setup from an existing "My Team" PowerPoint slide: every
// photo circle becomes a team member with the picture exactly as cropped on
// the slide and its place on the wheel kept. Names, titles and companies are
// read from the text next to photos where the slide has them (side groups,
// the Client Services lead); everyone else comes in unnamed to fill in.

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

const parse = xml => new DOMParser().parseFromString(xml, 'text/xml')
const elKids = el => Array.from(el?.childNodes ?? []).filter(n => n.nodeType === 1)
const kid  = (el, ns, name) => elKids(el).find(n => n.namespaceURI === ns && n.localName === name) ?? null
const desc = (el, ns, name) => el?.getElementsByTagNameNS(ns, name)[0] ?? null

function resolvePath(base, target) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

async function loadRels(zip, partPath) {
  const dir = partPath.split('/').slice(0, -1).join('/')
  const file = zip.file(`${dir}/_rels/${partPath.split('/').pop()}.rels`)
  const map = {}
  if (!file) return map
  for (const r of parse(await file.async('string')).getElementsByTagNameNS(NS_PKG, 'Relationship')) {
    if (r.getAttribute('TargetMode') === 'External') continue
    map[r.getAttribute('Id')] = resolvePath(partPath, r.getAttribute('Target'))
  }
  return map
}

function readXfrm(xfrm) {
  const off = kid(xfrm, NS_A, 'off'), ext = kid(xfrm, NS_A, 'ext')
  if (!off || !ext) return null
  return { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx'), h: +ext.getAttribute('cy') }
}

function groupTransform(grpSp, parent) {
  const xfrm = kid(kid(grpSp, NS_P, 'grpSpPr'), NS_A, 'xfrm')
  const b = readXfrm(xfrm)
  const chOff = kid(xfrm, NS_A, 'chOff'), chExt = kid(xfrm, NS_A, 'chExt')
  if (!b || !chOff || !chExt) return parent
  const cx = +chOff.getAttribute('x'), cy = +chOff.getAttribute('y')
  const cw = +chExt.getAttribute('cx') || 1, ch = +chExt.getAttribute('cy') || 1
  return r => parent({ x: b.x + (r.x - cx) * (b.w / cw), y: b.y + (r.y - cy) * (b.h / ch), w: r.w * (b.w / cw), h: r.h * (b.h / ch) })
}

// Text boxes as lines: [{ text, bold, size }]
function textLines(txBody) {
  return elKids(txBody).filter(p => p.localName === 'p').map(p => {
    const runs = elKids(p).filter(n => n.localName === 'r' || n.localName === 'fld')
    const text = runs.map(r => kid(r, NS_A, 't')?.textContent ?? '').join('').replace(/\s+/g, ' ').trim()
    const rPr = runs.map(r => kid(r, NS_A, 'rPr')).find(Boolean)
    return { text, bold: ['1', 'true'].includes(rPr?.getAttribute('b')), size: +(rPr?.getAttribute('sz') ?? 0) / 100 }
  }).filter(l => l.text)
}

// Everything on the slide: pictures, text boxes, round shapes (to find the wheel)
async function collect(zip, rels, container, transform, out) {
  for (const el of elKids(container)) {
    if (el.localName === 'AlternateContent') {
      const branch = elKids(el).find(b => b.localName === 'Fallback') ?? elKids(el).find(b => b.localName === 'Choice')
      if (branch) await collect(zip, rels, branch, transform, out)
      continue
    }
    if (el.namespaceURI !== NS_P) continue
    if (el.localName === 'grpSp') { await collect(zip, rels, el, groupTransform(el, transform), out); continue }
    if (el.localName !== 'pic' && el.localName !== 'sp') continue
    const spPr = kid(el, NS_P, 'spPr')
    const raw = readXfrm(kid(spPr, NS_A, 'xfrm'))
    if (!raw) continue
    const rect = transform(raw)
    const blipFill = kid(el, NS_P, 'blipFill') ?? kid(spPr, NS_A, 'blipFill')
    const blip = desc(blipFill, NS_A, 'blip')
    const geom = kid(spPr, NS_A, 'prstGeom')?.getAttribute('prst') ?? 'rect'
    if (blip) {
      const src = desc(blipFill, NS_A, 'srcRect')
      const v = k => +(src?.getAttribute(k) ?? 0) / 100000
      out.pictures.push({ rect, path: rels[blip.getAttributeNS(NS_R, 'embed')], crop: { l: v('l'), t: v('t'), r: v('r'), b: v('b') }, geom })
    }
    const txBody = kid(el, NS_P, 'txBody')
    const lines = txBody ? textLines(txBody) : []
    if (lines.length) out.texts.push({ rect, lines })
    if (!blip && ['ellipse', 'donut', 'blockArc', 'arc', 'pie', 'chord'].includes(geom)) out.rounds.push({ rect })
  }
}

// The picture as shown on the slide (cropped, frame shape) → JPEG data URL
async function framedPhoto(zip, pic, size = 320) {
  const file = pic.path && zip.file(pic.path)
  if (!file) return null
  const ext = pic.path.split('.').pop().toLowerCase()
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext]
  if (!mime) return null
  try {
    const bmp = await createImageBitmap(new Blob([await file.async('uint8array')], { type: mime }))
    const { l, t, r, b } = pic.crop
    const sx = l * bmp.width, sy = t * bmp.height
    const sw = Math.max(1, (1 - l - r) * bmp.width), sh = Math.max(1, (1 - t - b) * bmp.height)
    const aspect = pic.rect.w / pic.rect.h
    const canvas = document.createElement('canvas')
    canvas.width = aspect >= 1 ? size : Math.round(size * aspect)
    canvas.height = aspect >= 1 ? Math.round(size / aspect) : size
    const g = canvas.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return null
  }
}

const centerOf = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const norm = deg => ((deg % 360) + 360) % 360
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
const lettersOnly = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Where a wheel photo belongs: quadrant, then the nearest sub-department
// label (or the quadrant's own department near its middle)
function deptForAngle(angle) {
  const a = norm(angle)
  const q = WHEEL_QUADS.find(q => {
    const s = norm(q.start), span = q.end - q.start
    return norm(a - s) < span
  }) ?? WHEEL_QUADS[0]
  const options = [{ id: q.id, angle: q.labelAngle }, ...q.subs]
  return options.reduce((best, o) => (angleDiff(a, o.angle) < angleDiff(a, best.angle) ? o : best)).id
}

// Slides in the file, with how likely each is to be the My Team slide
async function findTeamSlide(zip) {
  const presDoc = parse(await zip.file('ppt/presentation.xml').async('string'))
  const presRels = await loadRels(zip, 'ppt/presentation.xml')
  const sz = desc(presDoc, NS_P, 'sldSz')
  const W = +sz?.getAttribute('cx') || 12192000, H = +sz?.getAttribute('cy') || 6858000
  const order = Array.from(presDoc.getElementsByTagNameNS(NS_P, 'sldId')).map(s => presRels[s.getAttributeNS(NS_R, 'id')]).filter(Boolean)
  let best = null
  for (const path of order) {
    const doc = parse(await zip.file(path).async('string'))
    const rels = await loadRels(zip, path)
    const out = { pictures: [], texts: [], rounds: [] }
    await collect(zip, rels, desc(doc, NS_P, 'spTree'), r => r, out)
    const photos = out.pictures.filter(p => isPhoto(p, H))
    const titled = out.texts.some(t => t.lines.some(l => /\bmy\s+team\b/i.test(l.text)))
    const score = (titled ? 1000 : 0) + photos.length
    if (!best || score > best.score) best = { path, out, photos, score, W, H }
  }
  return best
}

// A person's photo: a small, roughly square picture
function isPhoto(p, H) {
  const { w, h } = p.rect
  const ratio = w / h
  return ratio > 0.75 && ratio < 1.33 && Math.min(w, h) > H * 0.02 && Math.max(w, h) < H * 0.3
}

/**
 * Reads a My Team slide from a .pptx.
 * existingGroups: the current sidebar groups (matched by name; new ones added)
 * → { members, groups, summary }
 */
export async function importTeamFromPptx(file, existingGroups = []) {
  const zip = await JSZip.loadAsync(file)
  const slide = await findTeamSlide(zip)
  if (!slide || !slide.photos.length) throw new Error('No team photos were found in this PowerPoint.')
  const { out, photos, W, H } = slide

  // The wheel: the largest round shape on the slide, or the standard layout
  const ring = out.rounds
    .filter(s => Math.abs(s.rect.w - s.rect.h) < s.rect.w * 0.08 && s.rect.w > H * 0.4)
    .sort((a, b) => b.rect.w - a.rect.w)[0]
  const wheel = ring
    ? { cx: ring.rect.x + ring.rect.w / 2, cy: ring.rect.y + ring.rect.h / 2, unit: ring.rect.w / 600 }
    : { cx: W * 0.4119, cy: H * 0.4955, unit: (H * 0.4464) / 300 }
  const toWheel = p => ({ x: 300 + (p.x - wheel.cx) / wheel.unit, y: 300 + (p.y - wheel.cy) / wheel.unit })
  const panelLeft = W * 0.69

  // Side group headings: text in the right panel that isn't next to a photo
  const nextToPhoto = t => photos.some(ph => {
    const c = centerOf(ph.rect), tc = centerOf(t.rect)
    return t.rect.x >= ph.rect.x + ph.rect.w * 0.5 && t.rect.x - (ph.rect.x + ph.rect.w) < W * 0.05 && Math.abs(tc.y - c.y) < ph.rect.h * 0.75
  })
  const headings = out.texts
    .filter(t => t.rect.x >= panelLeft - W * 0.02 && !nextToPhoto(t))
    .map(t => ({ y: t.rect.y, label: t.lines.map(l => l.text).join(' ').toUpperCase() }))
    .sort((a, b) => a.y - b.y)
  const groups = [...existingGroups]
  const groupFor = label => {
    const hit = groups.find(g => lettersOnly(g.label) === lettersOnly(label))
    if (hit) return hit.id
    const g = { id: uid(), label }
    groups.push(g)
    return g.id
  }

  // Lines of text beside a side-group photo: name, title, company
  const linesBeside = ph => {
    const c = centerOf(ph.rect)
    return out.texts
      .filter(t => {
        const tc = centerOf(t.rect)
        return t.rect.x >= ph.rect.x + ph.rect.w * 0.5 && t.rect.x - (ph.rect.x + ph.rect.w) < W * 0.08 && Math.abs(tc.y - c.y) < ph.rect.h * 0.8
      })
      .sort((a, b) => a.rect.y - b.rect.y)
      .flatMap(t => t.lines.map(l => l.text))
  }

  const members = []
  const center = []
  for (const ph of photos) {
    const c = centerOf(ph.rect)
    const imageDataUrl = await framedPhoto(zip, ph)
    if (c.x >= panelLeft) {
      const heading = [...headings].reverse().find(h => h.y <= c.y)
      const lines = linesBeside(ph)
      members.push({
        id: uid(), name: lines[0] ?? '', title: lines[1] ?? '', company: lines.slice(2).join(' '),
        deptId: null, groupId: heading ? groupFor(heading.label) : (groups[0]?.id ?? null), isCenter: false,
        imageDataUrl, wx: null, wy: null,
      })
      continue
    }
    const w = toWheel(c)
    const r = Math.hypot(w.x - 300, w.y - 300)
    if (r > 305) continue // not on the wheel
    if (r < 105) { center.push({ ph, w, imageDataUrl }); continue }
    const angle = (Math.atan2(w.x - 300, -(w.y - 300)) * 180) / Math.PI
    members.push({
      id: uid(), name: '', title: '', company: '', deptId: deptForAngle(angle), groupId: null, isCenter: false,
      imageDataUrl, wx: w.x, wy: w.y,
    })
  }

  // Client Services: the largest photo in the middle is the lead (their name
  // and title are the text under it); the others are their team
  center.sort((a, b) => b.ph.rect.w - a.ph.rect.w)
  center.forEach(({ ph, w, imageDataUrl }, i) => {
    if (i === 0) {
      const below = out.texts
        .filter(t => {
          const tc = toWheel(centerOf(t.rect))
          return Math.hypot(tc.x - 300, tc.y - 300) < 95 && t.rect.y >= ph.rect.y + ph.rect.h * 0.6
        })
        .sort((a, b) => a.rect.y - b.rect.y)
        .flatMap(t => t.lines.map(l => l.text))
        .filter(l => !/client\s+services/i.test(l))
      members.unshift({ id: uid(), name: below[0] ?? '', title: below[1] ?? '', company: '', deptId: 'client_services', groupId: null, isCenter: true, imageDataUrl, wx: null, wy: null })
    } else {
      members.push({ id: uid(), name: '', title: '', company: '', deptId: 'client_services', groupId: null, isCenter: false, imageDataUrl, wx: w.x, wy: w.y })
    }
  })

  const summary = {
    total: members.length,
    lead: members.filter(m => m.isCenter).length,
    clientServices: members.filter(m => m.deptId === 'client_services' && !m.isCenter).length,
    wheel: members.filter(m => m.deptId && m.deptId !== 'client_services').length,
    grouped: members.filter(m => m.groupId).length,
    unnamed: members.filter(m => !m.name).length,
    newGroups: groups.filter(g => !existingGroups.some(e => e.id === g.id)).map(g => g.label),
  }
  return { members, groups, summary }
}
