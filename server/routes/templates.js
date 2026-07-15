import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM templates ORDER BY created_at ASC')
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/templates
router.post('/', async (req, res) => {
  const { name, description, departments } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const result = await query(
      `INSERT INTO templates (name, description, departments, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description ?? '', JSON.stringify(departments ?? {}), req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/templates/:id — full replace
router.put('/:id', async (req, res) => {
  const { name, description, departments } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const result = await query(
      `UPDATE templates SET name=$1, description=$2, departments=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name.trim(), description ?? '', JSON.stringify(departments ?? {}), req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM templates WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
