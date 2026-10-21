import React, { useState, useEffect, useMemo, useRef } from 'react'
import { TemplateSlide } from './OriginalSlidePreview.jsx'
import FrameEditor from './FrameEditor.jsx'
import { ImageToolbar } from './SlideEditor.jsx'
import { loadOriginalPackage, elementsOf, applyEditsToItems, canEditOriginal, paraText, effectiveEdits } from '../lib/originalSlides.js'
import { rebuildOriginalPreview } from '../lib/importPptx.js'
import { fullRect, readPictureFile, coverCrop } from '../lib/imageFrame.js'

// Editor for slides imported with "Keep original styling". Every element on
// the slide can be moved, resized or deleted; text and table cells can be
// changed; pictures can be cropped and get rounded corners. Everything else
// about the slide's look stays exactly as in the original file — edits are
// saved separately (style.original.edits) and applied on export.

const TYPE_LABEL = { shape: 'Text / shape', image: 'Picture', table: 'Table', chart: 'Chart', line: 'Line', group: 'Group' }

const cropObj = c => (Array.isArray(c) ? { l: c[0], t: c[1], r: c[2], b: c[3] } : c ?? { l: 0, t: 0, r: 0, b: 0 })
const cropArr = c => [c.l, c.t, c.r, c.b]

export default function OriginalSlideEditor({ slide, clientId, onSave, onClose }) {
  const original = slide.style.original
  const [preview, setPreview] = useState(canEditOriginal(slide) ? original.preview : null)
  const [error,   setError]   = useState('')
  const [edits,   setEdits]   = useState(() => JSON.parse(JSON.stringify(original.edits ?? {})))
  const [sel,     setSel]     = useState(null)   // element key
  const [crop,    setCrop]    = useState(false)
  const [headerTitle, setHeaderTitle] = useState(original.headerTitle ?? '') // title in the template's title area
  const areaRef = useRef(null)
  const replaceRef = useRef(null)

  // Slides imported by an older version get their preview rebuilt from the stored original
  useEffect(() => {
    if (preview) return
    let cancelled = false
    loadOriginalPackage(clientId, original.ref)
      .then(pkg => {
        if (!pkg) throw new Error('The original PowerPoint for this slide could not be found.')
        return rebuildOriginalPreview(pkg, original.slidePath)
      })
      .then(p => { if (!cancelled) setPreview(p) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [preview, clientId, original.ref, original.slidePath])

  const elements = useMemo(() => (preview ? elementsOf(preview) : []), [preview])
  // What's shown: automatic header removal plus the user's edits
  const eff      = useMemo(() => (preview ? effectiveEdits(preview, edits) : edits), [preview, edits])
  const items    = useMemo(() => (preview ? applyEditsToItems(preview.items, eff) : []), [preview, eff])
  const current  = key => items.filter(i => i.key === key)
  const selected = elements.find(e => e.key === sel) ?? null
  const deleted  = elements.filter(e => eff[e.key]?.deleted)

  const patch = (key, p) => setEdits(prev => ({ ...prev, [key]: { ...prev[key], ...p } }))
  const boxOf = el => edits[el.key]?.box ?? el.from

  function select(key) { setSel(key); setCrop(false) }
  function remove(key) { patch(key, { deleted: true }); setSel(null); setCrop(false) }
  function undoElement(key) { setEdits(prev => { const n = { ...prev }; delete n[key]; return n }) }

  // Keyboard: Delete removes, arrows nudge (Shift = bigger steps), Esc deselects
  useEffect(() => {
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if (typing || !selected) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selected.key) }
      else if (e.key === 'Escape' && !crop) setSel(null)
      else if (e.key.startsWith('Arrow') && !crop) {
        e.preventDefault()
        const step = e.shiftKey ? 0.02 : 0.004
        const b = boxOf(selected)
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
        patch(selected.key, { from: selected.from, box: { ...b, x: b.x + d[0], y: b.y + d[1] } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function save() {
    // Keep only edits that change something
    const clean = {}
    for (const [k, v] of Object.entries(edits)) if (v && Object.keys(v).some(f => f !== 'from')) clean[k] = v
    const title = headerTitle.trim()
    onSave({
      ...slide,
      ...(title ? { title } : {}),
      style: { ...slide.style, original: { ...original, preview, edits: clean, headerTitle: title } },
    })
  }

  // Swaps the selected picture for another file, keeping its place and size
  async function replacePicture(file) {
    if (!file || !selected) return
    try {
      const pic = await readPictureFile(file)
      const b = boxOf(selected)
      const frameAspect = (b.w * preview.slideW) / (b.h * preview.slideH)
      patch(selected.key, { from: selected.from, box: b, src: pic.src, crop: cropArr(coverCrop(pic.w, pic.h, frameAspect)) })
      setCrop(false)
    } catch (err) { alert(err.message) }
  }

  const selItems = selected ? current(selected.key) : []
  const selItem  = selItems[0] ?? null
  const isImage  = selected?.type === 'image'
  const imgFrame = isImage && selItem ? { src: selItem.src, x: selItem.x, y: selItem.y, w: selItem.w, h: selItem.h, crop: cropObj(selItem.crop), radius: selItem.radius ?? 0 } : null

  return (
    <div style={S.overlay}>
      <div style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title}>Edit slide · {slide.title || 'Untitled'}</div>
          <div style={S.sub}>Original styling is kept — click an element to move, resize, edit or delete it.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {Object.keys(edits).length > 0 && <button style={S.ghost} onClick={() => { setEdits({}); setSel(null) }} title="Undo every change to this slide">Reset slide</button>}
          <button style={S.ghost} onClick={onClose}>Cancel</button>
          <button style={S.primary} onClick={save} disabled={!preview}>Save</button>
        </div>
      </div>

      <div style={S.body}>
        <div style={S.stage} onPointerDown={() => { setSel(null); setCrop(false) }}>
          {error ? <div style={S.msg}>{error}</div> : !preview ? <div style={S.msg}>Loading slide…</div> : (
            <div style={S.canvas}>
              <TemplateSlide p={preview} edits={edits} clip={false} title={headerTitle}>
                <div ref={areaRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {elements.filter(el => !eff[el.key]?.deleted).map(el => {
                    const isSel = sel === el.key
                    const img = el.type === 'image' ? current(el.key)[0] : null
                    return (
                      <FrameEditor
                        key={el.key}
                        frame={boxOf(el)}
                        areaRef={areaRef}
                        selected={isSel}
                        onSelect={() => select(el.key)}
                        image={img ? { src: img.src, crop: cropObj(img.crop) } : null}
                        keepAspect={el.type === 'image' || el.type === 'chart'}
                        cropMode={isSel && crop}
                        onCropModeChange={setCrop}
                        onChange={next => patch(el.key, {
                          from: el.from,
                          box: { x: next.x, y: next.y, w: next.w, h: next.h },
                          ...(next.crop && el.type === 'image' ? { crop: cropArr(next.crop) } : {}),
                        })}
                        title={TYPE_LABEL[el.type] ?? 'Element'}
                      />
                    )
                  })}
                  {isImage && imgFrame && (
                    <ImageToolbar
                      img={imgFrame}
                      cropping={crop}
                      onCrop={() => setCrop(c => !c)}
                      onRadius={radius => patch(selected.key, { radius })}
                      onReset={() => {
                        const full = fullRect(imgFrame)
                        patch(selected.key, { from: selected.from, box: full, crop: [0, 0, 0, 0] })
                      }}
                      onDelete={() => remove(selected.key)}
                      onReplace={replacePicture}
                    />
                  )}
                </div>
              </TemplateSlide>
            </div>
          )}
        </div>

        <aside style={S.panel}>
          <div style={S.titleBox}>
            <label style={S.label} htmlFor="orig-slide-title">Slide title</label>
            <input
              id="orig-slide-title"
              style={S.titleInput}
              value={headerTitle}
              onChange={e => setHeaderTitle(e.target.value)}
              placeholder={slide.title ? `e.g. ${slide.title}` : 'Add a slide title'}
              maxLength={120}
            />
            <div style={S.titleHint}>
              <span style={S.swatch} /> Shown next to the Spark Studio logo in the brand red, like slides made in the platform. Leave empty for no title.
            </div>
            {!headerTitle && slide.title && (
              <button style={{ ...S.ghostSm, marginTop: 6 }} onClick={() => setHeaderTitle(slide.title)}>Use “{slide.title.length > 40 ? `${slide.title.slice(0, 40)}…` : slide.title}”</button>
            )}
          </div>

          {!selected ? (
            <>
              <div style={S.panelTitle}>Editing</div>
              <p style={S.help}>
                Click anything on the slide to select it.<br />
                • Drag to move; drag the handles to resize (corners keep pictures in proportion, <b>Shift</b> to stretch).<br />
                • Double-click a picture to crop it: drag the picture inside the frame, trim with the black handles, <b>Enter</b> when done.<br />
                • <b>Delete</b> removes the selected element; arrow keys nudge it.<br />
                • Text and table wording is edited here on the right once selected.
              </p>
            </>
          ) : (
            <>
              <div style={S.panelTitle}>{TYPE_LABEL[selected.type] ?? 'Element'}</div>

              {selected.type === 'shape' && selItem?.text && (
                <label style={S.field}>
                  <span style={S.label}>Text <span style={S.hint}>(one line per paragraph — formatting is kept)</span></span>
                  <textarea
                    style={S.textarea}
                    value={(edits[selected.key]?.paras ?? selItem.text.paras.map(paraText)).join('\n')}
                    onChange={e => patch(selected.key, { paras: e.target.value.split('\n') })}
                    rows={Math.min(14, Math.max(3, selItem.text.paras.length + 1))}
                  />
                </label>
              )}

              {selected.type === 'table' && selItem?.table && (
                <div style={S.field}>
                  <span style={S.label}>Table text</span>
                  <div style={{ overflow: 'auto', maxHeight: 320 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {selItem.table.rows.map((row, r) => (
                          <tr key={r}>
                            {row.cells.map((cell, c) => cell.skip ? null : (
                              <td key={c} style={{ padding: 2 }}>
                                <input
                                  style={S.cell}
                                  value={edits[selected.key]?.cells?.[r]?.[c] ?? (cell.text?.paras ?? []).map(paraText).join('\n')}
                                  onChange={e => {
                                    const cells = (edits[selected.key]?.cells ?? []).map(x => [...(x ?? [])])
                                    while (cells.length <= r) cells.push([])
                                    cells[r][c] = e.target.value
                                    patch(selected.key, { cells })
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isImage && (
                <div style={S.field}>
                  <span style={S.label}>Picture</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={crop ? S.primarySm : S.ghostSm} onClick={() => setCrop(c => !c)}>{crop ? '✓ Done cropping' : '✂ Crop'}</button>
                    <button style={S.ghostSm} onClick={() => {
                      const full = fullRect(imgFrame)
                      patch(selected.key, { from: selected.from, box: full, crop: [0, 0, 0, 0] })
                    }}>Reset crop</button>
                    <button style={S.ghostSm} onClick={() => replaceRef.current?.click()} title="Use a different picture file in the same place and size">⇄ Replace picture</button>
                    <input ref={replaceRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; replacePicture(f) }} />
                  </div>
                  <label style={{ ...S.label, marginTop: 10 }}>Rounded corners · {Math.round((imgFrame?.radius ?? 0) * 100)}%</label>
                  <input type="range" min={0} max={50} value={Math.round((imgFrame?.radius ?? 0) * 100)}
                    onChange={e => patch(selected.key, { radius: +e.target.value / 100 })} style={{ width: '100%' }} />
                </div>
              )}

              {selected.type === 'chart' && <p style={S.help}>Charts can be moved, resized or deleted. Their data stays as in the original file.</p>}
              {selected.type === 'group' && <p style={S.help}>This is a group of elements — it moves and resizes as one.</p>}

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {edits[selected.key] && <button style={S.ghostSm} onClick={() => undoElement(selected.key)}>Undo changes</button>}
                <button style={{ ...S.ghostSm, color: '#dc2626', borderColor: '#dc262655' }} onClick={() => remove(selected.key)}>Delete</button>
              </div>
            </>
          )}

          {deleted.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: '0.5px solid var(--color-border)' }}>
              <span style={S.label}>{deleted.length} deleted element{deleted.length === 1 ? '' : 's'}</span>
              {deleted.some(e => eff[e.key]?.auto) && (
                <p style={{ ...S.help, fontSize: 11, marginTop: 4 }}>Includes header text that sat on the original slide's own banner — it's left out because the template has its own header.</p>
              )}
              <button style={{ ...S.ghostSm, marginTop: 6 }} onClick={() => setEdits(prev => {
                const n = { ...prev }
                for (const el of deleted) {
                  const { deleted: _d, auto: _a, ...rest } = prev[el.key] ?? {}
                  n[el.key] = { ...rest, deleted: false }
                }
                return n
              })}>Restore all</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

const S = {
  overlay:   { position: 'fixed', inset: 0, zIndex: 1050, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' },
  header:    { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)' },
  title:     { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub:       { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  body:      { flex: 1, minHeight: 0, display: 'flex' },
  stage:     { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#e5e7eb', overflow: 'auto' },
  canvas:    { width: 'min(100%, calc((100vh - 140px) * 16 / 9))', boxShadow: '0 6px 30px rgba(0,0,0,0.25)', position: 'relative' },
  msg:       { fontSize: 14, color: 'var(--color-text-muted)' },
  panel:     { width: 320, flexShrink: 0, borderLeft: '0.5px solid var(--color-border)', padding: 16, overflowY: 'auto', background: 'var(--color-bg)' },
  titleBox:  { paddingBottom: 14, marginBottom: 14, borderBottom: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 },
  titleInput:{ width: '100%', boxSizing: 'border-box', fontSize: 14, fontWeight: 700, padding: '8px 10px', border: '0.5px solid var(--color-border)', borderRadius: 6, color: '#CD2F37', fontFamily: 'Arial, sans-serif', background: 'var(--color-bg)' },
  titleHint: { fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-muted)' },
  swatch:    { display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#CD2F37', verticalAlign: 'middle', marginRight: 2 },
  panelTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' },
  help:      { fontSize: 12, lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: 0 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  label:     { fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' },
  hint:      { fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--color-text-muted)' },
  textarea:  { width: '100%', boxSizing: 'border-box', fontSize: 13, lineHeight: 1.5, padding: 8, border: '0.5px solid var(--color-border)', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', background: 'var(--color-bg)', color: 'var(--color-text-primary)' },
  cell:      { width: '100%', minWidth: 60, boxSizing: 'border-box', fontSize: 12, padding: '4px 6px', border: '0.5px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', color: 'var(--color-text-primary)' },
  ghost:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  primary:   { background: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  ghostSm:   { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  primarySm: { background: '#2563eb', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#fff' },
}
