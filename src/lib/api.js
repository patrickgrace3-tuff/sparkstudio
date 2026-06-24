import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from './constants.js'

const API_URL = 'https://api.anthropic.com/v1/messages'

export async function callClaude(userPrompt, system = '', maxTokens = 1500) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY. Add it to your .env file and restart the dev server.')
  }

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userPrompt }],
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
  return data.content?.map(b => b.text ?? '').join('') ?? ''
}

export async function enhanceSlideBody(deptName, title, rawBody) {
  const prompt = `
You are refining a slide for an executive company presentation.
Department: ${deptName}
Slide title: "${title}"
Raw notes: "${rawBody}"

Rewrite the notes as 3–5 crisp, presentation-ready bullet points.
Return ONLY the bullet points as plain text, one per line, each starting with "- ".
No preamble, no markdown fences.
`.trim()

  const text = await callClaude(prompt, '', 400)
  return text.trim()
}

export async function generateDeck(deptContributions, clientName = "") {
  const allowedDepts = deptContributions.map(d => d.dept)

  const slideData = deptContributions
    .map(({ dept, slides, fileSummary }) => {
      const slideText = slides.map(s => `  Title: ${s.title}\n  Content: ${s.body}`).join('\n')
      const fileText  = fileSummary ? `\nSupporting files:\n${fileSummary}` : ''
      return `Department: ${dept}\nSlides:\n${slideText}${fileText}`
    })
    .join('\n\n')

  const system = `You are an AI agent that assembles executive presentations from department slide submissions. Return structured JSON only.`.trim()

  const deptList = allowedDepts.join(', ')

  const prompt = `Create a presentation for client: ${clientName}.

RULES — follow exactly:
- Only create slides for these departments: ${deptList}
- The "dept" field on every slide must exactly match one of: ${deptList}
- Do NOT create any slide with dept "All", "Overview", "Introduction", "Closing", "Conclusion", or "Summary"
- Do NOT create intro slides or closing slides — those are added automatically
- Only output content slides for the listed departments

Return ONLY valid JSON, no markdown:
{
  "title": "Presentation title including client name",
  "slides": [
    { "num": 1, "title": "Slide title", "dept": "Exact department name", "bullets": ["bullet 1", "bullet 2"] }
  ]
}

Department submissions:
${slideData}`.trim()

  const raw   = await callClaude(prompt, system, 2000)
  const clean = raw.replace(/```json|```/g, '').trim()
  const deck  = JSON.parse(clean)

  // Filter out any slides the AI sneaked in with non-dept values
  const forbidden = ['all', 'overview', 'introduction', 'intro', 'closing', 'conclusion', 'summary', 'general']
  const allowed   = allowedDepts.map(d => d.toLowerCase().trim())

  deck.slides = deck.slides.filter(s => {
    const d = (s.dept ?? '').toLowerCase().trim()
    if (forbidden.includes(d)) return false
    if (!allowed.includes(d)) return false
    return true
  })

  deck.slides.forEach((s, i) => { s.num = i + 1 })

  return deck
}