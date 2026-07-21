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

// A template slide shell: title + layout + content guidance (AI fills bullets)
export function createSlideShell(title = '', layout = 'title-top', content = '') {
  return { title, layout, content }
}

// Build seed slides from a template for a given dept name
// Returns an array of slide objects ready to inject into the deck
export function buildSeedSlides(template, deptName) {
  const shells = template.departments[deptName] || []
  return shells.map(shell => ({
    title: shell.title || `${deptName} Overview`,
    body: shell.content || '',
    bullets: [],
    layout: shell.layout || 'title-top',
    style: { layout: shell.layout || 'title-top' },
    dept: deptName,
    _fromTemplate: true,
  }))
}
