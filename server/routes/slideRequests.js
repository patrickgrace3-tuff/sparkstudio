import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const router = Router()

const DEFAULT_LIMIT = 5 // slides per client for regular users

// GET /api/slide-requests/my-limit/:clientId
// Returns the effective slide limit for the current user on a given client.
// Admins have no limit (-1). Regular users get their latest approved limit or the default.
router.get('/my-limit/:clientId', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.json({ limit: -1, isAdmin: true })

    const result = await query(
      `SELECT approved_limit FROM slide_requests
       WHERE user_id = $1 AND client_id = $2 AND status = 'approved'
       ORDER BY reviewed_at DESC LIMIT 1`,
      [req.user.id, req.params.clientId]
    )
    const limit = result.rows[0]?.approved_limit ?? DEFAULT_LIMIT
    res.json({ limit, isAdmin: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/slide-requests
// User requests a higher slide limit for a client.
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admins have no limits' })
  const { clientId, requestedLimit, note } = req.body
  if (!clientId) return res.status(400).json({ error: 'clientId required' })

  try {
    // Check if a pending request already exists
    const existing = await query(
      `SELECT id FROM slide_requests WHERE user_id = $1 AND client_id = $2 AND status = 'pending'`,
      [req.user.id, clientId]
    )
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You already have a pending request for this client' })
    }

    const result = await query(
      `INSERT INTO slide_requests (user_id, client_id, requested_limit, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, clientId, requestedLimit ?? 10, note ?? '']
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/slide-requests — admin: list all pending requests with user + client info
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.*, u.name AS user_name, u.email AS user_email, c.name AS client_name
       FROM slide_requests sr
       JOIN users   u ON u.id = sr.user_id
       JOIN clients c ON c.id = sr.client_id
       ORDER BY sr.created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/slide-requests/:id — admin: approve or reject, set limit
router.patch('/:id', requireAdmin, async (req, res) => {
  const { status, approvedLimit } = req.body
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' })
  }
  try {
    const result = await query(
      `UPDATE slide_requests
       SET status = $1, approved_limit = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, approvedLimit ?? null, req.user.id, req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
