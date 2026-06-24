// ─── Departments ────────────────────────────────────────────────────────────
// Add, remove, or rename departments here. Each needs a unique id, display
// name, and a hex color used across the UI.
 
export const DEPARTMENTS = [
  { id: 'marketing',            name: 'Marketing',             color: '#1D9E75' },
  { id: 'social-media',         name: 'Social Media Marketing', color: '#378ADD' },
  { id: 'digital',              name: 'Digital',               color: '#7F77DD' },
  { id: 'creative',             name: 'Creative',              color: '#D85A30' },
  { id: 'client-services',      name: 'Client Services',       color: '#BA7517' },
  { id: 'product',              name: 'Product',               color: '#9B59B6' },
]
 
// ─── Anthropic API ───────────────────────────────────────────────────────────
// Set your API key in a .env file at the project root:
//   VITE_ANTHROPIC_API_KEY=sk-ant-...
//
// ⚠️  This calls the Anthropic API directly from the browser. That's fine for
// local / internal tools, but you should proxy through a backend before
// exposing this to the public internet.
 
export const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
 
// ─── Storage key ────────────────────────────────────────────────────────────
// Key used in localStorage to persist slide data between sessions.
export const STORAGE_KEY = 'pres-builder:slides'
 
