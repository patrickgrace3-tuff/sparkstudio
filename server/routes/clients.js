import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// All authenticated users can list and read clients (shared workspace model).
// Mutations (PATCH, DELETE) require admin role to prevent accidental data loss.

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, name, created_at FROM clients ORDER BY created_at ASC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/clients
router.post('/', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const result = await query(
      'INSERT INTO clients (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at',
      [name.trim(), req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/clients/:id — admin only
router.patch('/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const result = await query(
      'UPDATE clients SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_at',
      [name.trim(), req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/clients/:id — admin only
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  try {
    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
