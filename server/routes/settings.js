import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

// Read-only access to the admin settings every user needs (e.g. the default
// presentation order applied when generating a deck). Writes stay admin-only
// via /api/admin/settings/:key.
const PUBLIC_KEYS = new Set(['presentation_order'])

const router = Router()
router.use(requireAuth)

// GET /api/settings/:key
router.get('/:key', async (req, res) => {
  if (!PUBLIC_KEYS.has(req.params.key)) return res.status(404).json({ error: 'Not found' })
  try {
    const result = await query('SELECT value FROM admin_settings WHERE key = $1', [req.params.key])
    res.json(result.rows.length ? result.rows[0].value : null)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
