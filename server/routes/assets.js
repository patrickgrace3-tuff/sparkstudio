import express, { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

// Shared data used across clients — e.g. the original PowerPoint parts and
// previews of imported slides that were saved to a template.
const router = Router()
router.use(requireAuth)

const ALLOWED_PREFIXES = ['pptxoriginal:', 'tplslide:']
const validKey = key => typeof key === 'string' && key.length <= 200 && ALLOWED_PREFIXES.some(p => key.startsWith(p))

// ── Original PowerPoint files, uploaded in pieces ───────────────────────────
const FILE_KEY = /^pptxfile:[A-Za-z0-9_-]{1,80}$/
const MAX_CHUNKS = 200 // × up to 8 MB each

// PUT /api/assets/file/:key/:index — one piece of the file (raw bytes)
router.put('/file/:key/:index', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
  const idx = Number(req.params.index)
  if (!FILE_KEY.test(req.params.key) || !Number.isInteger(idx) || idx < 0 || idx >= MAX_CHUNKS) return res.status(400).json({ error: 'Invalid file key' })
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No file data' })
  try {
    await query(
      `INSERT INTO pptx_file_chunks (file_key, idx, data, created_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_key, idx) DO UPDATE SET data = $3`,
      [req.params.key, idx, req.body, req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/assets/file/:key — the whole file (pieces sent one after another)
router.get('/file/:key', async (req, res) => {
  if (!FILE_KEY.test(req.params.key)) return res.status(400).json({ error: 'Invalid file key' })
  try {
    const { rows } = await query('SELECT idx, octet_length(data) AS n FROM pptx_file_chunks WHERE file_key = $1 ORDER BY idx', [req.params.key])
    if (!rows.length) return res.status(404).json({ error: 'File not found' })
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', rows.reduce((t, r) => t + Number(r.n), 0))
    for (const r of rows) {
      const chunk = await query('SELECT data FROM pptx_file_chunks WHERE file_key = $1 AND idx = $2', [req.params.key, r.idx])
      if (!res.write(chunk.rows[0].data)) await new Promise(ok => res.once('drain', ok))
    }
    res.end()
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'Server error' })
    else res.destroy(err)
  }
})

// GET /api/assets/:key → { value } (null when missing)
router.get('/:key', async (req, res) => {
  if (!validKey(req.params.key)) return res.status(400).json({ error: 'Invalid asset key' })
  try {
    const result = await query('SELECT value FROM shared_assets WHERE asset_key = $1', [req.params.key])
    res.json({ value: result.rows[0]?.value ?? null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/assets/:key { value }
router.put('/:key', async (req, res) => {
  if (!validKey(req.params.key)) return res.status(400).json({ error: 'Invalid asset key' })
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value required' })
  try {
    await query(
      `INSERT INTO shared_assets (asset_key, value, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (asset_key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(value), req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
