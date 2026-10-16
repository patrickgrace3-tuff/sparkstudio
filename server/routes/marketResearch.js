import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const router = Router()

const num = v => (Number.isFinite(+v) ? +v : 0)
const box = b => (b && typeof b === 'object' ? { x: num(b.x), y: num(b.y), w: num(b.w), h: num(b.h) } : null)

// Editor style fields are kept as-is (admin-only input); boxes and images are validated
function sanitizeStyle(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return {}
  const out = { ...st }
  if (st.bodyBox)  out.bodyBox  = box(st.bodyBox)
  if (st.tableBox) out.tableBox = box(st.tableBox)
  if (Array.isArray(st.images)) {
    out.images = st.images
      .filter(img => typeof img?.src === 'string' && img.src.startsWith('data:image/'))
      .map(img => ({ ...img, src: img.src, ...box(img), mode: img.mode === 'crop' ? 'crop' : 'scale' }))
  }
  return out
}

// Keep stored slides to the fields the editor/export understand
function sanitizeSlide(s) {
  const bullets = Array.isArray(s?.bullets) ? s.bullets.map(String) : []
  const table = s?.table && Array.isArray(s.table.headers) && Array.isArray(s.table.rows)
    ? { headers: s.table.headers.map(String), rows: s.table.rows.map(r => (Array.isArray(r) ? r.map(String) : [])) }
    : null
  return {
    title:   String(s?.title ?? '').slice(0, 500),
    bullets,
    body:    bullets.join('\n'),
    table,
    notes:   String(s?.notes ?? ''),
    source:  String(s?.source ?? ''),
    freeTextBoxes: Array.isArray(s?.freeTextBoxes)
      ? s.freeTextBoxes.map(ft => ({
          text: String(ft?.text ?? ''),
          box: box(ft?.box) ?? { x: 0.045, y: 0.55, w: 0.829, h: 0.25 },
          fontSize: num(ft?.fontSize) || 14,
          textAlign: ['left', 'center', 'right'].includes(ft?.textAlign) ? ft.textAlign : 'left',
        }))
      : null,
    extraBulletBoxes: Array.isArray(s?.extraBulletBoxes)
      ? s.extraBulletBoxes.map(eb => ({
          ...eb,
          bullets: Array.isArray(eb?.bullets) ? eb.bullets.map(String) : [],
          box: box(eb?.box) ?? { x: 0.5, y: 0.19, w: 0.4, h: 0.63 },
        }))
      : null,
    style:   sanitizeStyle(s?.style),
  }
}

// GET /api/market-research — list decks (newest first, without slide content)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT m.id, m.name, m.file_name, m.slide_count, m.created_at, u.name AS uploaded_by_name
      FROM market_research_decks m
      LEFT JOIN users u ON u.id = m.uploaded_by
      ORDER BY m.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/market-research/:id — full deck including slide content
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM market_research_decks WHERE id = $1', [req.params.id])
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/market-research — admin stores a newly imported deck
router.post('/', requireAdmin, async (req, res) => {
  const { name, fileName, slides } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  if (!Array.isArray(slides) || !slides.length) return res.status(400).json({ error: 'slides required' })
  const clean = slides.map(sanitizeSlide)
  try {
    const result = await query(
      `INSERT INTO market_research_decks (name, file_name, slides, slide_count, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, file_name, slide_count, created_at`,
      [name.trim(), fileName ?? '', JSON.stringify(clean), clean.length, req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/market-research/:id — admin edits a stored deck (name and/or slides)
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, slides } = req.body
  if (name != null && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' })
  if (slides != null && (!Array.isArray(slides) || !slides.length)) return res.status(400).json({ error: 'slides must be a non-empty array' })
  const clean = slides ? slides.map(sanitizeSlide) : null
  try {
    const result = await query(
      `UPDATE market_research_decks SET
         name        = COALESCE($1, name),
         slides      = COALESCE($2::jsonb, slides),
         slide_count = COALESCE($3, slide_count)
       WHERE id = $4
       RETURNING id, name, file_name, slide_count, created_at`,
      [name != null ? String(name).trim() : null, clean ? JSON.stringify(clean) : null, clean ? clean.length : null, req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/market-research/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM market_research_decks WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
