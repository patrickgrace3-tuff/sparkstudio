import { DEPARTMENTS } from './constants.js'

// Platform-wide default order for generated presentations, set by admins in
// the Admin Dashboard ("Presentation Order") and stored in admin_settings.
// Cover is always first and Closing always last; everything in between follows
// the configured items:
//   { type: 'dept',    dept: <department id>, section: bool }  — always included
//   { type: 'funnel',  which: 'current' | 'target', enabled: bool }
//   { type: 'team',    enabled: bool }
//   { type: 'divider', id, text, enabled: bool }   — custom section divider

export const PRESENTATION_ORDER_KEY = 'presentation_order'

export function defaultOrder() {
  return {
    items: [
      ...DEPARTMENTS.map(d => ({ type: 'dept', dept: d.id, section: true, enabled: true })),
      { type: 'funnel', which: 'current', enabled: true },
      { type: 'funnel', which: 'target',  enabled: true },
      { type: 'team', enabled: true },
    ],
  }
}

export function itemKey(item) {
  if (item.type === 'dept')    return `dept:${item.dept}`
  if (item.type === 'funnel')  return `funnel:${item.which}`
  if (item.type === 'divider') return `divider:${item.id}`
  return item.type
}

// Keeps saved items valid and adds anything new (e.g. a department added to
// constants.js after the order was saved) at the end.
export function normalizeOrder(saved) {
  const base  = defaultOrder().items
  const valid = new Set(base.map(itemKey))
  const seen  = new Set()
  const items = []
  for (const it of Array.isArray(saved?.items) ? saved.items : []) {
    if (!it || typeof it !== 'object') continue
    const key = itemKey(it)
    if (seen.has(key)) continue
    if (it.type === 'divider') {
      if (!it.id) continue
      items.push({ type: 'divider', id: String(it.id), text: String(it.text ?? 'Section Title'), enabled: it.enabled !== false })
    } else if (valid.has(key)) {
      const merged = { ...base.find(b => itemKey(b) === key), ...it, enabled: it.enabled !== false }
      if (it.type === 'dept') { merged.enabled = true; merged.section = it.section !== false }
      items.push(merged)
    } else continue
    seen.add(key)
  }
  for (const b of base) if (!seen.has(itemKey(b))) items.push(b)
  return { items }
}

export function orderItemLabel(item) {
  if (item.type === 'dept')    return DEPARTMENTS.find(d => d.id === item.dept)?.name ?? item.dept
  if (item.type === 'funnel')  return item.which === 'target' ? 'Target Funnel' : 'Current Funnel'
  if (item.type === 'team')    return 'My Team'
  if (item.type === 'divider') return item.text || 'Section Title'
  return item.type
}

// Builds the preview/export slide list for a generated deck using the
// configured order. Departments with no slides are skipped (with their
// section divider); slides from departments not in the order are appended
// before the Closing slide so nothing is ever dropped.
export function buildOrderedSlideList(deck, funnelConfig, teamConfig, order) {
  const items = normalizeOrder(order).items
  const byDept = new Map()
  for (const slide of deck.slides ?? []) {
    if (!byDept.has(slide.dept)) byDept.set(slide.dept, [])
    byDept.get(slide.dept).push(slide)
  }

  const list = [{ kind: 'cover', label: 'Cover' }]
  const pushDept = (deptName, section) => {
    const slides = byDept.get(deptName)
    if (!slides?.length) return
    if (section) list.push({ kind: 'section', label: `${deptName} — section`, dept: deptName })
    for (const slide of slides) list.push({ kind: 'content', label: deptName, slide })
    byDept.delete(deptName)
  }

  for (const it of items) {
    if (!it.enabled) continue
    if (it.type === 'dept') {
      const name = DEPARTMENTS.find(d => d.id === it.dept)?.name
      if (name) pushDept(name, it.section)
    } else if (it.type === 'funnel') {
      if (!funnelConfig) continue
      if (funnelConfig.current) {
        const cfg = it.which === 'target' ? funnelConfig.target : funnelConfig.current
        if (cfg) list.push({ kind: 'funnel', label: it.which === 'target' ? 'Target Funnel' : 'Current Funnel', funnelConfig: cfg, funnelLabel: it.which === 'target' ? 'TARGET' : 'CURRENT' })
      } else if (it.which === 'current') {
        list.push({ kind: 'funnel', label: 'Funnel', funnelConfig }) // legacy single funnel
      }
    } else if (it.type === 'team') {
      if (teamConfig) list.push({ kind: 'team', label: 'My Team', teamConfig })
    } else if (it.type === 'divider') {
      list.push({ kind: 'divider', label: 'Section Divider', text: it.text || 'Section Title', id: `div-${it.id}` })
    }
  }

  for (const deptName of [...byDept.keys()]) pushDept(deptName, true)

  list.push({ kind: 'closing', label: 'Closing' })
  return list
}
