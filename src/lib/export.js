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
      const text = escapeXml(b.replace(/^[-\u2013\u2022\*]\s*/, '').trim())
      return `<a:p>
        <a:pPr indent="0" lvl="0" marL="342900" marR="0" rtl="0" algn="l">
          <a:spcBef><a:spcPts val="100"/></a:spcBef>
          <a:spcAft><a:spcPts val="100"/></a:spcAft>
          <a:buClr><a:srgbClr val="${accent}"/></a:buClr>
          <a:buSzPct val="100000"/>
          <a:buChar char="&#x2022;"/>
        </a:pPr>
        <a:r>
          <a:rPr lang="en-US" sz="1800" dirty="0">
            <a:solidFill><a:srgbClr val="1A1A1A"/></a:solidFill>
            <a:latin typeface="Arial"/>
            <a:ea typeface="Arial"/>
            <a:cs typeface="Arial"/>
            <a:sym typeface="Arial"/>
          </a:rPr>
          <a:t>${text}</a:t>
        </a:r>
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
  const { title, bullets = [] } = slide
  const style       = slide.style || {}
  const accentColor = style.accent ?? null
  const layout      = style.layout ?? 'title-top'

  // 1. Replace the slide title placeholder (red text at top)
  let out = replaceMarkerText(xml, 'Slide Title', title)

  // Apply custom accent color — replaces the default Spark red (CD2F37)
  if (accentColor) {
    const hex = accentColor.replace('#', '').toUpperCase()
    out = out.replace(/CD2F37/gi, hex)
  }

  // 2. Replace the body text box that contains "Slide Body"
  const accentHex = (accentColor ?? 'CD2F37').replace('#', '').toUpperCase()
  const bulletXml = buildBulletParagraphs(bullets.length ? bullets : ['No content provided.'], accentHex)

  // Find the shape containing "Slide Body" and replace its entire txBody
  out = out.replace(
    /(<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<a:t>Slide Body<\/a:t>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>)/,
    (match) => {
      // Replace only the txBody portion, preserving nvSpPr and spPr
      return match.replace(
        /<p:txBody>[\s\S]*?<\/p:txBody>/,
        `<p:txBody>
          <a:bodyPr anchorCtr="0" anchor="t" bIns="45700" lIns="91425" spcFirstLastPara="1" rIns="91425" wrap="square" tIns="45700">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
${bulletXml}
        </p:txBody>`
      )
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

// ── Main ───────────────────────────────────────────────────────────────────────

export async function exportToPptx(deck) {
  const buffer = await fetchTemplate()
  const zip = await JSZip.loadAsync(buffer)

  // Read template slide XMLs
  const slide2Xml = await zip.file('ppt/slides/slide2.xml').async('string')
  const slide3Xml = await zip.file('ppt/slides/slide3.xml').async('string')

  // Read rels for slides 2 & 3 (needed so backgrounds/images resolve)
  const getRels = async (n) => {
    const f = zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)
    return f ? f.async('string') : null
  }
  const slide2Rels = await getRels(2)
  const slide3Rels = await getRels(3)

  // Group slides by department — one section divider per dept
  const groups = []
  let _currentDept = null
  for (const slide of deck.slides) {
    if (!_currentDept || _currentDept.dept !== slide.dept) {
      _currentDept = { dept: slide.dept, slides: [] }
      groups.push(_currentDept)
    }
    _currentDept.slides.push(slide)
  }

  // Build slide list: cover stays as slide1
  // Then for each dept group: 1 section + N content slides
  const newSlides = []
  let idx = 4

  for (const group of groups) {
    // Section divider — one per dept
    newSlides.push({
      filename: `ppt/slides/slide${idx}.xml`,
      relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
      xml: rewriteShapeIds(patchSectionSlide(slide2Xml, group.dept)),
      relsXml: slide2Rels,
    })
    idx++

    // All content slides for this dept
    for (const slide of group.slides) {
      const { xml: patchedXml, relsXml: patchedRels } = patchContentSlide(zip, slide3Xml, slide3Rels, slide, slide.table ?? null)
      newSlides.push({
        filename: `ppt/slides/slide${idx}.xml`,
        relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
        xml: rewriteShapeIds(patchedXml),
        relsXml: patchedRels,
      })
      idx++
    }
  }

  // Always add closing "Thank you" slide using the dark section template
  newSlides.push({
    filename: `ppt/slides/slide${idx}.xml`,
    relsFilename: `ppt/slides/_rels/slide${idx}.xml.rels`,
    xml: rewriteShapeIds(patchClosingSlide(slide2Xml)),
    relsXml: slide2Rels,
  })
  idx++

  // ── Remove template slides 2 & 3 from zip (only slide 1 cover is kept) ────
  zip.remove('ppt/slides/slide2.xml')
  zip.remove('ppt/slides/slide3.xml')
  zip.remove('ppt/slides/_rels/slide2.xml.rels')
  zip.remove('ppt/slides/_rels/slide3.xml.rels')

  // Add new slide files to zip
  for (const s of newSlides) {
    zip.file(s.filename, s.xml)
    if (s.relsXml) zip.file(s.relsFilename, s.relsXml)
  }

  // ── Update [Content_Types].xml ───────────────────────────────────────────────
  let ctXml = await zip.file('[Content_Types].xml').async('string')
  // Remove template slide 2 & 3 overrides
  ctXml = ctXml
    .replace(/<Override[^/]*PartName="\/ppt\/slides\/slide2\.xml"[^/]*\/>/g, '')
    .replace(/<Override[^/]*PartName="\/ppt\/slides\/slide3\.xml"[^/]*\/>/g, '')
  // Add new slide overrides
  const ctOverrides = newSlides
    .map(s => `<Override PartName="/${s.filename}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join('\n')
  zip.file('[Content_Types].xml', ctXml.replace('</Types>', `${ctOverrides}\n</Types>`))

  // ── Update presentation.xml — replace sldIdLst entirely ─────────────────────
  let presXml = await zip.file('ppt/presentation.xml').async('string')
  const existingNums = [...presXml.matchAll(/id="(\d+)"/g)].map(m => +m[1])
  let maxSldId = Math.max(300, ...existingNums)

  // Build entries: slide1 (cover) keeps its original rId7, new slides get fresh IDs
  const sldIdEntries = newSlides.map((_, i) => ({
    id: ++maxSldId,
    rId: `rIdGen${i + 1}`,
  }))

  // Replace the entire sldIdLst — slide1 (rId7) first, then new slides
  const sldIdXml = [
    '<p:sldId id="256" r:id="rId7"/>',
    ...sldIdEntries.map(e => `<p:sldId id="${e.id}" r:id="${e.rId}"/>`)
  ].join('\n    ')

  presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>\n    ${sldIdXml}\n  </p:sldIdLst>`)
  zip.file('ppt/presentation.xml', presXml)

  // ── Update presentation.xml.rels ─────────────────────────────────────────────
  let presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
  // Remove slide2 and slide3 relationships
  presRels = presRels
    .replace(/<Relationship[^/]*Target="slides\/slide2\.xml"[^/]*\/>/g, '')
    .replace(/<Relationship[^/]*Target="slides\/slide3\.xml"[^/]*\/>/g, '')
  // Add new slide relationships
  const newRelsXml = newSlides
    .map((s, i) => `<Relationship Id="${sldIdEntries[i].rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${s.filename.replace('ppt/', '')}"/>`)
    .join('\n')
  zip.file('ppt/_rels/presentation.xml.rels', presRels.replace('</Relationships>', `${newRelsXml}\n</Relationships>`))

  // Generate blob and trigger download
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = (deck.title || 'presentation')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pptx'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}