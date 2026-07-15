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
 
// ─── Per-department file/link requirements ────────────────────────────────────
// Shown as a checklist in each department's Files tab so contributors know
// exactly what Spark Studio expects from them. Purely informational today —
// checking an item off doesn't gate anything (see MVP proposal doc).
export const DEPT_REQUIREMENTS = {
  marketing: [
    'Latest slides from the data rundown / survey data',
    'Client Information Sheet (use the templated slide)',
  ],
  'social-media': [
    'Note the year-over-year timeframe on anything you pull',
    'Hey Orca information',
    'Facebook / Instagram / LinkedIn data',
    'Review Tracker info — benchmark rating + reviews-to-5-stars outcomes',
    'Looker report link',
    'Monitoring Playbook',
  ],
  digital: [
    'Note the year-over-year timeframe on anything you pull',
    'Vendor platform data (job boards)',
    'Looker report link',
    'Geo-sheets breakdown',
    'Best performance: SEM Aware | SEM Interactive | Social Advertising',
  ],
  creative: [
    'SharePoint access for images/videos used in creative & design slides',
    'Recommendations',
    'Creative Package Recap',
  ],
  'client-services': [
    'Note the year-over-year timeframe on anything you pull',
    'Access to all Looker reports, for review',
    'My Team slide (use the templated slide)',
  ],
  product: [
    'Agents Looker report link',
    'Lead Assist Looker report link',
  ],
}

// ─── Anthropic API ───────────────────────────────────────────────────────────
// Set your API key in a .env file at the project root:
//   VITE_ANTHROPIC_API_KEY=sk-ant-...
//
// ⚠️  This calls the Anthropic API directly from the browser. That's fine for
// local / internal tools, but you should proxy through a backend before
// exposing this to the public internet.
 
export const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
// Cheaper model used for bulk generation (template runs, deck generation)
// Switch back to ANTHROPIC_MODEL if you need richer reasoning
export const ANTHROPIC_MODEL_FAST = 'claude-haiku-4-5-20251001'
 
// ─── Storage key ────────────────────────────────────────────────────────────
// Key used in localStorage to persist slide data between sessions.
export const STORAGE_KEY = 'pres-builder:slides'
 
