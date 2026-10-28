import { Router } from 'express'
import { randomUUID } from 'crypto'
import { pool, query } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

// Slides deleted from Submit Slides are kept here for 5 days, so an admin can
// restore them (Admin Dashboard → Deleted Slides). Older ones are removed.
export const KEEP_DAYS = 5

const router = Router()

export async function purgeExpiredDeletedSlides() {
  try {
    await query(`DELETE FROM deleted_slides WHERE deleted_at < NOW() - INTERVAL '${KEEP_DAYS} days'`)
  } catch (err) {
    console.error('Purging deleted slides failed:', err.message)
  }
}

// POST /api/deleted-slides/:clientId { deptId, slide } — record a deletion
router.post('/:clientId', requireAuth, async (req, res) => {
  const { deptId, slide } = req.body ?? {}
  if (!deptId || typeof deptId !== 'string' || !slide || typeof slide !== 'object') {
    return res.status(400).json({ error: 'deptId and slide required' })
  }
  try {
    const id = randomUUID()
    await query(
      'INSERT INTO deleted_slides (id, client_id, dept_id, slide, deleted_by) VALUES ($1, $2, $3, $4, $5)',
      [id, req.params.clientId, deptId.slice(0, 60), JSON.stringify(slide), req.user.id]
    )
    res.json({ id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/deleted-slides — admins: everything still restorable, newest first
router.get('/', requireAdmin, async (req, res) => {
  try {
    await purgeExpiredDeletedSlides()
    const { rows } = await query(`
      SELECT d.id, d.client_id, d.dept_id, d.slide, d.deleted_at,
             d.deleted_at + INTERVAL '${KEEP_DAYS} days' AS expires_at,
             c.name AS client_name, u.name AS deleted_by_name, u.email AS deleted_by_email
      FROM deleted_slides d
      LEFT JOIN clients c ON c.id::text = d.client_id
      LEFT JOIN users   u ON u.id = d.deleted_by
      ORDER BY d.deleted_at DESC
    `)
    res.json({ keepDays: KEEP_DAYS, slides: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/deleted-slides/:id/restore — admins: put the slide back at the
// end of its department and take it out of the deleted list
router.post('/:id/restore', requireAdmin, async (req, res) => {
  const db = await pool.connect()
  const q = (text, params) => db.query(text, params)
  try {
    await q('BEGIN')
    const { rows } = await q('SELECT * FROM deleted_slides WHERE id = $1 FOR UPDATE', [req.params.id])
    const row = rows[0]
    if (!row) { await q('ROLLBACK'); return res.status(404).json({ error: 'This slide is no longer in the deleted list.' }) }
    const client = await q('SELECT id FROM clients WHERE id::text = $1', [row.client_id])
    if (!client.rows.length) { await q('ROLLBACK'); return res.status(410).json({ error: 'The client this slide belonged to no longer exists.' }) }

    // Same lock as the bulk slide save, so the two never interleave
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`slides:${row.client_id}`])
    const s = row.slide ?? {}
    const wanted = [s.id, s._id].find(v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
    const taken = wanted ? (await q('SELECT 1 FROM slides WHERE id = $1', [wanted])).rows.length > 0 : true
    const id = taken ? randomUUID() : wanted
    const order = (await q('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM slides WHERE client_id = $1 AND dept_id = $2', [row.client_id, row.dept_id])).rows[0].n
    await q(
      `INSERT INTO slides (id, client_id, dept_id, title, body, bullets, style, sort_order, "table", source, notes, extra_bullet_boxes, free_text_boxes, created_by, division_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id, row.client_id, row.dept_id,
        s.title ?? '', s.body ?? '',
        JSON.stringify(s.bullets ?? []),
        JSON.stringify(s.style ?? {}),
        order,
        s.table != null ? JSON.stringify(s.table) : null,
        s.source ?? '', s.notes ?? '',
        s.extraBulletBoxes != null ? JSON.stringify(s.extraBulletBoxes) : null,
        s.freeTextBoxes != null ? JSON.stringify(s.freeTextBoxes) : null,
        row.deleted_by,
        s.divisionId ? String(s.divisionId).slice(0, 40) : null,
      ]
    )
    await q('DELETE FROM deleted_slides WHERE id = $1', [row.id])
    await q('COMMIT')
    res.json({ ok: true, clientId: row.client_id, deptId: row.dept_id, slideId: id })
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {})
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  } finally {
    db.release()
  }
})

// DELETE /api/deleted-slides/:id — admins: delete permanently now
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM deleted_slides WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
