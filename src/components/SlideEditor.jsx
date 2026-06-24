import React, { useState, useRef } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'

const FONTS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Palatino', value: "'Palatino Linotype', serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

const LAYOUTS = [
  { id: 'title-left',   label: 'Title Left',    icon: '▤' },
  { id: 'title-top',    label: 'Title Top',      icon: '▥' },
  { id: 'split',        label: 'Two Column',     icon: '▦' },
  { id: 'centered',     label: 'Centered',       icon: '▣' },
  { id: 'image-right',  label: 'Image Right',    icon: '◧' },
  { id: 'full-image',   label: 'Full Background',icon: '█' },
]

const BG_PRESETS = [
  { label: 'White',       bg: '#FFFFFF', text: '#1a1a1a', accent: '#CD2F37' },
  { label: 'Dark',        bg: '#1E2761', text: '#FFFFFF', accent: '#CADCFC' },
  { label: 'Spark Red',   bg: '#CD2F37', text: '#FFFFFF', accent: '#FFFFFF' },
  { label: 'Charcoal',    bg: '#36454F', text: '#F2F2F2', accent: '#ef4444' },
  { label: 'Slate',       bg: '#2C3E50', text: '#ECF0F1', accent: '#3498db' },
  { label: 'Forest',      bg: '#2C5F2D', text: '#F5F5F5', accent: '#97BC62' },
  { label: 'Custom',      bg: null,      text: null,      accent: null },
]

// ── Live slide preview canvas ─────────────────────────────────────────────────
function SlideCanvas({ slide, bgImage, table }) {
  const { title, bullets, style = {} } = slide
  const font    = style.font    ?? FONTS[0].value
  const layout  = style.layout  ?? 'title-top'
  const bg      = style.bg      ?? '#FFFFFF'
  const textCol = style.textCol ?? '#1a1a1a'
  const accent  = style.accent  ?? '#CD2F37'
  const contentImage = style.contentImage ?? null

  const canvasStyle = {
    width: '100%',
    aspectRatio: '16/9',
    background: bgImage
      ? `url(${bgImage}) center/cover no-repeat`
      : bg,
    fontFamily: font,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 6,
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: layout === 'title-left' ? 'row' : 'column',
  }

  const titleStyle = {
    color: accent,
    fontWeight: 700,
    lineHeight: 1.2,
    fontSize: layout === 'centered' ? '2.2em' : '1.7em',
    textAlign: layout === 'centered' ? 'center' : 'left',
    textShadow: bgImage ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
  }

  const bulletStyle = {
    color: textCol,
    fontSize: '0.85em',
    lineHeight: 1.6,
    textShadow: bgImage ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
  }

  const accentBar = (
    <div style={{ height: 3, background: accent, borderRadius: 2, margin: '8px 0 12px' }} />
  )

  if (layout === 'title-left') {
    return (
      <div style={canvasStyle}>
        <div style={{ width: '38%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5%' }}>
          <div style={{ ...titleStyle, color: '#fff', fontSize: '1.5em', textAlign: 'center' }}>{title}</div>
        </div>
        <div style={{ flex: 1, padding: '5%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 8, marginBottom: '0.5em' }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>—</span>{b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (layout === 'split') {
    const half = Math.ceil((bullets || []).length / 2)
    return (
      <div style={{ ...canvasStyle, flexDirection: 'column', padding: '5%' }}>
        <div style={titleStyle}>{title}</div>
        {accentBar}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 5%', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).slice(0, half).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span>{b}
              </li>
            ))}
          </ul>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).slice(half).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span>{b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (layout === 'centered') {
    return (
      <div style={{ ...canvasStyle, alignItems: 'center', justifyContent: 'center', padding: '8%', flexDirection: 'column' }}>
        <div style={titleStyle}>{title}</div>
        <div style={{ width: '30%', height: 3, background: accent, borderRadius: 2, margin: '12px auto 16px' }} />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'center' }}>
          {(bullets || []).map((b, i) => (
            <li key={i} style={{ ...bulletStyle, marginBottom: '0.5em' }}>{b}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (layout === 'image-right') {
    return (
      <div style={{ ...canvasStyle, flexDirection: 'row' }}>
        <div style={{ flex: 1, padding: '5%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={titleStyle}>{title}</div>
          {accentBar}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 6, marginBottom: '0.4em' }}>
                <span style={{ color: accent }}>•</span>{b}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ width: '40%', background: contentImage ? `url(${contentImage}) center/cover` : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.75em' }}>
          {!contentImage && 'Upload image →'}
        </div>
      </div>
    )
  }

  if (layout === 'full-image') {
    return (
      <div style={{ ...canvasStyle, alignItems: 'center', justifyContent: 'center', padding: '8%', flexDirection: 'column' }}>
        {bgImage && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
          <div style={{ ...titleStyle, color: '#fff', fontSize: '2em' }}>{title}</div>
          <div style={{ width: '25%', height: 3, background: accent, borderRadius: 2, margin: '10px auto 14px' }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(bullets || []).map((b, i) => (
              <li key={i} style={{ ...bulletStyle, color: 'rgba(255,255,255,0.92)', marginBottom: '0.4em' }}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // Table preview component
  const TablePreview = ({ tbl }) => tbl ? (
    <div style={{ marginTop: '3%', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.55em' }}>
        <thead>
          <tr>{tbl.headers.map((h, i) => <th key={i} style={{ background: accent, color: '#fff', padding: '3px 6px', border: '0.5px solid rgba(255,255,255,0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {tbl.rows.slice(0, 6).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'transparent' }}>
              {tbl.headers.map((_, ci) => <td key={ci} style={{ color: textCol, padding: '2px 6px', border: '0.5px solid rgba(128,128,128,0.2)', whiteSpace: 'nowrap' }}>{row[ci] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {tbl.rows.length > 6 && <p style={{ fontSize: '0.5em', color: textCol, opacity: 0.6, margin: '2px 0 0' }}>+{tbl.rows.length - 6} more rows</p>}
    </div>
  ) : null

  // Default: title-top
  return (
    <div style={{ ...canvasStyle, padding: '5%', flexDirection: 'column' }}>
      <div style={titleStyle}>{title}</div>
      {accentBar}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {(bullets || []).map((b, i) => (
          <li key={i} style={{ ...bulletStyle, display: 'flex', gap: 8, marginBottom: '0.5em' }}>
            <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>—</span>{b}
          </li>
        ))}
      </ul>
      <TablePreview tbl={table} />
    </div>
  )
}

// ── Main editor modal ─────────────────────────────────────────────────────────
export default function SlideEditor({ slide, onSave, onClose }) {
  const [draft,    setDraft]    = useState({
    title:   slide.title   ?? '',
    body:    slide.body    ?? '',
    bullets: slide.bullets?.length
      ? [...slide.bullets]
      : (slide.body ?? '').split('\n').filter(Boolean),
    style: {
      font:    slide.style?.font    ?? FONTS[0].value,
      layout:  slide.style?.layout  ?? 'title-top',
      bg:      slide.style?.bg      ?? '#FFFFFF',
      textCol: slide.style?.textCol ?? '#1a1a1a',
      accent:  slide.style?.accent  ?? '#CD2F37',
      contentImage: slide.style?.contentImage ?? null,
    },
  })
  const [bgImage,     setBgImage]     = useState(slide.style?.bgImage ?? null)
  const [activePanel, setActivePanel] = useState('content') // content | layout | style
  // Table state — separate from draft so edits are granular
  const [table, setTable] = useState(
    slide.table
      ? { headers: [...slide.table.headers], rows: slide.table.rows.map(r => [...r]) }
      : null
  )
  const bgInputRef      = useRef(null)
  const contentImgRef   = useRef(null)

  function update(key, val) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function updateStyle(key, val) {
    setDraft(d => ({ ...d, style: { ...d.style, [key]: val } }))
  }

  function updateBullet(i, val) {
    const b = [...draft.bullets]; b[i] = val; update('bullets', b)
  }

  function addBullet() {
    update('bullets', [...draft.bullets, ''])
  }

  function removeBullet(i) {
    update('bullets', draft.bullets.filter((_, idx) => idx !== i))
  }

  function moveBullet(i, dir) {
    const b = [...draft.bullets]
    const j = i + dir
    if (j < 0 || j >= b.length) return
    ;[b[i], b[j]] = [b[j], b[i]]
    update('bullets', b)
  }

  // ── Table helpers ──────────────────────────────────────────────────────────
  function addTableRow() {
    if (!table) return
    const emptyRow = Array(table.headers.length).fill('')
    setTable(t => ({ ...t, rows: [...t.rows, emptyRow] }))
  }

  function removeTableRow(ri) {
    setTable(t => ({ ...t, rows: t.rows.filter((_, i) => i !== ri) }))
  }

  function addTableCol() {
    setTable(t => ({
      headers: [...t.headers, `Column ${t.headers.length + 1}`],
      rows:    t.rows.map(r => [...r, '']),
    }))
  }

  function removeTableCol(ci) {
    setTable(t => ({
      headers: t.headers.filter((_, i) => i !== ci),
      rows:    t.rows.map(r => r.filter((_, i) => i !== ci)),
    }))
  }

  function setTableHeader(ci, val) {
    setTable(t => { const h = [...t.headers]; h[ci] = val; return { ...t, headers: h } })
  }

  function setTableCell(ri, ci, val) {
    setTable(t => ({ ...t, rows: t.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r) }))
  }

  function initTable() {
    setTable({ headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', ''], ['', '', '']] })
  }

  function applyPreset(preset) {
    if (!preset.bg) return
    updateStyle('bg', preset.bg)
    updateStyle('textCol', preset.text)
    updateStyle('accent', preset.accent)
  }

  function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setBgImage(ev.target.result)
      updateStyle('bgImage', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function handleContentImgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updateStyle('contentImage', ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    const saved = {
      ...slide,
      title:   draft.title,
      bullets: draft.bullets.filter(Boolean),
      body:    draft.bullets.filter(Boolean).join('\n'),
      style:   draft.style,
      table:   table && table.headers.length > 0 ? table : null,
    }
    onSave(saved)
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>Edit Slide</span>
          <div style={styles.headerBtns}>
            <button style={styles.btnSave} onClick={handleSave}>Save changes</button>
            <button style={styles.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={styles.body}>

          {/* Left — controls */}
          <div style={styles.controls}>
            {/* Panel tabs */}
            <div style={styles.panelTabs}>
              {['content', 'layout', 'style'].map(p => (
                <button
                  key={p}
                  style={{ ...styles.panelTab, ...(activePanel === p ? styles.panelTabActive : {}) }}
                  onClick={() => setActivePanel(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Content panel */}
            {activePanel === 'content' && (
              <div style={styles.panel}>
                <label style={styles.label}>Slide title</label>
                <input
                  style={styles.input}
                  value={draft.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="Enter slide title"
                />

                <label style={styles.label}>Bullet points</label>
                <div style={styles.bulletList}>
                  {draft.bullets.map((b, i) => (
                    <div key={i} style={styles.bulletRow}>
                      <div style={styles.bulletDragBtns}>
                        <button style={styles.microBtn} onClick={() => moveBullet(i, -1)} disabled={i === 0}>↑</button>
                        <button style={styles.microBtn} onClick={() => moveBullet(i, 1)} disabled={i === draft.bullets.length - 1}>↓</button>
                      </div>
                      <input
                        style={styles.bulletInput}
                        value={b}
                        onChange={e => updateBullet(i, e.target.value)}
                        placeholder={`Bullet ${i + 1}`}
                      />
                      <button style={styles.microBtn} onClick={() => removeBullet(i)}>✕</button>
                    </div>
                  ))}
                  <button style={styles.addBulletBtn} onClick={addBullet}>+ Add bullet</button>
                </div>

                {/* ── Table editor ── */}
                <div style={styles.tableSectionHeader}>
                  <label style={styles.label}>Data table</label>
                  {!table ? (
                    <button style={styles.microBtn} onClick={initTable}>+ Add table</button>
                  ) : (
                    <button style={{ ...styles.microBtn, color: '#ef4444', borderColor: '#ef444466' }}
                      onClick={() => setTable(null)}>Remove table</button>
                  )}
                </div>

                {table && (
                  <div style={styles.tableEditor}>
                    <div style={styles.tableScroll}>
                      <table style={styles.editorTable}>
                        <thead>
                          <tr>
                            <th style={styles.editorCorner} />
                            {table.headers.map((h, ci) => (
                              <th key={ci} style={styles.editorTh}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <input
                                    style={styles.editorHeaderInput}
                                    value={h}
                                    onChange={e => setTableHeader(ci, e.target.value)}
                                    placeholder={`Col ${ci + 1}`}
                                  />
                                  <button style={styles.microBtn} onClick={() => removeTableCol(ci)}>✕</button>
                                </div>
                              </th>
                            ))}
                            <th style={styles.editorCorner}>
                              <button style={styles.microBtn} onClick={addTableCol}>+ Col</button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, ri) => (
                            <tr key={ri}>
                              <td style={styles.editorRowNum}>{ri + 1}</td>
                              {row.map((cell, ci) => (
                                <td key={ci} style={styles.editorTd}>
                                  <input
                                    style={styles.editorCellInput}
                                    value={cell}
                                    onChange={e => setTableCell(ri, ci, e.target.value)}
                                  />
                                </td>
                              ))}
                              <td style={styles.editorTd}>
                                <button style={styles.microBtn} onClick={() => removeTableRow(ri)}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button style={styles.addBulletBtn} onClick={addTableRow}>+ Add row</button>
                  </div>
                )}
              </div>
            )}

            {/* Layout panel */}
            {activePanel === 'layout' && (
              <div style={styles.panel}>
                <label style={styles.label}>Layout</label>
                <div style={styles.layoutGrid}>
                  {LAYOUTS.map(l => (
                    <button
                      key={l.id}
                      style={{ ...styles.layoutBtn, ...(draft.style.layout === l.id ? styles.layoutBtnActive : {}) }}
                      onClick={() => updateStyle('layout', l.id)}
                    >
                      <span style={styles.layoutIcon}>{l.icon}</span>
                      <span style={styles.layoutLabel}>{l.label}</span>
                    </button>
                  ))}
                </div>

                <label style={styles.label}>Background image</label>
                <div style={styles.uploadRow}>
                  <button style={styles.uploadBtn} onClick={() => bgInputRef.current?.click()}>
                    {bgImage ? '↺ Replace image' : '↑ Upload image'}
                  </button>
                  {bgImage && (
                    <button style={styles.clearBtn} onClick={() => { setBgImage(null); updateStyle('bgImage', null) }}>
                      Remove
                    </button>
                  )}
                  <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
                </div>

                {(draft.style.layout === 'image-right') && (
                  <>
                    <label style={styles.label}>Content image (right panel)</label>
                    <div style={styles.uploadRow}>
                      <button style={styles.uploadBtn} onClick={() => contentImgRef.current?.click()}>
                        {draft.style.contentImage ? '↺ Replace' : '↑ Upload'}
                      </button>
                      {draft.style.contentImage && (
                        <button style={styles.clearBtn} onClick={() => updateStyle('contentImage', null)}>Remove</button>
                      )}
                      <input ref={contentImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleContentImgUpload} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Style panel */}
            {activePanel === 'style' && (
              <div style={styles.panel}>
                <label style={styles.label}>Color preset</label>
                <div style={styles.presetGrid}>
                  {BG_PRESETS.filter(p => p.bg).map(p => (
                    <button
                      key={p.label}
                      style={{ ...styles.presetBtn, background: p.bg, color: p.text, border: draft.style.bg === p.bg ? `2px solid ${p.accent}` : '0.5px solid rgba(0,0,0,0.15)' }}
                      onClick={() => applyPreset(p)}
                      title={p.label}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <label style={styles.label}>Custom background color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.bg} onChange={e => updateStyle('bg', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.bg}</span>
                </div>

                <label style={styles.label}>Text color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.textCol} onChange={e => updateStyle('textCol', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.textCol}</span>
                </div>

                <label style={styles.label}>Accent color</label>
                <div style={styles.colorRow}>
                  <input type="color" style={styles.colorPicker} value={draft.style.accent} onChange={e => updateStyle('accent', e.target.value)} />
                  <span style={styles.colorVal}>{draft.style.accent}</span>
                </div>

                <label style={styles.label}>Font</label>
                <select style={styles.select} value={draft.style.font} onChange={e => updateStyle('font', e.target.value)}>
                  {FONTS.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right — live preview */}
          <div style={styles.preview}>
            <div style={styles.previewLabel}>Live preview</div>
            <SlideCanvas slide={draft} bgImage={bgImage} table={table} />
            <div style={styles.previewHint}>
              {draft.bullets.length} bullet{draft.bullets.length !== 1 ? 's' : ''} · {draft.style.layout.replace('-', ' ')} layout
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:            { background: 'var(--color-bg)', borderRadius: 12, width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  header:           { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  headerTitle:      { fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' },
  headerBtns:       { display: 'flex', gap: 8, alignItems: 'center' },
  btnSave:          { background: 'var(--color-text-primary)', color: 'var(--color-bg)', border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnClose:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  body:             { display: 'flex', flex: 1, overflow: 'hidden' },
  controls:         { width: 300, flexShrink: 0, borderRight: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelTabs:        { display: 'flex', borderBottom: '0.5px solid var(--color-border)', padding: '0 12px' },
  panelTab:         { flex: 1, padding: '10px 4px', fontSize: 12, background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: -1 },
  panelTabActive:   { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-text-primary)', fontWeight: 600 },
  panel:            { flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  label:            { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:            { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none', width: '100%' },
  bulletList:       { display: 'flex', flexDirection: 'column', gap: 6 },
  bulletRow:        { display: 'flex', alignItems: 'center', gap: 5 },
  bulletDragBtns:   { display: 'flex', flexDirection: 'column', gap: 2 },
  bulletInput:      { flex: 1, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-primary)', outline: 'none' },
  microBtn:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  addBulletBtn:     { background: 'none', border: '0.5px dashed var(--color-border)', borderRadius: 6, padding: '6px', fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer', textAlign: 'center' },
  tableSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tableEditor:      { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  tableScroll:      { overflowX: 'auto', border: '0.5px solid var(--color-border)', borderRadius: 6 },
  editorTable:      { borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' },
  editorCorner:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '4px 6px', fontSize: 10, color: 'var(--color-text-muted)' },
  editorTh:         { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: 0, minWidth: 80 },
  editorHeaderInput:{ border: 'none', background: 'none', padding: '4px 6px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none', width: 70 },
  editorRowNum:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '2px 6px', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', width: 24 },
  editorTd:         { border: '0.5px solid var(--color-border)', padding: 0 },
  editorCellInput:  { border: 'none', background: 'none', padding: '4px 6px', fontSize: 11, color: 'var(--color-text-primary)', outline: 'none', width: '100%', minWidth: 70 },
  layoutGrid:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  layoutBtn:        { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '10px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  layoutBtnActive:  { border: '2px solid var(--color-text-primary)', background: 'var(--color-bg-tertiary)' },
  layoutIcon:       { fontSize: 20, lineHeight: 1 },
  layoutLabel:      { fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 500 },
  uploadRow:        { display: 'flex', gap: 8, alignItems: 'center' },
  uploadBtn:        { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)' },
  clearBtn:         { background: 'none', border: '0.5px solid #ef444466', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: '#ef4444' },
  presetGrid:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  presetBtn:        { borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer', fontWeight: 500, textAlign: 'center' },
  colorRow:         { display: 'flex', alignItems: 'center', gap: 10 },
  colorPicker:      { width: 36, height: 36, border: '0.5px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', padding: 2 },
  colorVal:         { fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' },
  select:           { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, color: 'var(--color-text-primary)', width: '100%', outline: 'none' },
  preview:          { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 12, background: 'var(--color-bg-secondary)', overflow: 'auto' },
  previewLabel:     { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  previewHint:      { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' },
}