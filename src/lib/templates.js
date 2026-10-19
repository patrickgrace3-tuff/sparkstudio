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
