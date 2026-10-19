import { api } from './apiClient.js'

// Slides imported with "Keep original styling" carry style.original:
//   { ref, importId, slidePath, fileName, slideW, slideH, preview }
// `ref` is the client_data key holding the original PowerPoint parts the slide
// needs ({ slideW, slideH, parts, types }). These slides are locked — they're
// never rewritten by AI or edited, and the export copies them in unchanged.

export const originalPptxKey = importId => `pptxoriginal:${importId}`

export const isLockedOriginal = slide => !!slide?.style?.original?.ref

// The stored package for a slide (cached per export)
export function loadOriginalPackage(clientId, ref, cache = new Map()) {
  if (!cache.has(ref)) cache.set(ref, api.getClientData(clientId, ref).then(r => r?.value ?? null))
  return cache.get(ref)
}
