import { DEPARTMENTS } from './constants.js'

const KEY = 'sparkstudio_templates'

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTemplates(templates) {
  localStorage.setItem(KEY, JSON.stringify(templates))
}

export function createTemplate(name, description = '') {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name,
    description,
    createdAt: Date.now(),
    departments: {},
  }
}

// A template slide shell: title + content guidance + guardrails (AI fills bullets)
// Whether a template slide is made once per division for clients whose
// department uses divisions (the default), or just once (perDivision: false)
export const perDivision = shell => shell?.perDivision !== false

// The slides a department's template shells become: [{ shell, div, order }].
// divisions: the client's divisions when the department uses them, else [].
// Slides set to "one per division" are made for every division; the others
// once (div null). Order: consecutive per-division slides are made division
// by division (A: 1, 2 · B: 1, 2); single slides keep their place.
export function templateSlidePlan(shells, divisions = []) {
  const out = []
  let run = 0, prevPer = null
  shells.forEach((shell, si) => {
    const per = divisions.length > 0 && perDivision(shell)
    if (!(per && prevPer)) run++
    prevPer = per
    ;(per ? divisions : [null]).forEach((div, di) => out.push({ shell, div, order: [run, di, si] }))
  })
  return out
}

export const byPlanOrder = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]

export function createSlideShell(title = '', content = '') {
  return { title, content, doThis: '', dontDoThis: '' }
}

// A builder slide for the AI to fill from a template shell
export function seedFromShell(shell, deptName) {
  const parts = []
  if (shell.content) parts.push(shell.content)
  if (shell.doThis?.trim())     parts.push(`Do this: ${shell.doThis.trim()}`)
  if (shell.dontDoThis?.trim()) parts.push(`Do NOT do this: ${shell.dontDoThis.trim()}`)
  return {
    title:  shell.title || `${deptName} Overview`,
    body:   parts.join('\n'),
    bullets: [],
    style:  { layout: 'title-top' },
    dept:   deptName,
    _fromTemplate: true,
  }
}

// Build seed slides from a template for a given dept name
// Returns an array of slide objects ready to inject into the deck.
// Imported slides kept with their design (kind: 'original') are handled
// separately — see templateOriginals.js.
export function buildSeedSlides(template, deptName) {
  const shells = (template.departments[deptName] || []).filter(sh => sh.kind !== 'original')
  return shells.map(shell => seedFromShell(shell, deptName))
}
