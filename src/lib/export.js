/**
 * export.js
 *
 * Builds a .pptx by cloning slides from the Spark Studio template:
 *   Slide 1 → cover (kept as-is, untouched)
 *   Slide 2 → section/department divider  (centered "Section Title" text box)
 *   Slide 3 → content slide               (Slide Title + Slide Body text boxes)
 *
 * Strategy: fetch the template, unzip it in-memory with JSZip, clone the
 * relevant slide XML for each generated slide, patch the text nodes, then
 * repack and trigger a download.
 */

import JSZip from 'jszip'
import { parseRichText } from './richtext.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchTemplate() {
  const res = await fetch('/template.pptx')
  if (!res.ok) throw new Error(`Failed to load template: ${res.status}`)
  return res.arrayBuffer()
}

function escapeXml(str) {
  return String(str)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceMarkerText(xml, marker, replacement) {
  const escaped = escapeXml(replacement)
  return xml.replace(
    new RegExp(`(<a:t[^>]*>)${escapeRegex(marker)}(</a:t>)`),
    `$1${escaped}$2`
  )
}

function buildBulletParagraphs(bullets, accentHex) {
  // Use accent color for bullets, dark gray for text — matches white slide background
  const accent = accentHex || 'CD2F37'
  return bullets
    .map(b => {
      const cleaned = b.replace(/^[-\u2013\u2022]\s*/, '').trim()
      const runs = parseRichText(cleaned)
        .map(seg => {
          const boldAttr   = seg.bold   ? ' b="1"' : ''
          const italicAttr = seg.italic ? ' i="1"' : ''
          return `<a:r>
          <a:rPr lang="en-US" sz="1800"${boldAttr}${italicAttr} dirty="0">
            <a:solidFill><a:srgbClr val="1A1A1A"/></a:solidFill>
            <a:latin typeface="Arial"/>
            <a:ea typeface="Arial"/>
            <a:cs typeface="Arial"/>
            <a:sym typeface="Arial"/>
          </a:rPr>
          <a:t>${escapeXml(seg.text)}</a:t>
        </a:r>`
        })
        .join('\n')
      return `<a:p>
        <a:pPr indent="0" lvl="0" marL="342900" marR="0" rtl="0" algn="l">
          <a:spcBef><a:spcPts val="100"/></a:spcBef>
          <a:spcAft><a:spcPts val="100"/></a:spcAft>
          <a:buClr><a:srgbClr val="${accent}"/></a:buClr>
          <a:buSzPct val="100000"/>
          <a:buChar char="&#x2022;"/>
        </a:pPr>
${runs}
      </a:p>`
    })
    .join('\n')
}

/**
 * Build a PowerPoint native table shape XML.
 * Positioned below the bullet content area.
 */
function buildTableShapeXml(table, accentHex) {
  const accent   = accentHex || 'CD2F37'
  const headers  = table.headers || []
  const rows     = table.rows    || []
  const colCount = headers.length
  const colWidth = Math.floor(9144000 / Math.max(colCount, 1)) // spread across ~9.1"

  const cellXml = (text, isHeader) => {
    const fill   = isHeader ? `<a:solidFill><a:srgbClr val="${accent}"/></a:solidFill>` : '<a:noFill/>'
    const color  = isHeader ? 'FFFFFF' : '1A1A1A'
    const bold   = isHeader ? '1' : '0'
    return `<a:tc>
              <a:txBody>
                <a:bodyPr/>
                <a:lstStyle/>
                <a:p>
                  <a:r>
                    <a:rPr lang="en-US" sz="1200" b="${bold}" dirty="0">
                      <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
                      <a:latin typeface="Arial"/>
                    </a:rPr>
                    <a:t>${escapeXml(String(text))}</a:t>
                  </a:r>
                </a:p>
              </a:txBody>
              <a:tcPr>
                ${fill}
                <a:lnL w="12700"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnL>
                <a:lnR w="12700"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnR>
                <a:lnT w="12700"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnT>
                <a:lnB w="12700"><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:lnB>
              </a:tcPr>
            </a:tc>`
  }

  const headerRow = `<a:tr h="381000">
            ${headers.map(h => cellXml(h, true)).join('')}
          </a:tr>`

  const dataRows = rows.map(row =>
    `<a:tr h="304800">
            ${headers.map((_, ci) => cellXml(row[ci] ?? '', false)).join('')}
          </a:tr>`
  ).join('')

  const gridCols = headers.map(() => `<a:gridCol w="${colWidth}"/>`).join('')
  const tableH   = 381000 + rows.length * 304800

  return `<p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${_nextShapeId++}" name="DataTable"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="551425" y="4200000"/><a:ext cx="10104300" cy="${tableH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="${_nextShapeId++}" name="DataTable_Frame"/>
          <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm><a:off x="551425" y="4200000"/><a:ext cx="10104300" cy="${tableH}"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1">
                <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
              </a:tblPr>
              <a:tblGrid>${gridCols}</a:tblGrid>
              ${headerRow}
              ${dataRows}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>`
}

function patchSectionSlide(xml, sectionTitle) {
  return replaceMarkerText(xml, 'Section Title', sectionTitle)
}

// The template's "Source:" text box has a second, empty paragraph right
// below the "Source:" label reserved for the actual citation text — find
// the first empty <a:r><a:t></a:t></a:r> run that follows the "Source:"
// label (scoped narrowly so we don't touch unrelated empty runs elsewhere
// in the slide, e.g. bullet placeholders) and fill it in.
function patchSourceText(xml, sourceText) {
  if (!sourceText) return xml
  return xml.replace(
    /(<a:t>Source:<\/a:t>[\s\S]*?<a:r>)<a:t><\/a:t>(<\/a:r>)/,
    `$1<a:t>${escapeXml(sourceText)}</a:t>$2`
  )
}

// ── Image embedding ─────────────────────────────────────────────────────────────

let _nextMediaId = 1

function dataUrlToBytes(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return null
  const [, mimeType, base64] = match
  const ext = mimeType === 'image/png' ? 'png'
    : mimeType === 'image/gif' ? 'gif'
    : 'jpg' // default — covers image/jpeg and anything else we can't identify
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { bytes, ext }
}

/**
 * Registers an image (data URL) as media in the zip and adds a relationship
 * to the given (already-cloned, slide-specific) rels XML.
 * Returns { relsXml, rId } or null if the image couldn't be decoded.
 */
function embedImage(zip, relsXml, dataUrl) {
  const decoded = dataUrlToBytes(dataUrl)
  if (!decoded) return null
  const { bytes, ext } = decoded
  const mediaName = `image${_nextMediaId++}.${ext}`
  zip.file(`ppt/media/${mediaName}`, bytes)

  const rId = `rIdImg${_nextMediaId}`
  const relationship = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
  const newRelsXml = relsXml.replace('</Relationships>', `${relationship}</Relationships>`)

  return { relsXml: newRelsXml, rId }
}

/**
 * Builds a <p:pic> shape XML covering the given EMU bounding box.
 */
function buildPictureXml(rId, x, y, cx, cy, name = 'SlideImage') {
  return `<p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${_nextShapeId++}" name="${name}"/>
          <p:cNvPicPr><a:picLocks noGrp="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`
}

const SLIDE_W = 12192000
const SLIDE_H = 6858000

/**
 * Patches the content slide template with title/bullets/table, and — if the
 * slide's style includes a background or content image — embeds it as media
 * and injects a <p:pic> shape. Returns the patched { xml, relsXml } pair
 * since image embedding needs to add a relationship.
 */
function patchContentSlide(zip, xml, relsXml, slide, table = null) {
  const { title, bullets = [], source } = slide
  const style       = slide.style || {}
  const accentColor = style.accent ?? null
  const layout      = style.layout ?? 'title-top'

  // 1. Replace the slide title placeholder (red text at top)
  let out = replaceMarkerText(xml, 'Slide Title', title)
  out = patchSourceText(out, source)

  // Apply custom accent color — replaces the default Spark red (CD2F37)
  if (accentColor) {
    const hex = accentColor.replace('#', '').toUpperCase()
    out = out.replace(/CD2F37/gi, hex)
  }

  // 2. Replace the body text box that contains "Slide Body"
  const accentHex = (accentColor ?? 'CD2F37').replace('#', '').toUpperCase()
  const bulletXml = buildBulletParagraphs(bullets.length ? bullets : ['No content provided.'], accentHex)

  // PowerPoint-style repositioning of the bullet content box (defaults match
  // the template's original placeholder position, so untouched slides are unaffected)
  const bodyBox = style.bodyBox || { x: 0.045, y: 0.19, w: 0.829, h: 0.63 }
  const bodyX  = Math.round(bodyBox.x * SLIDE_W)
  const bodyY  = Math.round(bodyBox.y * SLIDE_H)
  const bodyCx = Math.round(bodyBox.w * SLIDE_W)
  const bodyCy = Math.round(bodyBox.h * SLIDE_H)

  // Find the shape containing "Slide Body" and replace its entire txBody + position
  out = out.replace(
    /(<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<a:t>Slide Body<\/a:t>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>)/,
    (match) => {
      // Replace only the txBody portion, preserving nvSpPr and spPr
      let patched = match.replace(
        /<p:txBody>[\s\S]*?<\/p:txBody>/,
        `<p:txBody>
          <a:bodyPr anchorCtr="0" anchor="t" bIns="45700" lIns="91425" spcFirstLastPara="1" rIns="91425" wrap="square" tIns="45700">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
${bulletXml}
        </p:txBody>`
      )
      // Override (or insert) the shape's position/size to reflect a custom bodyBox
      const xfrm = `<a:xfrm><a:off x="${bodyX}" y="${bodyY}"/><a:ext cx="${bodyCx}" cy="${bodyCy}"/></a:xfrm>`
      if (/<a:xfrm>[\s\S]*?<\/a:xfrm>/.test(patched)) {
        patched = patched.replace(/<a:xfrm>[\s\S]*?<\/a:xfrm>/, xfrm)
      } else {
        patched = patched.replace(/<p:spPr>/, `<p:spPr>${xfrm}`)
      }
      return patched
    }
  )

  // 3. Inject table shape before </p:spTree> if table data provided
  if (table && table.headers?.length > 0 && table.rows?.length > 0) {
    const tableXml = buildTableShapeXml(table, accentHex)
    out = out.replace('</p:spTree>', `${tableXml}\n</p:spTree>`)
  }

  let outRels = relsXml

  // 4. Background image (any layout) — full-bleed picture placed first in
  // z-order (right after <p:spTree>) so text/tables render on top of it.
  if (style.bgImage) {
    const embedded = embedImage(zip, outRels, style.bgImage)
    if (embedded) {
      outRels = embedded.relsXml
      const picXml = buildPictureXml(embedded.rId, 0, 0, SLIDE_W, SLIDE_H, 'SlideBackgroundImage')
      out = out.replace('<p:spTree>', `<p:spTree>${picXml}`)
    }
  }

  // 5. Content image (image-right layout) — placed in the right-hand column.
  if (layout === 'image-right' && style.contentImage) {
    const embedded = embedImage(zip, outRels, style.contentImage)
    if (embedded) {
      outRels = embedded.relsXml
      const colW   = Math.round(SLIDE_W * 0.38)
      const colX   = SLIDE_W - colW
      const picXml = buildPictureXml(embedded.rId, colX, 0, colW, SLIDE_H, 'SlideContentImage')
      out = out.replace('</p:spTree>', `${picXml}\n</p:spTree>`)
    }
  }

  // 6. Freely positioned/resized images (PowerPoint-style overlay) — placed
  // last so they sit on top of background/content images and text.
  if (Array.isArray(style.images)) {
    for (const img of style.images) {
      if (!img?.src) continue
      const embedded = embedImage(zip, outRels, img.src)
      if (embedded) {
        outRels = embedded.relsXml
        const x  = Math.round((img.x ?? 0.3) * SLIDE_W)
        const y  = Math.round((img.y ?? 0.3) * SLIDE_H)
        const cx = Math.round((img.w ?? 0.3) * SLIDE_W)
        const cy = Math.round((img.h ?? 0.3) * SLIDE_H)
        const picXml = buildPictureXml(embedded.rId, x, y, cx, cy, 'SlideFreeImage')
        out = out.replace('</p:spTree>', `${picXml}\n</p:spTree>`)
      }
    }
  }

  return { xml: out, relsXml: outRels }
}

// ── ID management ─────────────────────────────────────────────────────────────

let _nextShapeId = 500

function rewriteShapeIds(xml) {
  return xml.replace(/\bid="(\d+)"/g, () => `id="${_nextShapeId++}"`)
}

/**
 * Patch slide 2 (dark section slide) to serve as the closing "Thank you" slide.
 */
function patchClosingSlide(xml) {
  return replaceMarkerText(xml, 'Section Title', 'Thank You for Joining Us')
}

// ── React component → PNG data URL ───────────────────────────────────────────
// Uses html2canvas to capture a rendered React component as a PNG.
// html2canvas reads computed styles (resolving CSS variables and cqw units)
// directly from the live DOM, which is far more reliable than SVG foreignObject.

async function renderComponentToDataUrl(reactElement, width = 1280, height = 720) {
  const { createRoot } = await import('react-dom/client')
  const html2canvas    = (await import('html2canvas')).default

  // Render off-screen (not invisible) so container queries resolve and
  // html2canvas captures full-opacity pixels — opacity tricks make the PNG transparent.
  const container = document.createElement('div')
  container.style.cssText = [
    `position:fixed`,
    `left:-${width + 100}px`,
    `top:0`,
    `width:${width}px`,
    `height:${height}px`,
    `overflow:hidden`,
    `background:#fff`,
    `pointer-events:none`,
    `z-index:99999`,
  ].join(';')
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(reactElement)

  // Wait for React to paint + container queries to settle
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise(r => setTimeout(r, 300))

  let dataUrl
  try {
    const canvas = await html2canvas(container, {
      width,
      height,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    })
    dataUrl = canvas.toDataURL('image/png')
  } catch {
    const c = document.createElement('canvas')
    c.width = width; c.height = height
    c.getContext('2d').fillRect(0, 0, width, height)
    dataUrl = c.toDataURL('image/png')
  }

  root.unmount()
  document.body.removeChild(container)
  return dataUrl
}

// Build a minimal blank slide XML with a single full-bleed image.
function buildImageSlideXml(rId) {
  const id1 = _nextShapeId++
  const id2 = _nextShapeId++
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="${id1}" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${id2}" name="SlideImage"/>
          <p:cNvPicPr><a:picLocks noGrp="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`
}

// Build rels XML for a blank image slide.
// layoutRelXml: the <Relationship .../> string for the slideLayout copied from the template.
function buildImageSlideRels(layoutRelXml, imgRId, mediaName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${layoutRelXml}
  <Relationship Id="${imgRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>
</Relationships>`
}

// Embed a PNG data URL as a media file and return the rels + rId for the image.
function embedPng(zip, dataUrl) {
  const base64  = dataUrl.split(',')[1]
  const binary  = atob(base64)
  const bytes   = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const name    = `image${_nextMediaId++}.png`
  zip.file(`ppt/media/${name}`, bytes)
  return name
}

// ── Notes slides ──────────────────────────────────────────────────────────────

// Template has notesSlide1/2/3; slide1 is kept so notesSlide1 is preserved.
// We remove slide2/3 and their notesSlides, so start our new ones at 4.
let _nextNotesId = 4

// Build a minimal notes slide XML containing the given plain text.
function buildNotesSlideXml(notesText, slideRId) {
  const id1 = _nextShapeId++
  const id2 = _nextShapeId++
  const id3 = _nextShapeId++
  // Split text into paragraphs on newlines for better readability in PPT
  const paragraphs = String(notesText || '').split('\n').map(line => {
    const escaped = escapeXml(line || '')
    return `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escaped}</a:t></a:r></a:p>`
  }).join('\n      ')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
         xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
         xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="${id1}" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id2}" name="Slide Image 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="sldImg"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id3}" name="Notes Placeholder 2"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
      ${paragraphs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClr/></p:clrMapOvr>
</p:notes>`
}

// Build the rels file for a notes slide — only references the notesMaster.
// The slide-to-notesSlide link lives in the slide's own rels, not here.
function buildNotesSlideRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
</Relationships>`
}

// ── Main ───────────────────────────────────────────────────────────────────────

// orderedSlides: the slide descriptor array from PreviewPanel (may be reordered
// by the user). Each item: { kind, label, slide?, dept?, funnelConfig?, teamConfig? }
export async function exportToPptx(orderedSlides, deck) {
  const { createElement } = await import('react')
  const { FunnelSlidePreview } = await import('../components/FunnelBuilder.jsx')
  const { TeamSlidePreview }   = await import('../components/TeamBuilder.jsx')

  const buffer = await fetchTemplate()
  const zip    = await JSZip.loadAsync(buffer)

  const slide2Xml = await zip.file('ppt/slides/slide2.xml').async('string')
  const slide3Xml = await zip.file('ppt/slides/slide3.xml').async('string')
  const getRels   = async (n) => {
    const f = zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)
    return f ? f.async('string') : null
  }
  // Strip template notesSlide refs — those point to notesSlide2/3 which we remove.
  // New notesSlide relationships are added per-slide only when notes text exists.
  const stripNotesRel = (rels) => rels
    ? rels.replace(/<Relationship[^>]*\/officeDocument\/2006\/relationships\/notesSlide[^>]*\/>/g, '')
    : rels
  const slide2Rels = stripNotesRel(await getRels(2))
  const slide3Rels = stripNotesRel(await getRels(3))

  const newSlides = []
  const notesFiles = []   // tracks notesSlide filenames for Content_Types registration
  let idx = 4

  for (const item of orderedSlides) {
    if (item.kind === 'cover') continue   // slide1 is kept as-is from template

    if (item.kind === 'section') {
      newSlides.push({
        filename:     `ppt/slides/slide${idx}.xml`,
        relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
        xml:          rewriteShapeIds(patchSectionSlide(slide2Xml, item.dept)),
        relsXml:      slide2Rels,
      })
      idx++

    } else if (item.kind === 'content') {
      const notes = item.slide?.notes?.trim() || ''
      const slideFilename = `ppt/slides/slide${idx}.xml`

      let { xml: patchedXml, relsXml: patchedRels } = patchContentSlide(zip, slide3Xml, slide3Rels, item.slide, item.slide.table ?? null)

      // If this slide has notes, create a notesSlide and link it from the slide rels
      if (notes) {
        const notesN = _nextNotesId++
        const notesFilename = `ppt/notesSlides/notesSlide${notesN}.xml`
        const notesRelsFilename = `ppt/notesSlides/_rels/notesSlide${notesN}.xml.rels`
        const notesRId = `rIdNotes${notesN}`

        // Link the notes slide from the slide's rels
        patchedRels = patchedRels
          ? patchedRels.replace('</Relationships>', `<Relationship Id="${notesRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${notesN}.xml"/>\n</Relationships>`)
          : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n<Relationship Id="${notesRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${notesN}.xml"/>\n</Relationships>`

        zip.file(notesFilename, buildNotesSlideXml(notes))
        zip.file(notesRelsFilename, buildNotesSlideRels())
        notesFiles.push(notesFilename)
      }

      newSlides.push({
        filename:     slideFilename,
        relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
        xml:          rewriteShapeIds(patchedXml),
        relsXml:      patchedRels,
      })
      idx++

    } else if (item.kind === 'closing') {
      newSlides.push({
        filename:     `ppt/slides/slide${idx}.xml`,
        relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
        xml:          rewriteShapeIds(patchClosingSlide(slide2Xml)),
        relsXml:      slide2Rels,
      })
      idx++

    } else if (item.kind === 'funnel' || item.kind === 'team') {
      // Render the visual component to a PNG and embed as a full-bleed image slide
      const element = item.kind === 'funnel'
        ? createElement(FunnelSlidePreview, { config: item.funnelConfig })
        : createElement(TeamSlidePreview,   { config: item.teamConfig })

      const dataUrl   = await renderComponentToDataUrl(element, 1280, 720)
      const imgRId    = `rIdImg${_nextMediaId}`
      const mediaName = embedPng(zip, dataUrl)

      // Reuse the slideLayout relationship from the template's slide2 rels verbatim
      const layoutRelXml = slide2Rels
        ? (slide2Rels.match(/<Relationship[^>]*slideLayout[^>]*\/>/) || [])[0] || ''
        : ''

      newSlides.push({
        filename:     `ppt/slides/slide${idx}.xml`,
        relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
        xml:          buildImageSlideXml(imgRId),
        relsXml:      buildImageSlideRels(layoutRelXml, imgRId, mediaName),
      })
      idx++
    }
  }

  // ── Remove template slides 2 & 3 (and their notesSlides) from zip ──────────
  zip.remove('ppt/slides/slide2.xml')
  zip.remove('ppt/slides/slide3.xml')
  zip.remove('ppt/slides/_rels/slide2.xml.rels')
  zip.remove('ppt/slides/_rels/slide3.xml.rels')
  zip.remove('ppt/notesSlides/notesSlide2.xml')
  zip.remove('ppt/notesSlides/notesSlide3.xml')
  zip.remove('ppt/notesSlides/_rels/notesSlide2.xml.rels')
  zip.remove('ppt/notesSlides/_rels/notesSlide3.xml.rels')

  for (const s of newSlides) {
    zip.file(s.filename, s.xml)
    if (s.relsXml) zip.file(s.relsFilename, s.relsXml)
  }

  // ── Update [Content_Types].xml ───────────────────────────────────────────────
  let ctXml = await zip.file('[Content_Types].xml').async('string')
  ctXml = ctXml
    .replace(/<Override[^>]*PartName="\/ppt\/slides\/slide2\.xml"[^>]*\/>/g, '')
    .replace(/<Override[^>]*PartName="\/ppt\/slides\/slide3\.xml"[^>]*\/>/g, '')
    .replace(/<Override[^>]*PartName="\/ppt\/notesSlides\/notesSlide2\.xml"[^>]*\/>/g, '')
    .replace(/<Override[^>]*PartName="\/ppt\/notesSlides\/notesSlide3\.xml"[^>]*\/>/g, '')
  const ctOverrides = [
    ...newSlides.map(s => `<Override PartName="/${s.filename}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`),
    ...notesFiles.map(f => `<Override PartName="/${f}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`),
  ].join('\n')
  // Ensure PNG type is registered
  if (!ctXml.includes('image/png')) {
    ctXml = ctXml.replace('</Types>', `<Default Extension="png" ContentType="image/png"/>\n</Types>`)
  }
  zip.file('[Content_Types].xml', ctXml.replace('</Types>', `${ctOverrides}\n</Types>`))

  // ── Update presentation.xml ──────────────────────────────────────────────────
  let presXml = await zip.file('ppt/presentation.xml').async('string')
  const existingSldIdListMatch = presXml.match(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/)
  const existingNums = existingSldIdListMatch
    ? [...existingSldIdListMatch[0].matchAll(/<p:sldId id="(\d+)"/g)].map(m => +m[1])
    : []
  let maxSldId = Math.max(300, ...existingNums)

  const sldIdEntries = newSlides.map((_, i) => ({ id: ++maxSldId, rId: `rIdGen${i + 1}` }))
  const sldIdXml = [
    '<p:sldId id="256" r:id="rId7"/>',
    ...sldIdEntries.map(e => `<p:sldId id="${e.id}" r:id="${e.rId}"/>`),
  ].join('\n    ')

  presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>\n    ${sldIdXml}\n  </p:sldIdLst>`)
  zip.file('ppt/presentation.xml', presXml)

  // ── Update presentation.xml.rels ─────────────────────────────────────────────
  let presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
  presRels = presRels
    .replace(/<Relationship[^/]*Target="slides\/slide2\.xml"[^/]*\/>/g, '')
    .replace(/<Relationship[^/]*Target="slides\/slide3\.xml"[^/]*\/>/g, '')
  const newRelsEntries = newSlides
    .map((s, i) => `<Relationship Id="${sldIdEntries[i].rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${s.filename.replace('ppt/', '')}"/>`)
    .join('\n')
  zip.file('ppt/_rels/presentation.xml.rels', presRels.replace('</Relationships>', `${newRelsEntries}\n</Relationships>`))

  // ── Generate and download ────────────────────────────────────────────────────
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = (deck.title || 'presentation')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pptx'

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}