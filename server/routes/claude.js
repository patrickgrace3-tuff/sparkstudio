import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

// POST /api/claude/messages
// Proxies a request to the Anthropic API using the server-side API key.
// The browser never sees the key — it is only read from process.env on the server.
router.post('/messages', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'Anthropic API key not configured on server' })

  const { model, max_tokens, messages, system, clientId } = req.body
  if (!model || !max_tokens || !messages) {
    return res.status(400).json({ error: 'model, max_tokens, and messages are required' })
  }

  const body = { model, max_tokens, messages }
  if (system) body.system = system

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data })
    }

    // Log token usage server-side — client cannot fabricate these numbers
    const usage = data.usage
    if (usage) {
      query(
        'INSERT INTO token_logs (client_id, user_id, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5)',
        [clientId ?? null, req.user.id, model, usage.input_tokens ?? 0, usage.output_tokens ?? 0]
      ).catch(err => console.error('Token log error:', err.message))
    }

    res.json(data)
  } catch (err) {
    console.error('Claude proxy error:', err)
    res.status(502).json({ error: 'Failed to reach Anthropic API' })
  }
})

export default router
