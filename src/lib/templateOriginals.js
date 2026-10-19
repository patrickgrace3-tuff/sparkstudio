import { api } from './apiClient.js'
import { callClaude } from './api.js'
import { ANTHROPIC_MODEL_DECK } from './constants.js'
import { loadOriginalPackage, canEditOriginal, elementsOf, applyEditsToItems, paraText } from './originalSlides.js'
import { rebuildOriginalPreview } from './importPptx.js'

// Imported slides ("Keep original styling") saved to templates. A template
// shell for one looks like
//   { kind: 'original', title, content, doThis, dontDoThis, asset, fileName }
// where `asset` names a shared copy of the slide (its design, preview and any
// edits) usable by every client. When the template is applied, the slide keeps
// its exact design and the AI rewrites its text for the client.

export const isOriginalShell = shell => shell?.kind === 'original' && !!shell.asset

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

// Shared copy of an imported slide → shell for a template
export async function originalSlideToShell(slide, clientId, guidance = {}) {
  const original = slide.style?.original
  if (!original?.ref) throw new Error('This slide was not imported with its original styling.')

  // The original PowerPoint parts, shared once per imported file
  let ref = original.ref
  let pkg = null
  if (!ref.startsWith('asset:')) {
    pkg = await loadOriginalPackage(clientId, ref)
    if (!pkg) throw new Error('The original PowerPoint for this slide could not be found.')
    const key = `pptxoriginal:${original.importId ?? newId()}`
    const existing = await api.getAsset(key).catch(() => null)
    if (!existing?.value) await api.setAsset(key, pkg)
    ref = `asset:${key}`
  }
  let preview = original.preview
  if (!canEditOriginal(slide)) {
    pkg ??= await loadOriginalPackage(clientId, ref)
    preview = await rebuildOriginalPreview(pkg, original.slidePath)
  }

  const asset = `tplslide:${newId()}`
  await api.setAsset(asset, { original: { ...original, ref, preview, edits: original.edits ?? {} } })
  return {
    kind: 'original',
    title: guidance.title ?? slide.title ?? '',
    content: guidance.content ?? '',
    doThis: guidance.doThis ?? '',
    dontDoThis: guidance.dontDoThis ?? '',
    asset,
    fileName: original.fileName ?? '',
  }
}

const assetCache = new Map()
export function loadShellOriginal(shell) {
  if (!assetCache.has(shell.asset)) assetCache.set(shell.asset, api.getAsset(shell.asset).then(r => r?.value?.original ?? null))
  return assetCache.get(shell.asset)
}

// The slide's text, element by element, as the AI sees it
export function textElements(original) {
  const preview = original.preview
  const items = applyEditsToItems(preview?.items ?? [], original.edits)
  const out = []
  for (const el of elementsOf(preview)) {
    if (original.edits?.[el.key]?.deleted) continue
    const its = items.filter(i => i.key === el.key)
    if (its.length !== 1) continue // groups keep their text
    const it = its[0]
    if (it.type === 'shape' && it.text && !it.smartArt) {
      const paras = it.text.paras.map(paraText)
      if (paras.some(p => p.trim())) out.push({ key: el.key, kind: 'text', paras })
    } else if (it.type === 'table' && it.table) {
      const cells = it.table.rows.map(r => r.cells.map(c => (c.skip ? null : (c.text?.paras ?? []).map(paraText).join('\n'))))
      out.push({ key: el.key, kind: 'table', cells })
    }
  }
  return out
}

/**
 * Rewrites an imported slide's text for a client, keeping its design.
 * Returns new edits for style.original (the saved edits plus text changes)
 * and a title for the slide.
 *   context: { clientName, deptName, division, deptSummary, globalSummary, imageFiles, pdfFiles }
 */
export async function rewriteOriginalText(original, shell, context, clientId) {
  const elements = textElements(original)
  const edits = JSON.parse(JSON.stringify(original.edits ?? {}))
  if (!elements.length) return { edits, title: shell.title || original.preview?.title || '' }

  const described = elements.map(e => e.kind === 'text'
    ? { id: e.key, type: 'text', paragraphs: e.paras.map(p => ({ text: p, chars: p.length })) }
    : { id: e.key, type: 'table', cells: e.cells })
  const guidance = [
    shell.content && `What this slide should cover: ${shell.content}`,
    shell.doThis?.trim() && `Do this: ${shell.doThis.trim()}`,
    shell.dontDoThis?.trim() && `Do NOT do this: ${shell.dontDoThis.trim()}`,
  ].filter(Boolean).join('\n')

  const prompt = `You are filling in a designed presentation slide for a client. The slide's design is fixed — every text element has a set size on the slide — so you only rewrite its words.

Client: ${context.clientName || 'the client'}
Department: ${context.deptName}${context.division ? ` — ${context.division} division (write only about this division)` : ''}
Slide: ${shell.title || original.preview?.title || 'Untitled'}
${guidance ? `\n${guidance}\n` : ''}
${context.globalSummary ? `Company context:\n${context.globalSummary}\n` : ''}${context.deptSummary ? `Department files and notes:\n${context.deptSummary}\n` : ''}
The slide's current text elements (from a past presentation, used as the example to follow):
${JSON.stringify(described, null, 1)}

Rewrite the text so the slide is about ${context.clientName || 'this client'}, using the client context above. Rules:
- Keep every element and the same number of paragraphs in each (one string per paragraph), and the same table shape.
- Keep each paragraph close to its original length (within about 20% of "chars") so it still fits the design.
- Keep short labels, headings and category names that aren't about the old client as they are (or adjust them lightly).
- Never invent figures — only use numbers that appear in the client context; otherwise write qualitative text.
- Return ONLY valid JSON (no markdown): {"title": "slide title for the slide list", "elements": [{"id": "...", "paragraphs": ["..."]} or {"id": "...", "cells": [["..."]]}]}`

  const raw = await callClaude(prompt, '', 3000, {
    clientId, model: ANTHROPIC_MODEL_DECK,
    imageFiles: context.imageFiles ?? [], pdfFiles: context.pdfFiles ?? [],
  })
  let parsed
  try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
  catch { throw new Error('The AI response for this slide could not be read.') }

  for (const out of parsed.elements ?? []) {
    const el = elements.find(e => String(e.key) === String(out.id))
    if (!el) continue
    if (el.kind === 'text' && Array.isArray(out.paragraphs)) {
      const paras = el.paras.map((p, i) => (typeof out.paragraphs[i] === 'string' ? out.paragraphs[i] : p))
      edits[el.key] = { ...edits[el.key], paras }
    } else if (el.kind === 'table' && Array.isArray(out.cells)) {
      const cells = el.cells.map((row, r) => row.map((c, ci) => (c == null ? null : typeof out.cells[r]?.[ci] === 'string' ? out.cells[r][ci] : c)))
      edits[el.key] = { ...edits[el.key], cells }
    }
  }
  return { edits, title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : (shell.title || original.preview?.title || '') }
}

// A builder slide for a client from an imported-slide shell
export async function slideFromOriginalShell(shell, context, clientId) {
  const original = await loadShellOriginal(shell)
  if (!original) throw new Error(`The imported slide "${shell.title}" in this template could not be found.`)
  let rewritten
  try { rewritten = await rewriteOriginalText(original, shell, context, clientId) }
  catch (err) {
    console.error('Rewriting template slide failed, using it as saved:', err)
    rewritten = { edits: original.edits ?? {}, title: shell.title || original.preview?.title || '' }
  }
  const textOf = elements => elements.flatMap(e => (e.kind === 'text' ? e.paras : e.cells.flat().filter(Boolean)))
  const texts = textOf(textElements({ ...original, edits: rewritten.edits })).filter(t => t.trim())
  return {
    title: rewritten.title,
    bullets: texts.filter(t => t !== rewritten.title).slice(0, 12),
    body: texts.join('\n'),
    notes: original.preview?.notes ?? '',
    table: null,
    style: { original: { ...original, edits: rewritten.edits } },
    _fromTemplate: true,
  }
}
