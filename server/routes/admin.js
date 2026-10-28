import express, { Router } from 'express'
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db.js'
import { requireAdmin } from '../auth.js'
import { costSql, calibrationFactor, CALIBRATION_KEY, PRICES } from '../costs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = resolve(__dirname, '../../public')

const router = Router()
router.use(requireAdmin)

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    // Slides and AI usage are totalled separately: joining both to the user
    // at once repeated every usage row once per slide (costs were multiplied)
    const [result, factor] = await Promise.all([query(`
      SELECT
        u.id, u.email, u.name, u.role, u.created_at, u.last_login,
        COALESCE(s.n, 0)    AS slides_count,
        COALESCE(t.tokens, 0) AS tokens_used,
        COALESCE(t.cost, 0)   AS tokens_cost
      FROM users u
      LEFT JOIN (SELECT created_by, COUNT(*) AS n FROM slides GROUP BY created_by) s ON s.created_by = u.id
      LEFT JOIN (
        SELECT user_id,
               SUM(input_tokens + output_tokens + cache_write_tokens + cache_read_tokens) AS tokens,
               SUM(${costSql()}) AS cost
        FROM token_logs GROUP BY user_id
      ) t ON t.user_id = u.id
      ORDER BY u.created_at ASC
    `), calibrationFactor(query)])
    res.json(result.rows.map(r => ({
      ...r,
      slides_count: parseInt(r.slides_count),
      tokens_used:  parseInt(r.tokens_used),
      tokens_cost:  parseFloat((parseFloat(r.tokens_cost) * factor).toFixed(4)),
    })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/admin/users  — invite / create a user
router.post('/users', async (req, res) => {
  const { email, name, password, role = 'user' } = req.body
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password required' })
  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' })
    const hash = await bcrypt.hash(password, 10)
    const result = await query(
      'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
      [email.toLowerCase(), name, hash, role]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/admin/users/:id  — change role or name
router.patch('/users/:id', async (req, res) => {
  const { role, name } = req.body
  const updates = []
  const vals    = []
  if (role) { updates.push(`role = $${vals.length + 1}`); vals.push(role) }
  if (name) { updates.push(`name = $${vals.length + 1}`); vals.push(name) }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' })
  vals.push(req.params.id)
  try {
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${vals.length} RETURNING id, email, name, role, created_at`,
      vals
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot delete yourself' })
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, clients, templates, slides, tokens] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM clients'),
      query('SELECT COUNT(*) FROM templates'),
      query('SELECT COUNT(*) FROM slides'),
      query(`
        SELECT
          COALESCE(SUM(input_tokens + cache_write_tokens + cache_read_tokens),  0) AS input,
          COALESCE(SUM(output_tokens), 0) AS output,
          COALESCE(SUM(${costSql()}), 0) AS cost
        FROM token_logs
      `),
    ])
    const factor = await calibrationFactor(query)
    const input  = parseInt(tokens.rows[0].input)
    const output = parseInt(tokens.rows[0].output)
    res.json({
      users:         parseInt(users.rows[0].count),
      clients:       parseInt(clients.rows[0].count),
      templates:     parseInt(templates.rows[0].count),
      slides:        parseInt(slides.rows[0].count),
      inputTokens:   input,
      outputTokens:  output,
      totalTokens:   input + output,
      estimatedCost: parseFloat((parseFloat(tokens.rows[0].cost) * factor).toFixed(4)),
      calibrated:    factor !== 1,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/clients  — clients with slide counts + token usage
router.get('/clients', async (req, res) => {
  try {
    // Slides and AI usage totalled separately (see /users)
    const [result, factor] = await Promise.all([query(`
      SELECT c.id, c.name, c.divisions, c.division_depts, c.created_at,
             COALESCE(s.n, 0)       AS slide_count,
             COALESCE(t.input, 0)   AS input_tokens,
             COALESCE(t.output, 0)  AS output_tokens,
             COALESCE(t.cost, 0)    AS estimated_cost
      FROM clients c
      LEFT JOIN (SELECT client_id, COUNT(*) AS n FROM slides GROUP BY client_id) s ON s.client_id = c.id
      LEFT JOIN (
        SELECT client_id,
               SUM(input_tokens + cache_write_tokens + cache_read_tokens) AS input,
               SUM(output_tokens) AS output,
               SUM(${costSql()}) AS cost
        FROM token_logs GROUP BY client_id
      ) t ON t.client_id = c.id
      ORDER BY c.created_at ASC
    `), calibrationFactor(query)])
    res.json(result.rows.map(r => ({
      ...r,
      slide_count:    parseInt(r.slide_count),
      total_tokens:   parseInt(r.input_tokens) + parseInt(r.output_tokens),
      estimated_cost: parseFloat((parseFloat(r.estimated_cost) * factor).toFixed(4)),
    })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/clients/:id/token-logs — clear all token logs for a client
router.delete('/clients/:id/token-logs', async (req, res) => {
  try {
    await query('DELETE FROM token_logs WHERE client_id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/template-info — metadata about the current template.pptx
router.get('/template-info', (req, res) => {
  try {
    const stat = statSync(resolve(PUBLIC_DIR, 'template.pptx'))
    res.json({ size: stat.size, updatedAt: stat.mtime })
  } catch {
    res.json({ size: null, updatedAt: null })
  }
})

// PUT /api/admin/template — replace template.pptx (raw binary body, max 20 MB)
router.put('/template', express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No file data' })
    // PPTX/DOCX/XLSX are ZIP archives — magic bytes are PK\x03\x04
    if (req.body[0] !== 0x50 || req.body[1] !== 0x4B || req.body[2] !== 0x03 || req.body[3] !== 0x04) {
      return res.status(400).json({ error: 'Invalid file: expected a PPTX (ZIP) file' })
    }
    writeFileSync(resolve(PUBLIC_DIR, 'template.pptx'), req.body)
    const stat = statSync(resolve(PUBLIC_DIR, 'template.pptx'))
    res.json({ ok: true, size: stat.size, updatedAt: stat.mtime })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save template' })
  }
})

// PUT /api/admin/branding/:filename — replace a branding image (raw binary body)
router.put('/branding/:filename', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '20mb' }), (req, res) => {
  const allowed = ['cover-bg.jpg', 'section-bg.jpg', 'content-bg.jpg']
  if (!allowed.includes(req.params.filename)) return res.status(400).json({ error: 'Unknown branding file' })
  try {
    if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'No file data' })
    writeFileSync(resolve(PUBLIC_DIR, 'branding', req.params.filename), req.body)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save branding image' })
  }
})

// ── AI cost: compare with the Anthropic bill ──────────────────────────────
// GET /api/admin/costs?from=YYYY-MM-DD&to=YYYY-MM-DD — estimated cost (before
// calibration) per API key and per model for the period, to set against the
// Anthropic console's cost per API key
router.get('/costs', async (req, res) => {
  const { from, to } = req.query
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(from ?? '') || !day.test(to ?? '')) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD)' })
  try {
    const range = `created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`
    const [byKey, byModel, unassigned, cal] = await Promise.all([
      query(`SELECT key_slot, COUNT(*) AS calls, SUM(input_tokens + cache_write_tokens + cache_read_tokens) AS input, SUM(output_tokens) AS output, SUM(${costSql()}) AS cost
             FROM token_logs WHERE ${range} GROUP BY key_slot ORDER BY key_slot NULLS LAST`, [from, to]),
      query(`SELECT model, COUNT(*) AS calls, SUM(input_tokens + cache_write_tokens + cache_read_tokens) AS input, SUM(output_tokens) AS output, SUM(${costSql()}) AS cost
             FROM token_logs WHERE ${range} GROUP BY model ORDER BY cost DESC`, [from, to]),
      query(`SELECT COUNT(*) AS calls, COALESCE(SUM(${costSql()}), 0) AS cost FROM token_logs WHERE ${range} AND client_id IS NULL`, [from, to]),
      query('SELECT value FROM admin_settings WHERE key = $1', [CALIBRATION_KEY]),
    ])
    const num = r => ({ ...r, calls: parseInt(r.calls), input: parseInt(r.input ?? 0), output: parseInt(r.output ?? 0), cost: parseFloat(r.cost ?? 0) })
    const keys = byKey.rows.map(num)
    res.json({
      from, to,
      estimate: keys.reduce((t, k) => t + k.cost, 0),
      byKey: keys,
      byModel: byModel.rows.map(num),
      unassigned: { calls: parseInt(unassigned.rows[0].calls), cost: parseFloat(unassigned.rows[0].cost) },
      calibration: cal.rows[0]?.value ?? null,
      prices: PRICES.map(({ label, input, output }) => ({ label, input, output })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/admin/costs/calibration { from, to, actual } — what Anthropic
// actually charged for the period; estimates are scaled by actual ÷ estimate.
// DELETE removes it.
router.put('/costs/calibration', async (req, res) => {
  const { from, to } = req.body ?? {}
  const actual = Number(req.body?.actual)
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(from ?? '') || !day.test(to ?? '') || !(actual > 0)) return res.status(400).json({ error: 'from, to and an actual amount above 0 are required' })
  try {
    const est = await query(`SELECT COALESCE(SUM(${costSql()}), 0) AS cost FROM token_logs WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`, [from, to])
    const estimate = parseFloat(est.rows[0].cost)
    if (!(estimate > 0)) return res.status(400).json({ error: 'No AI usage was recorded in that period, so there is nothing to compare with.' })
    const value = { factor: actual / estimate, actual, estimate, from, to, setAt: new Date().toISOString() }
    await query(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [CALIBRATION_KEY, JSON.stringify(value)]
    )
    res.json(value)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/costs/calibration', async (req, res) => {
  try {
    await query('DELETE FROM admin_settings WHERE key = $1', [CALIBRATION_KEY])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/settings/:key
router.get('/settings/:key', async (req, res) => {
  try {
    const result = await query('SELECT value FROM admin_settings WHERE key = $1', [req.params.key])
    res.json(result.rows.length ? result.rows[0].value : null)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/admin/settings/:key
router.put('/settings/:key', async (req, res) => {
  try {
    await query(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(req.body)]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
