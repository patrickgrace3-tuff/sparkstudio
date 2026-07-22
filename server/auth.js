import jwt from 'jsonwebtoken'
import { query } from './db.js'

const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set to a random string of at least 32 characters.')
  process.exit(1)
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Checks the DB for the role so cached JWTs can't bypass a role downgrade,
// and old tokens without a role field still work correctly.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const result = await query('SELECT role FROM users WHERE id = $1', [req.user.id])
      const role   = result.rows[0]?.role
      if (role !== 'admin') return res.status(403).json({ error: 'Admin only' })
      req.user.role = role
      next()
    } catch (err) {
      console.error('requireAdmin DB error:', err)
      res.status(500).json({ error: 'Server error' })
    }
  })
}
