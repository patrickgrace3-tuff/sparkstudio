import { Router } from 'express'
import express from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(express.json({ limit: '50mb' })) // PDFs and images sent as base64 can be large
router.use(requireAuth)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

// Up to 3 API keys for parallel workers.
// Set ANTHROPIC_API_KEY, ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3 in Render env vars.
function loadApiKeys() {
  return [
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_2,
    process.env.ANTHROPIC_API_KEY_3,
  ].filter(Boolean)
}

// Round-robin counter — spreads concurrent requests across keys so they run in parallel.
let rrIndex = 0

async function callWithKey(apiKey, body) {
  return fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
}

// POST /api/claude/messages
// Optional body field `workerIndex` (0-based integer): if provided, pins the request
// to a specific key so the client can deliberately spread parallel calls.
// Without it, requests are distributed round-robin automatically.
router.post('/messages', async (req, res) => {
  const keys = loadApiKeys()
  if (!keys.length) return res.status(503).json({ error: 'Anthropic API key not configured on server' })

  const { model, max_tokens, messages, system, clientId, workerIndex } = req.body
  if (!model || !max_tokens || !messages) {
    return res.status(400).json({ error: 'model, max_tokens, and messages are required' })
  }

  // Pick key: explicit workerIndex pins to that slot; otherwise round-robin
  const keyIndex = (workerIndex != null)
    ? Math.abs(workerIndex) % keys.length
    : (rrIndex++ % keys.length)

  const apiKey = keys[keyIndex]

  const body = { model, max_tokens, messages }
  if (system) body.system = system

  try {
    let upstream = await callWithKey(apiKey, body)

    // If this key is rate-limited, try the remaining keys in order
    if (upstream.status === 429) {
      for (let i = 1; i < keys.length; i++) {
        const fallback = keys[(keyIndex + i) % keys.length]
        console.warn(`Worker key ${keyIndex} rate-limited — falling back to key ${(keyIndex + i) % keys.length}`)
        upstream = await callWithKey(fallback, body)
        if (upstream.status !== 429) break
      }
    }

    if (upstream.status === 429) {
      return res.status(429).json({ error: 'All API keys are currently rate-limited. Please try again in a moment.' })
    }

    const data = await upstream.json()
    if (!upstream.ok) return res.status(upstream.status).json({ error: data })

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
