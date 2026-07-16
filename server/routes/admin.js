import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAdmin } from '../auth.js'

const router = Router()
router.use(requireAdmin)

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC')
    res.json(result.rows)
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
      query('SELECT COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM token_logs'),
    ])
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
      estimatedCost: calcCost('mixed', input, output),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/clients  — clients with slide counts + token usage
router.get('/clients', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.name, c.created_at,
             COUNT(DISTINCT s.id)               AS slide_count,
             COALESCE(SUM(tl.input_tokens),  0) AS input_tokens,
             COALESCE(SUM(tl.output_tokens), 0) AS output_tokens
      FROM clients c
      LEFT JOIN slides    s  ON s.client_id  = c.id
      LEFT JOIN token_logs tl ON tl.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `)
    res.json(result.rows.map(r => ({
      ...r,
      total_tokens:   parseInt(r.input_tokens) + parseInt(r.output_tokens),
      estimated_cost: calcCost('mixed', parseInt(r.input_tokens), parseInt(r.output_tokens)),
    })))
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

// Pricing helper — blended rate across sonnet + haiku mix
// Sonnet 4.6: $3/M input, $15/M output
// Haiku 4.5:  $0.80/M input, $4/M output
// Blended estimate weights ~70% haiku (deck gen) / 30% sonnet (AI assistant)
function calcCost(model, input, output) {
  const inRate  = (0.7 * 0.80 + 0.3 * 3.00)  / 1_000_000
  const outRate = (0.7 * 4.00 + 0.3 * 15.00) / 1_000_000
  return parseFloat((input * inRate + output * outRate).toFixed(4))
}

export default router
