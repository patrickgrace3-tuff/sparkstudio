import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_MODEL_FAST, ANTHROPIC_MODEL_DECK } from './constants.js'
import { api } from './apiClient.js'

const API_URL = 'https://api.anthropic.com/v1/messages'

export async function callClaude(userPrompt, system = '', maxTokens = 1500, { imageFiles = [], pdfFiles = [], model = ANTHROPIC_MODEL, clientId = null } = {}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY. Add it to your .env file and restart the dev server.')
  }

  // Build multimodal content: images first, then PDFs, then the text prompt
  const content = []

  for (const img of imageFiles) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
    })
    content.push({ type: 'text', text: `[Image: ${img.name}]` })
  }

  for (const pdf of pdfFiles) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf.base64 },
    })
    content.push({ type: 'text', text: `[Document: ${pdf.name}]` })
  }

  content.push({ type: 'text', text: userPrompt })

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
  }
  if (system) body.system = system

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json()

  // Fire-and-forget token logging (never blocks or throws)
  const usage = data.usage
  if (usage) {
    api.logTokens(clientId, model, usage.input_tokens ?? 0, usage.output_tokens ?? 0).catch(() => {})
  }

  return data.content?.map(b => b.text ?? '').join('') ?? ''
}

export async function enhanceSlideBody(deptName, title, rawBody, clientId = null) {
  const prompt = `
You are refining a slide for an executive company presentation.
Department: ${deptName}
Slide title: "${title}"
Raw notes: "${rawBody}"

Rewrite the notes as 3–5 crisp, presentation-ready bullet points.
Return ONLY the bullet points as plain text, one per line, each starting with "- ".
No preamble, no markdown fences.
`.trim()

  const text = await callClaude(prompt, '', 400, { clientId })
  return text.trim()
}

// Parse a pipe-table out of an AI Assistant-style SLIDE_START block
function parseTableFromBlock(block) {
  const tableMatch = block.match(/TABLE[^\n]*\n([\s\S]+)$/)
  if (!tableMatch) return null
  const rows = tableMatch[1]
    .split('\n').map(r => r.trim()).filter(r => r && r.includes('|'))
    .map(r => r.split('|').map(c => c.trim()).filter(c => c !== ''))
  if (rows.length < 2) return null
  return { headers: rows[0], rows: rows.slice(1) }
}

// Generate a single slide using the AI Assistant format (SLIDE_START/END).
// Returns { bullets, table } or null on failure.
async function preGenerateSlide({ instruction, clientName, fileSummary, pdfFiles, imageFiles, clientId }) {
  const system = `You are an AI assistant building a presentation slide for client: ${clientName}.
You have full access to the attached files and the text content below.
Do NOT say you cannot access files — the content is provided.

Slide format — use EXACTLY this, nothing else:

SLIDE_START
TITLE: Compelling title
BULLETS:
- Short narrative point (omit section entirely if table covers everything)
TABLE:
Header1 | Header2 | Header3
Row1Col1 | Row1Col2 | Row1Col3
Row2Col1 | Row2Col2 | Row2Col3
SLIDE_END

Rules:
- Include TABLE only when the instruction asks for tabular data. First TABLE row = column headers.
- Fill every [from file] value with the real number from the attached files.
- Fill every [calculate] value with the computed result.
- Omit BULLETS section if the table is self-explanatory.
- No markdown, no explanation outside the SLIDE_START/SLIDE_END block.

--- File content ---
${fileSummary || 'See attached PDFs.'}`

  try {
    const raw = await callClaude(instruction, system, 1200, { pdfFiles, imageFiles, model: ANTHROPIC_MODEL_DECK, clientId })
    const blockMatch = raw.match(/SLIDE_START([\s\S]*?)SLIDE_END/)
    if (!blockMatch) return null
    const block   = blockMatch[1]
    const titleM  = block.match(/TITLE:\s*(.+)/)
    const bulletSection = block.split(/^(?:TABLE|IMAGE)/m)[0]
    const bulletsM = [...bulletSection.matchAll(/^[-•*]\s*(.+)/gm)]
    const table   = parseTableFromBlock(block)
    return {
      title:   titleM?.[1]?.trim() ?? null,
      bullets: bulletsM.map(b => b[1].trim()),
      table,
    }
  } catch { return null }
}

export async function generateDeck(deptContributions, clientName = "", clientId = null) {
  const allowedDepts = deptContributions.map(d => d.dept)

  // Collect all image files across departments (deduplicated by name)
  const allImageFiles = []
  const seenImageNames = new Set()
  for (const contrib of deptContributions) {
    for (const img of (contrib.imageFiles ?? [])) {
      if (!seenImageNames.has(img.name)) {
        seenImageNames.add(img.name)
        allImageFiles.push(img)
      }
    }
  }

  // Collect all PDF files across departments (deduplicated by name)
  const allPdfFiles = []
  const seenPdfNames = new Set()
  for (const contrib of deptContributions) {
    for (const pdf of (contrib.pdfFiles ?? [])) {
      if (!seenPdfNames.has(pdf.name)) {
        seenPdfNames.add(pdf.name)
        allPdfFiles.push(pdf)
      }
    }
  }

  // Separate global file content (shared) from dept-specific content so global
  // files are sent once instead of repeated for every department.
  const globalSummary = deptContributions[0]?.globalSummary ?? ''

  // Pre-generate slides whose instructions mention table/tabular data using the
  // AI Assistant approach (SLIDE_START/END format). Keyed by slide._id.
  const TABLE_KEYWORDS = /\btable\b|\bcolumns?\b|\brows?\b|rating|comparison|breakdown|\bmatrix\b/i
  const preGenMap = {}
  await Promise.all(
    deptContributions.flatMap(contrib =>
      contrib.slides
        .filter(s => TABLE_KEYWORDS.test(s.body ?? ''))
        .map(async s => {
          const fileSummary = [
            globalSummary ? `Shared context:\n${globalSummary}` : '',
            (contrib.deptSummary ?? contrib.fileSummary ?? '') ? `Department files:\n${contrib.deptSummary ?? contrib.fileSummary}` : '',
          ].filter(Boolean).join('\n\n')
          const result = await preGenerateSlide({
            instruction: s.body ?? '',
            clientName,
            fileSummary,
            pdfFiles: allPdfFiles,
            imageFiles: allImageFiles,
            clientId,
          })
          if (result) preGenMap[s._id] = result
        })
    )
  )

  const slideData = deptContributions
    .map(({ dept, slides, deptSummary, fileSummary }) => {
      const slideText = slides.map(s => {
        const rawBody  = s.body ?? ''
        const wantsImg = rawBody.includes('[images]')
        const cleanBody = rawBody.replace(/\[images\]/gi, '').trim()
        const preGen = preGenMap[s._id]
        const instructions = preGen
          ? `\n  Pre-computed content — copy EXACTLY into bullets and table fields, do not change:\n  bullets: ${JSON.stringify(preGen.bullets)}\n  table: ${JSON.stringify(preGen.table)}`
          : cleanBody ? `\n  Instructions: ${cleanBody}` : ''
        const imgHint = wantsImg && allImageFiles.length ? `\n  IMAGE REQUIRED: You MUST include an "imageFile" field for this slide — pick the most relevant image from the available images list.` : ''
        return `  Id: ${s._id}\n  Title: ${s.title}${instructions}${imgHint}`
      }).join('\n')
      // Use deptSummary (dept-only) if available, otherwise fall back to fileSummary
      const summary  = deptSummary ?? fileSummary ?? ''
      const fileText = summary ? `\nDepartment files:\n${summary}` : ''
      return `Department: ${dept}\nSlides:\n${slideText}${fileText}`
    })
    .join('\n\n')

  const system = `You are an AI agent that assembles executive presentations from department slide submissions. Return structured JSON only.`.trim()

  const deptList = allowedDepts.join(', ')

  const imageList = allImageFiles.length
    ? `\nAvailable images (you may reference one per slide by exact filename):\n${allImageFiles.map(i => `- ${i.name}`).join('\n')}`
    : ''

  const globalSection = globalSummary
    ? `\nShared company context (applies to all departments):\n${globalSummary}\n`
    : ''

  const prompt = `Create a presentation for client: ${clientName}.
${globalSection}
RULES — follow exactly:
- Only create slides for these departments: ${deptList}
- The "dept" field on every slide must exactly match one of: ${deptList}
- Do NOT create any slide with dept "All", "Overview", "Introduction", "Closing", "Conclusion", or "Summary"
- Do NOT create intro slides or closing slides — those are added automatically
- Only output content slides for the listed departments
- CRITICAL: You must generate exactly one output slide for EVERY input slide listed under each department. Do NOT merge multiple input slides into one. Do NOT skip any input slide. Each input slide gets its own output slide.
- Each input slide has an "Id" — every output slide must include a "sourceId" field that exactly copies the Id of the input slide it was generated from (verbatim, unchanged).
- Each slide has "Instructions" — follow them exactly to produce the slide content. The instructions tell you what to create: bullets, a table, both, or specific data to pull from files. Treat them like a direct request, not a summary to paraphrase.
- Review ALL supporting file content (both global shared files and department-specific files) to fulfil each slide's instructions. Extract specific data, numbers, and facts — do not rely on generic statements.
- If instructions describe tabular data (a table with rows and columns, platform comparisons, rating breakdowns, etc.), output a "table" field with "headers" and "rows". Fill in any placeholder like "[from file]" with the real value from the files, and any "[calculate]" with the computed result.
- Bullets: use only for narrative context not covered by the table. NO MORE than 4 bullet points. If content overflows, add a continuation slide with " (cont'd)" appended to the title sharing the same "sourceId".${allImageFiles.length ? `\n- If an image from the available images list is relevant or would enhance a slide, include an "imageFile" field with the exact filename and an "imagePlacement" field. Choose the placement that makes the image look most natural: "bottom" stretches the image across the full content width below the bullets (best for charts, graphs, tables, timelines — use this by default for data visuals), "right" places the image on the right side with text on the left (best for product shots, logos, or portrait images). Only use one image per slide. Omit both fields if no image fits.` : ''}
${imageList}

Return ONLY valid JSON, no markdown:
{
  "title": "Presentation title including client name",
  "slides": [
    {
      "num": 1,
      "title": "Slide title",
      "dept": "Exact department name",
      "bullets": ["narrative context only — omit if table covers everything"],
      "table": { "headers": ["Col A", "Col B"], "rows": [["r1c1", "r1c2"]] },
      "sourceId": "the input slide's exact Id"${allImageFiles.length ? ',\n      "imageFile": "optional-filename.png (omit if no image)",\n      "imagePlacement": "bottom or right (omit if no image)"' : ''}
    }
  ]
}

Omit "table" if the slide has no tabular data. Omit "bullets" if the table is self-explanatory.

Department submissions:
${slideData}`.trim()

  const raw   = await callClaude(prompt, system, 4000, { imageFiles: allImageFiles, pdfFiles: allPdfFiles, model: ANTHROPIC_MODEL_DECK, clientId })
  const clean = raw.replace(/```json|```/g, '').trim()
  const deck  = JSON.parse(clean)

  console.log('[generateDeck] preGenMap keys:', Object.keys(preGenMap))
  console.log('[generateDeck] deck sourceIds:', deck.slides.map(s => s.sourceId))

  // Filter out any slides the AI sneaked in with non-dept values
  const forbidden = ['all', 'overview', 'introduction', 'intro', 'closing', 'conclusion', 'summary', 'general']
  const allowed   = allowedDepts.map(d => d.toLowerCase().trim())

  deck.slides = deck.slides.filter(s => {
    const d = (s.dept ?? '').toLowerCase().trim()
    if (forbidden.includes(d)) return false
    if (!allowed.includes(d)) return false
    return true
  })

  // Safety net: split any slide that still has more than 5 bullets into continuations
  const MAX_BULLETS = 4
  const splitSlides = []
  for (const slide of deck.slides) {
    const bullets = slide.bullets ?? []
    if (bullets.length <= MAX_BULLETS) {
      splitSlides.push(slide)
    } else {
      for (let i = 0; i < bullets.length; i += MAX_BULLETS) {
        const isFirst = i === 0
        splitSlides.push({
          ...slide,
          title: isFirst ? slide.title : `${slide.title} (cont'd)`,
          bullets: bullets.slice(i, i + MAX_BULLETS),
          // Only the first continuation carries the image
          ...(isFirst ? {} : { style: { ...(slide.style ?? {}), images: [], bodyBox: undefined } }),
        })
      }
    }
  }
  deck.slides = splitSlides

  // Attach any AI-selected images without overriding the slide's chosen layout.
  // Instead, shrink the bullet bodyBox to make room and place the image in the freed space.
  if (allImageFiles.length) {
    const imageMap = Object.fromEntries(allImageFiles.map(img => [img.name, img]))
    deck.slides.forEach(s => {
      const imgName    = s.imageFile
      const placement  = s.imagePlacement ?? 'right'
      delete s.imageFile
      delete s.imagePlacement

      if (!imgName || !imageMap[imgName]) return

      const img    = imageMap[imgName]
      const src    = `data:${img.mimeType};base64,${img.base64}`
      const GAP    = 0.015  // gap between text and image (fraction of slide width)

      // Default bodyBox matches PreviewPanel default: x=0.045, y=0.19, w=0.829, h=0.63
      const DEFAULT_BOX = { x: 0.045, y: 0.19, w: 0.829, h: 0.63 }

      let imgRect, adjustedBox

      if (placement === 'bottom') {
        // Image spans full content width below the bullets — natural for charts/graphs
        imgRect     = { x: 0.045, y: 0.50, w: 0.78, h: 0.38 }
        // Bullets take the top portion only
        adjustedBox = { ...DEFAULT_BOX, h: 0.28 }
      } else {
        // "right": image on the right ~35%, text on the left ~52%
        imgRect     = { x: 0.575, y: 0.19, w: 0.35, h: 0.60 }
        adjustedBox = { ...DEFAULT_BOX, w: imgRect.x - DEFAULT_BOX.x - GAP }
      }

      s.style = {
        ...(s.style ?? {}),
        // layout is intentionally NOT changed
        images:  [{ src, x: imgRect.x, y: imgRect.y, w: imgRect.w, h: imgRect.h }],
        bodyBox: adjustedBox,
      }
    })
  }

  // Final injection: force pre-generated table/bullets onto matching slides.
  // Runs after all post-processing so split/filter can't clobber it.
  // Matches by sourceId first, then falls back to title similarity.
  for (const [slideId, preGen] of Object.entries(preGenMap)) {
    let match = deck.slides.find(s => s.sourceId === slideId)
    if (!match && preGen.title) {
      match = deck.slides.find(s => s.title?.toLowerCase().includes(preGen.title.toLowerCase().slice(0, 20)))
    }
    if (match) {
      console.log('[generateDeck] preGen content:', JSON.stringify(preGen))
      if (preGen.table) match.table = preGen.table
      if (preGen.bullets?.length) match.bullets = preGen.bullets
      console.log('[generateDeck] Injected pre-gen into slide:', match.title, '| table:', !!match.table, '| bullets:', match.bullets?.length)
    } else {
      console.warn('[generateDeck] Could not find slide to inject preGen for slideId:', slideId)
    }
  }

  deck.slides.forEach((s, i) => { s.num = i + 1 })

  console.log('[generateDeck] FINAL slides:', deck.slides.map(s => ({ title: s.title, hasTable: !!s.table, bullets: s.bullets?.length })))

  return deck
}