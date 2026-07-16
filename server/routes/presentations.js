import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/presentations/:clientId — list all versions (summary, no deck payload)
router.get('/:clientId', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, client_id, version_number, version_label, title, created_at,
              (SELECT name FROM users WHERE id = presentations.created_by) AS created_by_name
       FROM presentations WHERE client_id = $1 ORDER BY version_number DESC`,
      [req.params.clientId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/presentations/:clientId/:versionId — load a specific version (with full deck)
router.get('/:clientId/:versionId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM presentations WHERE id = $1 AND client_id = $2',
      [req.params.versionId, req.params.clientId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/presentations/:clientId — save / overwrite the latest version
// If a presentation already exists for this client, update it in place.
// This keeps one live deck per client rather than accumulating stale versions.
router.post('/:clientId', async (req, res) => {
  const { title, deck, version_label } = req.body
  if (!deck) return res.status(400).json({ error: 'deck required' })
  try {
    const existing = await query(
      'SELECT id FROM presentations WHERE client_id = $1 ORDER BY version_number DESC LIMIT 1',
      [req.params.clientId]
    )

    let result
    if (existing.rows.length) {
      // Overwrite the existing presentation
      result = await query(
        `UPDATE presentations
         SET title = $1, deck = $2, version_label = $3, created_by = $4, created_at = NOW()
         WHERE id = $5
         RETURNING id, version_number, version_label, title, created_at`,
        [title || deck.title || '', JSON.stringify(deck),
         version_label || 'Latest', req.user.id, existing.rows[0].id]
      )
      res.json(result.rows[0])
    } else {
      // First time — insert
      result = await query(
        `INSERT INTO presentations (client_id, version_number, version_label, title, deck, created_by)
         VALUES ($1, 1, $2, $3, $4, $5)
         RETURNING id, version_number, version_label, title, created_at`,
        [req.params.clientId, version_label || 'Latest',
         title || deck.title || '', JSON.stringify(deck), req.user.id]
      )
      res.status(201).json(result.rows[0])
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/presentations/:clientId/:versionId
router.delete('/:clientId/:versionId', async (req, res) => {
  try {
    await query('DELETE FROM presentations WHERE id = $1 AND client_id = $2', [req.params.versionId, req.params.clientId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
