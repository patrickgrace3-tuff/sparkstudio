import JSZip from 'jszip'

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'

function getText(el) {
  return Array.from(el.getElementsByTagNameNS(NS_A, 't'))
    .map(t => t.textContent)
    .join('')
    .trim()
}

function getBullets(sp) {
  // Slide shapes use p:txBody; a:txBody only appears inside tables
  const txBody = sp.getElementsByTagNameNS(NS_P, 'txBody')[0] ?? sp.getElementsByTagNameNS(NS_A, 'txBody')[0]
  if (!txBody) return []
  const bullets = []
  for (const para of txBody.getElementsByTagNameNS(NS_A, 'p')) {
    const text = Array.from(para.getElementsByTagNameNS(NS_A, 't'))
      .map(t => t.textContent)
      .join('')
      .trim()
    if (text) bullets.push(text)
  }
  return bullets
}

// First native table on the slide → { headers, rows } (the shape export.js renders)
function getTable(doc) {
  const tbl = doc.getElementsByTagNameNS(NS_A, 'tbl')[0]
  if (!tbl) return null
  const rows = Array.from(tbl.getElementsByTagNameNS(NS_A, 'tr')).map(tr =>
    Array.from(tr.getElementsByTagNameNS(NS_A, 'tc')).map(tc => getText(tc))
  ).filter(r => r.some(c => c))
  if (rows.length < 2) return null
  const [headers, ...body] = rows
  return { headers, rows: body }
}

function parseSlideXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const shapes = doc.getElementsByTagNameNS(NS_P, 'sp')

  let title = ''
  const bodyBullets = []

  for (const sp of shapes) {
    const nvSpPr = sp.getElementsByTagNameNS(NS_P, 'nvSpPr')[0]
    const ph = nvSpPr?.getElementsByTagNameNS(NS_P, 'ph')[0]
    const phType = ph?.getAttribute('type') ?? 'body'

    if (phType === 'title' || phType === 'ctrTitle') {
      title = getText(sp)
    } else {
      // body, obj, subTitle, or unlabelled text boxes
      const bullets = getBullets(sp)
      bodyBullets.push(...bullets)
    }
  }

  // If no title placeholder found, promote first body line to title
  if (!title && bodyBullets.length > 0) {
    title = bodyBullets.shift()
  }

  return { title, bullets: bodyBullets, table: getTable(doc) }
}

export async function importSlidesFromPptx(file) {
  const zip = await JSZip.loadAsync(file)

  // Collect slide files in numeric order
  const slideEntries = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const num = s => parseInt(s.match(/(\d+)\.xml$/)[1])
      return num(a) - num(b)
    })

  const slides = []
  for (const path of slideEntries) {
    const xml = await zip.file(path).async('string')
    const { title, bullets, table } = parseSlideXml(xml)
    if (!title && bullets.length === 0 && !table) continue
    slides.push({
      title: title || 'Imported Slide',
      bullets,
      body: bullets.join('\n'),
      table,
    })
  }

  return slides
}
