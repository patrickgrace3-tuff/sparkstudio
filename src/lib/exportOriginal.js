/**
 * exportOriginal.js
 *
 * Copies slides imported with "Keep original styling" into an export
 * unchanged. Each slide's XML is written verbatim, and every part it needs
 * (layout, master, theme, images, charts…) is copied from the stored original
 * under a new name so it can't clash with the template's own parts. Masters
 * and layouts shared by several slides of the same import are copied once.
 */

import { loadOriginalPackage } from './originalSlides.js'

const REL_NS   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MASTER_T = `${REL_NS}/slideMaster`

const dirOf  = p => p.split('/').slice(0, -1).join('/')
const relsOf = p => `${dirOf(p)}/_rels/${p.split('/').pop()}.rels`

// "../media/image1.png" from "ppt/slides" → "ppt/media/image1.png"
function resolve(baseDir, target) {
  if (target.startsWith('/')) return target.slice(1)
  const out = baseDir ? baseDir.split('/') : []
  for (const seg of target.split('/')) {
    if (seg === '..') out.pop()
    else if (seg && seg !== '.') out.push(seg)
  }
  return out.join('/')
}

// Relative path from one folder to a part, e.g. ppt/slides → ppt/media/x.png = ../media/x.png
function relative(fromDir, toPath) {
  const from = fromDir ? fromDir.split('/') : []
  const to   = toPath.split('/')
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/')
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

export function createOriginalSplicer(zip, clientId) {
  const pkgCache = new Map()
  const copied   = new Map()  // `${ref}|${origPath}` → new path
  const types    = []         // [path, contentType] for [Content_Types].xml
  const masters  = []         // new slide master paths
  const tableStyles = new Map() // styleId → <a:tblStyle> from the originals
  let hasTables = false
  let counter = 0
  let nextLayoutId = null     // master and layout ids share one numbering

  async function initIds() {
    if (nextLayoutId != null) return
    let max = 2147483647
    const take = xml => { for (const m of xml.matchAll(/<p:(?:sldMasterId|sldLayoutId)\s[^>]*?id="(\d+)"/g)) max = Math.max(max, +m[1]) }
    take(await zip.file('ppt/presentation.xml').async('string'))
    for (const f of Object.keys(zip.files).filter(f => /^ppt\/slideMasters\/[^/]+\.xml$/.test(f))) take(await zip.file(f).async('string'))
    nextLayoutId = max + 1
  }

  const newName = path => {
    const dir = dirOf(path), file = path.split('/').pop()
    const dot = file.lastIndexOf('.')
    counter++
    return `${dir}/${dot > 0 ? file.slice(0, dot) : file}_k${counter}${dot > 0 ? file.slice(dot) : ''}`
  }

  // Rewrites a part's relationships so they point at the copied parts.
  // Links to parts that weren't kept (notes, other slides) are dropped.
  async function rewriteRels(pkg, ref, origPath, newPath) {
    const relsXml = pkg.parts[relsOf(origPath)]
    if (typeof relsXml !== 'string') return null
    const baseDir = dirOf(origPath)
    const out = []
    for (const tag of relsXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
      if (attr(tag, 'TargetMode') === 'External') { out.push(tag); continue }
      const target = attr(tag, 'Target')
      const origTarget = target && resolve(baseDir, target)
      if (!origTarget || !(origTarget in pkg.parts)) continue
      const copiedTarget = await copyPart(pkg, ref, origTarget)
      out.push(tag.replace(/\sTarget="[^"]*"/, ` Target="${relative(dirOf(newPath), copiedTarget)}"`))
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${out.join('')}</Relationships>`
  }

  async function copyPart(pkg, ref, origPath) {
    const key = `${ref}|${origPath}`
    if (copied.has(key)) return copied.get(key)
    const path = newName(origPath)
    copied.set(key, path) // set first — masters and layouts point at each other

    let data = pkg.parts[origPath]
    const relsXml = await rewriteRels(pkg, ref, origPath, path)
    const type = pkg.types?.[origPath] ?? 'application/octet-stream'
    if (type.includes('slideMaster+xml') && typeof data === 'string') {
      await initIds()
      data = data.replace(/(<p:sldLayoutId\s[^>]*?id=")(\d+)(")/g, (_, a, __, c) => `${a}${nextLayoutId++}${c}`)
      masters.push(path)
    }
    if (typeof data === 'string') zip.file(path, data)
    else zip.file(path, data?.b64 ?? '', { base64: true })
    if (relsXml) zip.file(relsOf(path), relsXml)
    types.push([path, type])
    return path
  }

  // Adds the originals' table styles to the deck (creating ppt/tableStyles.xml
  // when the template has none)
  async function addTableStyles() {
    const path = 'ppt/tableStyles.xml'
    const file = zip.file(path)
    if (file) {
      const xml = await file.async('string')
      const add = [...tableStyles].filter(([id]) => !xml.includes(`styleId="${id}"`)).map(([, m]) => m).join('')
      if (!add) return
      zip.file(path, /<a:tblStyleLst\b[^>]*\/>/.test(xml)
        ? xml.replace(/<a:tblStyleLst\b([^>]*)\/>/, `<a:tblStyleLst$1>${add}</a:tblStyleLst>`)
        : xml.replace('</a:tblStyleLst>', `${add}</a:tblStyleLst>`))
      return
    }
    zip.file(path, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">${[...tableStyles.values()].join('')}</a:tblStyleLst>`)
    types.push([path, 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml'])
    const rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
    zip.file('ppt/_rels/presentation.xml.rels', rels.replace('</Relationships>', `<Relationship Id="rIdOrigTableStyles" Type="${REL_NS}/tableStyles" Target="tableStyles.xml"/>\n</Relationships>`))
  }

  return {
    // → { xml, relsXml } for the slide written at slideFilename, or null when
    // the stored original can't be found (the caller then falls back)
    async slide(original, slideFilename) {
      const pkg = await loadOriginalPackage(clientId, original.ref, pkgCache).catch(() => null)
      const xml = pkg?.parts?.[original.slidePath]
      if (typeof xml !== 'string') return null
      if (xml.includes('<a:tbl>')) hasTables = true
      for (const m of pkg.tableStyles?.match(/<a:tblStyle\b[\s\S]*?<\/a:tblStyle>/g) ?? []) {
        const id = attr(m, 'styleId')
        if (id && xml.includes(id) && !tableStyles.has(id)) tableStyles.set(id, m)
      }
      const baseDir = dirOf(original.slidePath)
      const tags = []
      for (const tag of pkg.parts[relsOf(original.slidePath)]?.match(/<Relationship\b[^>]*\/>/g) ?? []) {
        if (attr(tag, 'TargetMode') === 'External') { tags.push(tag); continue }
        const origTarget = resolve(baseDir, attr(tag, 'Target') ?? '')
        if (!(origTarget in pkg.parts) || origTarget === original.slidePath) continue
        const copiedTarget = await copyPart(pkg, original.ref, origTarget)
        tags.push(tag.replace(/\sTarget="[^"]*"/, ` Target="${relative(dirOf(slideFilename), copiedTarget)}"`))
      }
      return {
        xml,
        relsXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tags.join('')}</Relationships>`,
      }
    },

    // Registers the copied parts: content types, plus the copied masters in
    // presentation.xml (PowerPoint needs every master listed there)
    async finish() {
      if (hasTables || tableStyles.size) await addTableStyles()
      if (!types.length) return
      let ct = await zip.file('[Content_Types].xml').async('string')
      ct = ct.replace('</Types>', `${types.map(([p, t]) => `<Override PartName="/${p}" ContentType="${t}"/>`).join('\n')}\n</Types>`)
      zip.file('[Content_Types].xml', ct)
      if (!masters.length) return

      await initIds()
      let pres = await zip.file('ppt/presentation.xml').async('string')
      let rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
      const entries = masters.map((m, i) => ({ id: nextLayoutId++, rId: `rIdOrigMaster${i + 1}`, target: relative('ppt', m) }))
      const ids = entries.map(e => `<p:sldMasterId id="${e.id}" r:id="${e.rId}"/>`).join('')
      pres = pres.includes('</p:sldMasterIdLst>')
        ? pres.replace('</p:sldMasterIdLst>', `${ids}</p:sldMasterIdLst>`)
        : pres.replace(/(<p:presentation\b[^>]*>)/, `$1<p:sldMasterIdLst>${ids}</p:sldMasterIdLst>`)
      rels = rels.replace('</Relationships>', `${entries.map(e => `<Relationship Id="${e.rId}" Type="${MASTER_T}" Target="${e.target}"/>`).join('\n')}\n</Relationships>`)
      zip.file('ppt/presentation.xml', pres)
      zip.file('ppt/_rels/presentation.xml.rels', rels)
    },
  }
}
