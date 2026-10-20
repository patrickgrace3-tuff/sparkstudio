/**
 * exportOriginal.js
 *
 * Writes slides imported with "Keep original styling" into an export: each
 * becomes a Spark Studio content slide (the template's background, logo and
 * header) carrying the original slide's shapes, unchanged apart from being
 * scaled to fit under the header. Pictures, charts and other parts the shapes
 * use are copied from the stored original under new names.
 */

import { loadOriginalPackage, fitOnTemplate, contentBoundsOf, effectiveEdits } from './originalSlides.js'
import { themeContext, readRels, relsPathOf, resolveSlideShapes, resolveChartXml, resolveThemeRefs, resolvedTableStyle, defaultTableStyleId } from './pptxResolve.js'

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const dirOf  = p => p.split('/').slice(0, -1).join('/')
const SKIP_RELS = /\/(slideLayout|notesSlide|notesMaster|slide)$/

// Relative path from one folder to a part, e.g. ppt/slides → ppt/media/x.png = ../media/x.png
function relative(fromDir, toPath) {
  const from = fromDir ? fromDir.split('/') : []
  const to   = toPath.split('/')
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/')
}

const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Stable GUID-like id from a string
function guidFor(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + str.charCodeAt(i), 2246822519) >>> 0
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2).toUpperCase()
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}}`
}

export function createOriginalSplicer(zip, clientId) {
  const pkgCache    = new Map()
  const copied      = new Map()  // `${ref}|${origPath}` → new path
  const types       = []         // [path, contentType] for [Content_Types].xml
  const tableStyles = new Map()  // new style id → <a:tblStyle>
  let counter = 0

  const newName = path => {
    const dir = dirOf(path), file = path.split('/').pop()
    const dot = file.lastIndexOf('.')
    counter++
    return `${dir}/${dot > 0 ? file.slice(0, dot) : file}_k${counter}${dot > 0 ? file.slice(dot) : ''}`
  }

  // Copies a part (and what it links to). Theme colours and fonts in XML parts
  // are fixed to the original theme's values.
  async function copyPart(pkg, ctx, ref, origPath) {
    const key = `${ref}|${origPath}`
    if (copied.has(key)) return copied.get(key)
    const path = newName(origPath)
    copied.set(key, path)

    const type = pkg.types?.[origPath] ?? 'application/octet-stream'
    let data = pkg.parts[origPath]
    if (typeof data === 'string' && /\.xml$/i.test(origPath)) {
      data = type.includes('drawingml.chart+xml') ? resolveChartXml(ctx, data) : resolveThemeRefs(ctx, data)
    }
    const get = p => (typeof pkg.parts[p] === 'string' ? pkg.parts[p] : null)
    const tags = []
    for (const [id, rel] of Object.entries(readRels(get, origPath))) {
      if (rel.external) { tags.push(`<Relationship Id="${id}" Type="${rel.type}" Target="${escapeAttr(rel.target)}" TargetMode="External"/>`); continue }
      if (!(rel.path in pkg.parts) || SKIP_RELS.test(rel.type)) continue
      const target = await copyPart(pkg, ctx, ref, rel.path)
      tags.push(`<Relationship Id="${id}" Type="${rel.type}" Target="${relative(dirOf(path), target)}"/>`)
    }
    if (typeof data === 'string') zip.file(path, data)
    else zip.file(path, data?.b64 ?? '', { base64: true })
    if (tags.length || get(relsPathOf(origPath))) {
      zip.file(relsPathOf(path), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tags.join('')}</Relationships>`)
    }
    types.push([path, type])
    return path
  }

  return {
    // → { xml, relsXml } for the slide written at slideFilename, built on the
    // template's content slide (base = { xml, rels }), or null when the stored
    // original can't be found (the caller then falls back)
    async slide(original, slideFilename, base) {
      const pkg = await loadOriginalPackage(clientId, original.ref, pkgCache).catch(() => null)
      if (typeof pkg?.parts?.[original.slidePath] !== 'string') return null
      const get = p => (typeof pkg.parts[p] === 'string' ? pkg.parts[p] : null)
      const ctx = themeContext(get, original.slidePath, pkg.defaultTextStyle ?? null)

      // The slide's pictures, charts, links… (its old layout and notes aren't needed)
      const rIdMap = {}
      const tags = []
      let n = 0
      for (const [id, rel] of Object.entries(readRels(get, original.slidePath))) {
        if (SKIP_RELS.test(rel.type)) continue
        const newId = `rIdO${++n}`
        if (rel.external) {
          tags.push(`<Relationship Id="${newId}" Type="${rel.type}" Target="${escapeAttr(rel.target)}" TargetMode="External"/>`)
        } else if (rel.path in pkg.parts) {
          const target = await copyPart(pkg, ctx, original.ref, rel.path)
          tags.push(`<Relationship Id="${newId}" Type="${rel.type}" Target="${relative(dirOf(slideFilename), target)}"/>`)
        } else continue
        rIdMap[id] = newId
      }

      const W = pkg.slideW ?? original.slideW, H = pkg.slideH ?? original.slideH
      const edits = original.preview?.items?.length ? effectiveEdits(original.preview, original.edits) : (original.edits ?? null)
      const previewBounds = contentBoundsOf(original.preview, edits)
      let content = resolveSlideShapes(ctx, {
        // Same placement as the previews (from the unedited content)
        placement: bounds => fitOnTemplate(W, H, previewBounds ?? bounds),
        edits, slideW: W, slideH: H,
        rIdMap,
        defaultTableStyleId: defaultTableStyleId(pkg.tableStyles),
      })

      // Table styles, with the original theme's colours, under new ids
      content = content.replace(/(<a:tableStyleId>)([^<]+)(<\/a:tableStyleId>)/g, (m, a, id, b) => {
        const newId = guidFor(`${original.ref}|${id}`)
        if (!tableStyles.has(newId)) {
          const xml = resolvedTableStyle(ctx, pkg.tableStyles, id, newId)
          if (!xml) return m
          tableStyles.set(newId, xml)
        }
        return `${a}${newId}${b}`
      })

      // Template content slide with its text boxes replaced by the original's shapes
      // The slide title set in the app goes in the template's own title box
      // (next to the logo, Spark red) — the same as slides made in the platform
      const headerTitle = original.headerTitle?.trim()
      const titleShape = headerTitle
        ? (base.xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="title"\/>[\s\S]*?<\/p:sp>/)?.[0] ?? '')
          .replace(/(<a:t[^>]*>)Slide Title(<\/a:t>)/, (_, a, b) => `${a}${escapeText(headerTitle)}${b}`)
        : ''
      let xml = base.xml.replace(/(<\/p:grpSpPr>)[\s\S]*(<\/p:spTree>)/, (_, a, b) => `${a}${titleShape}${content}${b}`)
      // Namespaces the original declared (e.g. ones named in mc:Ignorable/Requires)
      const origRoot = get(original.slidePath).match(/<p:sld\b[^>]*>/)?.[0] ?? ''
      const extra = [...origRoot.matchAll(/\sxmlns:([\w]+)="([^"]*)"/g)].filter(([, p]) => !new RegExp(`\\sxmlns:${p}=`).test(xml.match(/<p:sld\b[^>]*>/)?.[0] ?? ''))
      if (extra.length) xml = xml.replace(/<p:sld\b/, `<p:sld${extra.map(([, p, u]) => ` xmlns:${p}="${u}"`).join('')}`)

      const relsXml = (base.rels ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
        .replace('</Relationships>', `${tags.join('')}</Relationships>`)
      return { xml, relsXml }
    },

    // Registers the copied parts and table styles
    async finish() {
      if (tableStyles.size) {
        const path = 'ppt/tableStyles.xml'
        const file = zip.file(path)
        if (file) {
          const xml = await file.async('string')
          const add = [...tableStyles.values()].join('')
          zip.file(path, /<a:tblStyleLst\b[^>]*\/>/.test(xml)
            ? xml.replace(/<a:tblStyleLst\b([^>]*)\/>/, `<a:tblStyleLst$1>${add}</a:tblStyleLst>`)
            : xml.replace('</a:tblStyleLst>', `${add}</a:tblStyleLst>`))
        } else {
          zip.file(path, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">${[...tableStyles.values()].join('')}</a:tblStyleLst>`)
          types.push([path, 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml'])
          const rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
          zip.file('ppt/_rels/presentation.xml.rels', rels.replace('</Relationships>', `<Relationship Id="rIdOrigTableStyles" Type="${REL_NS}/tableStyles" Target="tableStyles.xml"/>\n</Relationships>`))
        }
      }
      if (!types.length) return
      let ct = await zip.file('[Content_Types].xml').async('string')
      ct = ct.replace('</Types>', `${types.map(([p, t]) => `<Override PartName="/${p}" ContentType="${t}"/>`).join('\n')}\n</Types>`)
      zip.file('[Content_Types].xml', ct)
    },
  }
}
