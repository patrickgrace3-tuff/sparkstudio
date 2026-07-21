import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const ALLOWED_KEYS = new Set(['funnel', 'team', 'checklist', 'looker', 'files', 'presentation'])

function validateKey(req, res, next) {
  if (!ALLOWED_KEYS.has(req.params.dataKey)) {
    return res.status(400).json({ error: 'Invalid data key' })
  }
  next()
}

// GET /api/clientdata/:clientId/:dataKey
router.get('/:clientId/:dataKey', validateKey, async (req, res) => {
  try {
    const result = await query(
      'SELECT value FROM client_data WHERE client_id = $1 AND data_key = $2',
      [req.params.clientId, req.params.dataKey]
    )
    if (!result.rows.length) return res.json({ value: null })
    res.json({ value: result.rows[0].value })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/clientdata/:clientId/:dataKey
router.put('/:clientId/:dataKey', validateKey, async (req, res) => {
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value required' })
  try {
    await query(
      `INSERT INTO client_data (client_id, data_key, value, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id, data_key) DO UPDATE SET value = $3, updated_at = NOW(), updated_by = $4`,
      [req.params.clientId, req.params.dataKey, JSON.stringify(value), req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
