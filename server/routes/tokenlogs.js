import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// POST /api/tokenlogs  — record a token usage event from the browser
router.post('/', async (req, res) => {
  const { clientId, model, inputTokens, outputTokens } = req.body
  if (!model || inputTokens == null || outputTokens == null) {
    return res.status(400).json({ error: 'model, inputTokens, outputTokens required' })
  }
  try {
    await query(
      'INSERT INTO token_logs (client_id, user_id, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5)',
      [clientId ?? null, req.user.id, model, inputTokens, outputTokens]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
