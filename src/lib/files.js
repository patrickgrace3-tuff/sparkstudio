/**
 * files.js — per-client, per-dept file storage in localStorage
 *
 * Structure:
 *   pres-builder:files:<clientId>:<deptId>  →  { folders: [...], files: [...] }
 *
 * Folder: { id, name, parentId }
 * File:   { id, name, type ('word'|'excel'|'upload'), folderId, content, createdAt, updatedAt }
 *   - word:   content = HTML string
 *   - excel:  content = { headers: [], rows: [[]] }
 *   - upload: content = { base64, mimeType, size }
 */

function key(clientId, deptId) {
  return `pres-builder:files:${clientId}:${deptId}`
}

function globalKey(clientId) {
  return `pres-builder:files:${clientId}:__global__`
}

export function loadFiles(clientId, deptId) {
  try {
    const raw = localStorage.getItem(key(clientId, deptId))
    return raw ? JSON.parse(raw) : { folders: [], files: [] }
  } catch { return { folders: [], files: [] } }
}

export function saveFiles(clientId, deptId, data) {
  localStorage.setItem(key(clientId, deptId), JSON.stringify(data))
}

export function loadGlobalFiles(clientId) {
  try {
    const raw = localStorage.getItem(globalKey(clientId))
    return raw ? JSON.parse(raw) : { folders: [], files: [] }
  } catch { return { folders: [], files: [] } }
}

export function saveGlobalFiles(clientId, data) {
  localStorage.setItem(globalKey(clientId), JSON.stringify(data))
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
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

// ── AI context builder ────────────────────────────────────────────────────────

/**
 * Separate PDF files from text-readable files.
 * Returns { textSummary, pdfFiles }
 *   textSummary — plain text blob for text-based files
 *   pdfFiles    — array of { name, base64 } for PDFs (sent as document blocks)
 */
export function buildAIContext(data, deptName, globalData = null) {
  const lines    = [`=== ${deptName} department files ===`]
  const pdfFiles = []

  // Merge global files in first so they're always visible to the AI
  const allFiles = [
    ...(globalData?.files ?? []).map(f => ({ ...f, _global: true })),
    ...data.files,
  ]

  for (const f of allFiles) {
    if (f._global) lines.push(`\n--- Global File: "${f.name}" (shared across all departments) ---`)
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
        // PDF — collect for native Anthropic document block
        const base64 = f.content?.base64?.split(',')[1] ?? f.content?.base64
        if (base64) {
          pdfFiles.push({ name: f.name, base64 })
          lines.push(`[PDF — will be read directly by AI]`)
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
    }
  }

  return {
    textSummary: allFiles.length ? lines.join('\n') : '',
    pdfFiles,
  }
}

/** Legacy helper — text-only summary (used by deck generator) */
export function summariseForAI(data, deptName) {
  return buildAIContext(data, deptName).textSummary
}