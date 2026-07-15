/**
 * files.js — per-client, per-dept file storage
 * Reads/writes via the API (synced across users).
 * Falls back to localStorage for immediate reads while API loads.
 */

import { api } from './apiClient.js'

function lsKey(clientId, deptId) {
  return `pres-builder:files:${clientId}:${deptId}`
}
function globalLsKey(clientId) {
  return `pres-builder:files:${clientId}:__global__`
}

export function loadFiles(clientId, deptId) {
  try {
    const raw = localStorage.getItem(lsKey(clientId, deptId))
    return raw ? JSON.parse(raw) : { folders: [], files: [] }
  } catch { return { folders: [], files: [] } }
}

export async function loadFilesRemote(clientId, deptId) {
  try {
    const res = await api.getClientData(clientId, `files:${deptId}`)
    const data = res.value ?? { folders: [], files: [] }
    localStorage.setItem(lsKey(clientId, deptId), JSON.stringify(data))
    return data
  } catch { return loadFiles(clientId, deptId) }
}

export function saveFiles(clientId, deptId, data) {
  localStorage.setItem(lsKey(clientId, deptId), JSON.stringify(data))
  api.setClientData(clientId, `files:${deptId}`, data).catch(console.error)
}

export function loadGlobalFiles(clientId) {
  try {
    const raw = localStorage.getItem(globalLsKey(clientId))
    return raw ? JSON.parse(raw) : { folders: [], files: [] }
  } catch { return { folders: [], files: [] } }
}

export async function loadGlobalFilesRemote(clientId) {
  try {
    const res = await api.getClientData(clientId, 'files:__global__')
    const data = res.value ?? { folders: [], files: [] }
    localStorage.setItem(globalLsKey(clientId), JSON.stringify(data))
    return data
  } catch { return loadGlobalFiles(clientId) }
}

export function saveGlobalFiles(clientId, data) {
  localStorage.setItem(globalLsKey(clientId), JSON.stringify(data))
  api.setClientData(clientId, 'files:__global__', data).catch(console.error)
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Per-department requirements checklist (which items have been checked off) ──

function checklistKey(clientId, deptId) {
  return `pres-builder:checklist:${clientId}:${deptId}`
}

export function loadChecklist(clientId, deptId) {
  try {
    const raw = localStorage.getItem(checklistKey(clientId, deptId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveChecklist(clientId, deptId, checkedItems) {
  localStorage.setItem(checklistKey(clientId, deptId), JSON.stringify(checkedItems))
}

// ── Uploaded file content extraction ─────────────────────────────────────────

/**
 * Decode a base64 data URL to a plain string.
 * Works for text-based files: CSV, TSV, TXT, JSON, HTML, XML, MD.
 */
function base64ToText(base64DataUrl) {
  try {
    // Strip the data:...;base64, prefix
    const base64 = base64DataUrl.split(',')[1] ?? base64DataUrl
    return atob(base64)
  } catch {
    return null
  }
}

/**
 * Parse a CSV/TSV string into { headers, rows, rowCount }.
 */
function parseCsv(text, delimiter = ',') {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 1) return null

  // Auto-detect TSV
  if (delimiter === ',' && lines[0].includes('\t') && !lines[0].includes(',')) {
    delimiter = '\t'
  }

  const headers = splitLine(lines[0], delimiter)
  const rows    = lines.slice(1).map(l => splitLine(l, delimiter))

  return { headers, rows, rowCount: rows.length }
}

function splitLine(line, delimiter) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === delimiter && !inQ) {
      result.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

/**
 * Extract readable text content from an uploaded file.
 * Returns a string ready to send to the AI, or null if binary/unreadable.
 */
export function extractUploadedContent(file) {
  const { name, content } = file
  const mime = content?.mimeType ?? ''
  const ext  = name.split('.').pop().toLowerCase()

  // PDFs are handled separately via extractPdfContent — return a sentinel
  if (ext === 'pdf' || mime.includes('pdf')) {
    return '__PDF__'
  }

  const isText = mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('csv') ||
    mime.includes('xml') ||
    ['csv', 'tsv', 'txt', 'json', 'md', 'html', 'xml', 'log'].includes(ext)

  if (!isText || !content?.base64) return null

  const text = base64ToText(content.base64)
  if (!text) return null

  // CSV / TSV — parse into readable table
  if (['csv', 'tsv'].includes(ext) || mime.includes('csv')) {
    const parsed = parseCsv(text)
    if (parsed) {
      const lines = [
        `Headers: ${parsed.headers.join(' | ')}`,
        ...parsed.rows.slice(0, 50).map(r => r.join(' | ')),
      ]
      if (parsed.rowCount > 50) lines.push(`… and ${parsed.rowCount - 50} more rows`)
      return lines.join('\n')
    }
  }

  // JSON — pretty print up to 3000 chars
  if (ext === 'json' || mime.includes('json')) {
    try {
      const parsed = JSON.parse(text)
      return JSON.stringify(parsed, null, 2).slice(0, 3000)
    } catch { /* fall through to plain text */ }
  }

  // Plain text / markdown / HTML — return trimmed, up to 3000 chars
  return text.slice(0, 3000)
}

// ── SharePoint / web links ────────────────────────────────────────────────────

/**
 * Best-effort fetch of a linked file's text content (e.g. a SharePoint
 * "anyone with the link" share URL, or any other directly-fetchable URL).
 * Browsers can't read content behind Microsoft auth without an OAuth/Graph
 * integration and a backend, so this is intentionally best-effort: if the
 * fetch is blocked (CORS, login redirect, etc.) we just keep the link itself
 * as a named reference the AI can see, rather than failing the whole flow.
 */
export async function fetchLinkContent(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return { text: null, error: `HTTP ${res.status}` }
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text') || contentType.includes('json') || contentType.includes('csv') || contentType.includes('xml')) {
      const text = await res.text()
      return { text: text.slice(0, 3000), error: null }
    }
    return { text: null, error: 'Unsupported content type for auto-read' }
  } catch {
    return { text: null, error: 'Could not be fetched directly (likely requires sign-in) — kept as a reference link' }
  }
}

// ── AI context builder ────────────────────────────────────────────────────────

/**
 * Separate PDF files from text-readable files.
 * Returns { textSummary, pdfFiles }
 *   textSummary — plain text blob for text-based files
 *   pdfFiles    — array of { name, base64 } for PDFs (sent as document blocks)
 */
function processFile(f, lines, pdfFiles, imageFiles) {
  if (f.type === 'word') {
    const text = (f.content ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    lines.push(text || '(empty document)')

  } else if (f.type === 'excel') {
    const { headers = [], rows = [] } = f.content ?? {}
    if (headers.length) {
      lines.push(`Headers: ${headers.join(' | ')}`)
      rows.slice(0, 50).forEach(r => lines.push(r.join(' | ')))
      if (rows.length > 50) lines.push(`… and ${rows.length - 50} more rows`)
    } else {
      lines.push('(empty spreadsheet)')
    }

  } else if (f.type === 'upload') {
    const ext  = f.name.split('.').pop().toLowerCase()
    const mime = f.content?.mimeType ?? ''

    if (ext === 'pdf' || mime.includes('pdf')) {
      const base64 = f.content?.base64?.split(',')[1] ?? f.content?.base64
      if (base64) {
        if (pdfFiles) pdfFiles.push({ name: f.name, base64 })
        lines.push(`[PDF — will be read directly by AI]`)
      }
    } else if (mime.startsWith('image/') || ['png','jpg','jpeg','gif','webp'].includes(ext)) {
      const raw = f.content?.base64
      if (raw) {
        const b64 = raw.includes(',') ? raw.split(',')[1] : raw
        const imageMime = mime || `image/${ext === 'jpg' ? 'jpeg' : ext}`
        if (imageFiles) imageFiles.push({ name: f.name, base64: b64, mimeType: imageMime })
        lines.push(`[Image file: "${f.name}" — will be viewed directly by AI]`)
      }
    } else {
      const extracted = extractUploadedContent(f)
      if (extracted && extracted !== '__PDF__') {
        lines.push(extracted)
      } else {
        const kb = Math.round((f.content?.size ?? 0) / 1024)
        lines.push(`[Binary file — ${mime || 'unknown'}, ${kb}KB — not readable as text]`)
      }
    }
  } else if (f.type === 'link') {
    const url = f.content?.url ?? ''
    if (f.content?.fetchedText) {
      lines.push(`[Linked file: "${f.name}" — ${url}]\n${f.content.fetchedText}`)
    } else {
      lines.push(`[Linked file: "${f.name}" — ${url} — content could not be auto-read (${f.content?.fetchError || 'sign-in required'}); treat as a named reference only]`)
    }
  }
}

export function buildAIContext(data, deptName, globalData = null) {
  const pdfFiles   = []
  const imageFiles = []

  const deptFiles   = data.files ?? []
  const globalFiles = (globalData?.files ?? [])

  // Dept-only summary
  const deptLines = deptFiles.length ? [`=== ${deptName} department files ===`] : []
  for (const f of deptFiles) processFile(f, deptLines, pdfFiles, imageFiles)

  // Global-only summary (sent once at top of prompt, not per-dept)
  const globalLines = globalFiles.length ? ['=== Shared company files ==='] : []
  for (const f of globalFiles) processFile(f, globalLines, pdfFiles, imageFiles)

  // Combined summary (for single-dept use cases or backward compat)
  const allLines = []
  if (globalLines.length) allLines.push(...globalLines)
  if (deptLines.length)   allLines.push(...deptLines)

  return {
    textSummary:   allLines.length    ? allLines.join('\n')    : '',
    deptSummary:   deptLines.length   ? deptLines.join('\n')   : '',
    globalSummary: globalLines.length ? globalLines.join('\n') : '',
    pdfFiles,
    imageFiles,
  }
}
