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
