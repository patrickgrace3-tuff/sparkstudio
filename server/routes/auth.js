import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { query } from '../db.js'
import { signToken, requireAuth } from '../auth.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
})

// POST /api/auth/register
// Only the very first account (which becomes admin) can self-register.
// All subsequent accounts must be created by an admin via POST /api/admin/users.
router.post('/register', authLimiter, async (req, res) => {
  const { email, name, password } = req.body
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password required' })
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' })

  try {
    const count = await query('SELECT COUNT(*) FROM users')
    if (count.rows[0].count !== '0') {
      // Self-registration is closed after the first admin account exists
      return res.status(403).json({ error: 'Registration is by invitation only. Contact your administrator.' })
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)
    const result = await query(
      'INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email.toLowerCase(), name, hash, 'admin']
    )
    const user  = result.rows[0]
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })
    res.json({ token, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    const user   = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failed attempt for audit trail
      console.warn(`[auth] Failed login attempt for email: ${email.toLowerCase()} at ${new Date().toISOString()}`)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/me  — return live DB record so role is always current
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.id])
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
