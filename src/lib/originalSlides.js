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

// Where the original slide goes on the template: below the logo and header
// line, clear of the corner graphic. The whole slide is scaled as one block,
// so everything keeps its position and proportions. Fractions of the template.
export const TEMPLATE_W = 12192000
export const TEMPLATE_H = 6858000
export const CONTENT_AREA = { x: 0.03, y: 0.17, w: 0.80, h: 0.80 }

export function fitOnTemplate(slideW, slideH) {
  const s = Math.min((CONTENT_AREA.w * TEMPLATE_W) / slideW, (CONTENT_AREA.h * TEMPLATE_H) / slideH)
  return { s, x: CONTENT_AREA.x, y: CONTENT_AREA.y, w: (s * slideW) / TEMPLATE_W, h: (s * slideH) / TEMPLATE_H }
}
