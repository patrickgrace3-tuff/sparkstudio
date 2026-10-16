import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const COLS = 'id, name, divisions, division_depts, created_at'

// [{ id, name }] with trimmed, unique, non-empty names
function cleanDivisions(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  return list
    .map(d => ({ id: String(d?.id ?? '').slice(0, 40) || Math.random().toString(36).slice(2, 10), name: String(d?.name ?? '').trim().slice(0, 100) }))
    .filter(d => d.name && !seen.has(d.name.toLowerCase()) && seen.add(d.name.toLowerCase()))
}

function cleanDeptIds(list) {
  return Array.isArray(list) ? [...new Set(list.map(String))] : []
}

// All authenticated users can list and read clients (shared workspace model).
// Mutations (PATCH, DELETE) require admin role to prevent accidental data loss.

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT ${COLS} FROM clients ORDER BY created_at ASC`)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, divisions, divisionDepts } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const result = await query(
      `INSERT INTO clients (name, divisions, division_depts, created_by) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [name.trim(), JSON.stringify(cleanDivisions(divisions)), JSON.stringify(cleanDeptIds(divisionDepts)), req.user.id]
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
  const { name, divisions, divisionDepts } = req.body
  if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'name cannot be empty' })
  try {
    const result = await query(
      `UPDATE clients SET
         name           = COALESCE($1, name),
         divisions      = COALESCE($2::jsonb, divisions),
         division_depts = COALESCE($3::jsonb, division_depts),
         updated_at     = NOW()
       WHERE id = $4 RETURNING ${COLS}`,
      [
        name?.trim() ?? null,
        divisions !== undefined ? JSON.stringify(cleanDivisions(divisions)) : null,
        divisionDepts !== undefined ? JSON.stringify(cleanDeptIds(divisionDepts)) : null,
        req.params.id,
      ]
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
