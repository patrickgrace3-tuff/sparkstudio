import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

// Shared data used across clients — e.g. the original PowerPoint parts and
// previews of imported slides that were saved to a template.
const router = Router()
router.use(requireAuth)

const ALLOWED_PREFIXES = ['pptxoriginal:', 'tplslide:']
const validKey = key => typeof key === 'string' && key.length <= 200 && ALLOWED_PREFIXES.some(p => key.startsWith(p))

// GET /api/assets/:key → { value } (null when missing)
router.get('/:key', async (req, res) => {
  if (!validKey(req.params.key)) return res.status(400).json({ error: 'Invalid asset key' })
  try {
    const result = await query('SELECT value FROM shared_assets WHERE asset_key = $1', [req.params.key])
    res.json({ value: result.rows[0]?.value ?? null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/assets/:key { value }
router.put('/:key', async (req, res) => {
  if (!validKey(req.params.key)) return res.status(400).json({ error: 'Invalid asset key' })
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value required' })
  try {
    await query(
      `INSERT INTO shared_assets (asset_key, value, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (asset_key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(value), req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
