import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

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
    const [users, clients, templates, slides] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM clients'),
      query('SELECT COUNT(*) FROM templates'),
      query('SELECT COUNT(*) FROM slides'),
    ])
    res.json({
      users:     parseInt(users.rows[0].count),
      clients:   parseInt(clients.rows[0].count),
      templates: parseInt(templates.rows[0].count),
      slides:    parseInt(slides.rows[0].count),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/clients  — clients with slide counts
router.get('/clients', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.name, c.created_at,
             COUNT(DISTINCT s.id) AS slide_count
      FROM clients c
      LEFT JOIN slides s ON s.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
