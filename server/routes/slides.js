import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/slides/:clientId  → { [deptId]: [...slides] }
router.get('/:clientId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM slides WHERE client_id = $1 ORDER BY dept_id, sort_order',
      [req.params.clientId]
    )
    const map = {}
    for (const row of result.rows) {
      if (!map[row.dept_id]) map[row.dept_id] = []
      map[row.dept_id].push(row)
    }
    res.json(map)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/slides/:clientId  — add one slide
router.post('/:clientId', async (req, res) => {
  const { dept_id, title, body, bullets, style, sort_order } = req.body
  if (!dept_id) return res.status(400).json({ error: 'dept_id required' })
  try {
    const result = await query(
      `INSERT INTO slides (client_id, dept_id, title, body, bullets, style, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.clientId, dept_id, title ?? '', body ?? '',
       JSON.stringify(bullets ?? []), JSON.stringify(style ?? {}),
       sort_order ?? 0, req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/slides/:clientId/:slideId — update one slide
router.patch('/:clientId/:slideId', async (req, res) => {
  const { title, body, bullets, style, sort_order } = req.body
  try {
    const result = await query(
      `UPDATE slides SET
        title      = COALESCE($1, title),
        body       = COALESCE($2, body),
        bullets    = COALESCE($3, bullets),
        style      = COALESCE($4, style),
        sort_order = COALESCE($5, sort_order),
        updated_at = NOW()
       WHERE id = $6 AND client_id = $7 RETURNING *`,
      [title, body,
       bullets != null ? JSON.stringify(bullets) : null,
       style   != null ? JSON.stringify(style)   : null,
       sort_order, req.params.slideId, req.params.clientId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/slides/:clientId/:slideId
router.delete('/:clientId/:slideId', async (req, res) => {
  try {
    await query('DELETE FROM slides WHERE id = $1 AND client_id = $2', [req.params.slideId, req.params.clientId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/slides/:clientId/bulk — replace all slides for a client (used after generation)
router.put('/:clientId/bulk', async (req, res) => {
  const { slides } = req.body // { [deptId]: [...slides] }
  if (!slides) return res.status(400).json({ error: 'slides required' })
  try {
    await query('DELETE FROM slides WHERE client_id = $1', [req.params.clientId])
    const allSlides = Object.entries(slides).flatMap(([deptId, deptSlides]) =>
      deptSlides.map((s, i) => ({ ...s, dept_id: deptId, sort_order: i }))
    )
    for (const s of allSlides) {
      await query(
        `INSERT INTO slides (id, client_id, dept_id, title, body, bullets, style, sort_order, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET title=$4, body=$5, bullets=$6, style=$7, sort_order=$8, updated_at=NOW()`,
        [s.id ?? (s._id?.match(/^[0-9a-f-]{36}$/) ? s._id : randomUUID()), req.params.clientId, s.dept_id, s.title ?? '', s.body ?? '',
         JSON.stringify(s.bullets ?? []), JSON.stringify(s.style ?? {}),
         s.sort_order, req.user.id]
      )
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
