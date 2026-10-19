import { api } from './apiClient.js'

// Slides imported with "Keep original styling" carry style.original:
//   { ref, importId, slidePath, fileName, slideW, slideH, preview }
// `ref` is the client_data key holding the original PowerPoint parts the slide
// needs. These slides are locked — never rewritten by AI or edited. Their
// content (text, fonts, sizes, colours, images, tables, charts) is kept exactly
// and placed on the Spark Studio template's content background.

export const originalPptxKey = importId => `pptxoriginal:${importId}`

export const isLockedOriginal = slide => !!slide?.style?.original?.ref

// The stored package for a slide (cached per export)
export function loadOriginalPackage(clientId, ref, cache = new Map()) {
  if (!cache.has(ref)) cache.set(ref, api.getClientData(clientId, ref).then(r => r?.value ?? null))
  return cache.get(ref)
}

// Where the original content goes on the template: the open area below the
// logo and header line, clear of the corner graphic. The area the content
// actually covers (not the whole original slide, whose own header or margins
// may be empty now) is scaled as one block to fill it and centred, so every
// item keeps its position and proportions. It's never enlarged past its
// original size.
export const TEMPLATE_W = 12192000
export const TEMPLATE_H = 6858000
export const CONTENT_AREA = { x: 0.05, y: 0.19, w: 0.84, h: 0.72 }

// bounds: { x, y, w, h } of the content in the original slide (EMU), or null
// for the whole slide. Returns template EMU = d + original EMU × s.
export function fitOnTemplate(slideW, slideH, bounds = null) {
  const b = bounds && bounds.w > 0 && bounds.h > 0 ? bounds : { x: 0, y: 0, w: slideW, h: slideH }
  const aw = CONTENT_AREA.w * TEMPLATE_W, ah = CONTENT_AREA.h * TEMPLATE_H
  const s = Math.min(aw / b.w, ah / b.h, 1)
  return {
    s,
    dx: CONTENT_AREA.x * TEMPLATE_W + (aw - b.w * s) / 2 - b.x * s,
    dy: CONTENT_AREA.y * TEMPLATE_H + (ah - b.h * s) / 2 - b.y * s,
  }
}

// Where the slide's content sits (EMU), from its preview — before any edits,
// so moving or deleting something never shifts the rest
export function contentBoundsOf(preview) {
  const items = preview?.items ?? []
  if (!items.length || !preview.slideW) return null
  const x1 = Math.min(...items.map(i => i.x)), y1 = Math.min(...items.map(i => i.y))
  const x2 = Math.max(...items.map(i => i.x + i.w)), y2 = Math.max(...items.map(i => i.y + i.h))
  return { x: x1 * preview.slideW, y: y1 * preview.slideH, w: (x2 - x1) * preview.slideW, h: (y2 - y1) * preview.slideH }
}

// ── Edits ─────────────────────────────────────────────────────────────────────
// style.original.edits = { [element key]: { deleted, from, box, paras, cells, crop, radius } }
// Elements are the slide's top-level shapes (a group is one element).

export const canEditOriginal = slide => (slide?.style?.original?.preview?.version ?? 0) >= 3

const unionOf = items => {
  const x1 = Math.min(...items.map(i => i.x)), y1 = Math.min(...items.map(i => i.y))
  const x2 = Math.max(...items.map(i => i.x + i.w)), y2 = Math.max(...items.map(i => i.y + i.h))
  return { x: x1, y: y1, w: Math.max(x2 - x1, 1e-4), h: Math.max(y2 - y1, 1e-4) }
}

// [{ key, type, items, from }] in drawing order
export function elementsOf(preview) {
  const byKey = new Map()
  for (const it of preview?.items ?? []) {
    if (it.key == null) continue
    if (!byKey.has(it.key)) byKey.set(it.key, [])
    byKey.get(it.key).push(it)
  }
  return [...byKey].map(([key, items]) => ({
    key, items,
    type: items.length > 1 ? 'group' : items[0].chart ? 'chart' : items[0].type,
    from: unionOf(items),
  }))
}

export const paraText = p => (p.runs ?? []).map(r => (r.br ? ' ' : r.t ?? '')).join('')

function withParas(text, texts) {
  if (!text || !Array.isArray(texts)) return text
  const paras = texts.map((t, i) => {
    const orig = text.paras[i]
    if (orig && paraText(orig) === t) return orig
    const tpl = orig ?? text.paras[text.paras.length - 1]
    const first = tpl.runs.find(r => !r.br) ?? { sz: tpl.endSz }
    return { ...tpl, runs: t ? [{ ...first, t }] : [] }
  })
  return { ...text, paras }
}

// The preview's items with the edits applied
export function applyEditsToItems(items, edits) {
  if (!edits || !Object.keys(edits).length) return items
  const out = []
  for (const it of items) {
    const e = it.key != null ? edits[it.key] : null
    if (!e) { out.push(it); continue }
    if (e.deleted) continue
    let next = it
    if (e.box && e.from && e.from.w > 0 && e.from.h > 0) {
      const sx = e.box.w / e.from.w, sy = e.box.h / e.from.h
      next = { ...next, x: e.box.x + (it.x - e.from.x) * sx, y: e.box.y + (it.y - e.from.y) * sy, w: it.w * sx, h: it.h * sy }
      if (next.table) next = { ...next, table: { ...next.table, cols: next.table.cols.map(c => c * sx), rows: next.table.rows.map(r => ({ ...r, h: r.h * sy })) } }
    }
    if (e.paras && next.text) next = { ...next, text: withParas(next.text, e.paras) }
    if (e.cells && next.table) {
      next = {
        ...next,
        table: {
          ...next.table,
          rows: next.table.rows.map((row, r) => ({
            ...row,
            cells: row.cells.map((cell, c) => {
              const t = e.cells[r]?.[c]
              if (t == null || !cell.text) return cell
              return { ...cell, text: withParas(cell.text, String(t).split('\n')) }
            }),
          })),
        },
      }
    }
    if (e.crop) next = { ...next, crop: e.crop }
    if (e.radius != null) next = { ...next, radius: e.radius }
    out.push(next)
  }
  return out
}
