import React, { useEffect, useState } from 'react'

// Preview + download for uploaded files (stored as base64 data URLs).
// Images, PDFs, CSV/TSV and plain-text formats render in place; anything the
// browser can't display (Word, PowerPoint, Excel…) offers a download instead.

const TEXT_EXTS = ['txt', 'json', 'md', 'html', 'htm', 'xml', 'log', 'csv', 'tsv']
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'pages', 'numbers', 'key', 'zip']

function extOf(name = '') {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : ''
}

export function fileBlob(file) {
  const raw  = file?.content?.base64 ?? ''
  const mime = file?.content?.mimeType || (raw.match(/^data:([^;,]+)/)?.[1]) || 'application/octet-stream'
  const b64  = raw.includes(',') ? raw.split(',')[1] : raw
  const bin  = atob(b64 || '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function downloadFile(file) {
  const url = URL.createObjectURL(fileBlob(file))
  const a = document.createElement('a')
  a.href = url
  a.download = file.name || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function previewKind(file) {
  const ext  = extOf(file?.name)
  const mime = file?.content?.mimeType ?? ''
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf'
  if (['csv', 'tsv'].includes(ext) || mime.includes('csv')) return 'table'
  // Office files are zipped XML ("…officedocument…+xml" types) — not readable as text
  if (OFFICE_EXTS.includes(ext) || mime.includes('officedocument') || mime.includes('ms-')) return 'none'
  if (mime.startsWith('text/') || mime.includes('json') || mime === 'application/xml' || TEXT_EXTS.includes(ext)) return 'text'
  return 'none'
}

function fmtSize(n) {
  if (!n && n !== 0) return ''
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

function parseDelimited(text, ext) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.length)
  const delim = ext === 'tsv' || (lines[0]?.includes('\t') && !lines[0]?.includes(',')) ? '\t' : ','
  const split = line => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
      else if (ch === delim && !q) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }
  return lines.map(split)
}

const MAX_ROWS = 200

export default function FilePreview({ file, onBack, styles: outer }) {
  const kind = previewKind(file)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')

  // Blob URLs work for images and PDFs where large data: URLs are blocked
  useEffect(() => {
    if (kind !== 'image' && kind !== 'pdf') return
    try {
      const u = URL.createObjectURL(fileBlob(file))
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    } catch { setError('This file could not be read.') }
  }, [file, kind])

  const [decoded, setDecoded] = useState(null)
  useEffect(() => {
    if (kind !== 'text' && kind !== 'table') return
    let cancelled = false
    try {
      fileBlob(file).text().then(t => { if (!cancelled) setDecoded(t) }).catch(() => setError('This file could not be read.'))
    } catch { setError('This file could not be read.') }
    return () => { cancelled = true }
  }, [file, kind])

  const rows = kind === 'table' && decoded != null ? parseDelimited(decoded, extOf(file.name)) : null
  const ext  = extOf(file.name).toUpperCase() || 'File'

  return (
    <div style={outer.editorWrap}>
      <div style={outer.editorHeader}>
        <button style={outer.backBtn} onClick={onBack}>← Back</button>
        <span style={{ ...outer.fileNameInput, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>{file.name}</span>
        <span style={outer.fileTypeBadge}>{ext}</span>
        {file.content?.size ? <span style={P.meta}>{fmtSize(file.content.size)}</span> : null}
        <button style={P.downloadBtn} onClick={() => downloadFile(file)}>↓ Download</button>
      </div>
      <div style={{ ...outer.editorBody, ...P.body }}>
        {error && <p style={P.note}>{error}</p>}
        {!error && kind === 'image' && url && (
          <img src={url} alt={file.name} style={P.image} />
        )}
        {!error && kind === 'pdf' && url && (
          <iframe src={url} title={file.name} style={P.frame} />
        )}
        {!error && kind === 'table' && rows && (
          <div style={P.tableWrap}>
            <table style={P.table}>
              <thead>
                <tr>{(rows[0] ?? []).map((h, i) => <th key={i} style={P.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1, MAX_ROWS + 1).map((r, ri) => (
                  <tr key={ri}>{(rows[0] ?? r).map((_, ci) => <td key={ci} style={P.td}>{r[ci] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length - 1 > MAX_ROWS && <p style={P.note}>Showing the first {MAX_ROWS} of {rows.length - 1} rows — download to see everything.</p>}
          </div>
        )}
        {!error && kind === 'text' && decoded != null && (
          <pre style={P.pre}>{decoded.length > 200_000 ? `${decoded.slice(0, 200_000)}\n\n… (truncated — download to see the full file)` : decoded}</pre>
        )}
        {!error && kind === 'none' && (
          <div style={P.empty}>
            <div style={{ fontSize: 40 }}>📎</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{file.name}</p>
            <p style={P.note}>{ext} files can't be previewed in the browser. Download the file to open it on your computer.</p>
            <button style={P.downloadBtn} onClick={() => downloadFile(file)}>↓ Download</button>
          </div>
        )}
      </div>
    </div>
  )
}

const P = {
  body:        { display: 'flex', flexDirection: 'column', minHeight: 0 },
  meta:        { fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' },
  downloadBtn: { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  image:       { maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', alignSelf: 'center', borderRadius: 6, border: '0.5px solid var(--color-border)' },
  frame:       { width: '100%', flex: 1, minHeight: '70vh', border: '0.5px solid var(--color-border)', borderRadius: 6, background: '#fff' },
  tableWrap:   { overflow: 'auto', maxHeight: '70vh', border: '0.5px solid var(--color-border)', borderRadius: 6 },
  table:       { borderCollapse: 'collapse', fontSize: 12, width: '100%' },
  th:          { position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', textAlign: 'left', padding: '6px 10px', borderBottom: '0.5px solid var(--color-border)', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' },
  td:          { padding: '5px 10px', borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  pre:         { margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: 12, maxHeight: '70vh', overflow: 'auto', color: 'var(--color-text-primary)' },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 16px', textAlign: 'center' },
  note:        { fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0' },
}
