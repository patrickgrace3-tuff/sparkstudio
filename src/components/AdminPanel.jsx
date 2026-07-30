import React, { useState, useEffect } from 'react'
import { DEPARTMENTS } from '../lib/constants.js'
import { createTemplate, createSlideShell } from '../lib/templates.js'
import { api } from '../lib/apiClient.js'

const LAYOUTS = [
  { id: 'title-top',   label: 'Title Top' },
  { id: 'title-left',  label: 'Title Left' },
  { id: 'split',       label: 'Two Column' },
  { id: 'centered',    label: 'Centered' },
  { id: 'image-right', label: 'Image Right' },
]

// ── Single slide shell editor row ────────────────────────────────────────────
function SlideShellRow({ shell, onChange, onRemove, index }) {
  return (
    <div style={S.shellRow}>
      <div style={S.shellTop}>
        <span style={S.shellIdx}>{index + 1}</span>
        <input
          style={S.shellInput}
          value={shell.title}
          onChange={e => onChange({ ...shell, title: e.target.value })}
          placeholder="Slide title"
        />
        <select
          style={S.shellSelect}
          value={shell.layout}
          onChange={e => onChange({ ...shell, layout: e.target.value })}
        >
          {LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button style={S.removeBtn} onClick={onRemove}>✕</button>
      </div>
      <div style={S.shellBottom}>
        <span style={S.shellIdx} />
        <textarea
          style={S.shellTextarea}
          value={shell.content || ''}
          onChange={e => onChange({ ...shell, content: e.target.value })}
          placeholder="Content for this slide — AI will use this along with company files to generate bullets"
          rows={2}
        />
      </div>
    </div>
  )
}

// ── Department section inside a template editor ───────────────────────────────
function DeptSection({ dept, shells, onChange }) {
  function addShell() {
    onChange([...shells, createSlideShell(`${dept.name} Overview`)])
  }

  function updateShell(i, next) {
    const updated = [...shells]
    updated[i] = next
    onChange(updated)
  }

  function removeShell(i) {
    onChange(shells.filter((_, idx) => idx !== i))
  }

  return (
    <div style={S.deptSection}>
      <div style={S.deptHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
          <span style={S.deptName}>{dept.name}</span>
          <span style={S.deptCount}>{shells.length} slide{shells.length !== 1 ? 's' : ''}</span>
        </div>
        <button style={S.addShellBtn} onClick={addShell}>+ Add slide</button>
      </div>
      {shells.length > 0 && (
        <div style={S.shellList}>
          {shells.map((shell, i) => (
            <SlideShellRow
              key={i}
              index={i}
              shell={shell}
              onChange={next => updateShell(i, next)}
              onRemove={() => removeShell(i)}
            />
          ))}
        </div>
      )}
      {shells.length === 0 && (
        <p style={S.emptyHint}>No slides — click "Add slide" to define template slides for this department.</p>
      )}
    </div>
  )
}

// ── Template editor (create or edit a single template) ────────────────────────
function TemplateEditor({ template, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(() => ({
    ...template,
    departments: { ...template.departments },
  }))

  function updateDept(deptName, shells) {
    setDraft(d => ({ ...d, departments: { ...d.departments, [deptName]: shells } }))
  }

  function handleSave() {
    if (!draft.name.trim()) return
    onSave(draft)
  }

  const totalSlides = Object.values(draft.departments).reduce((sum, s) => sum + s.length, 0)

  return (
    <div style={S.editorPanel}>
      <div style={S.editorHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            style={S.nameInput}
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Template name (e.g. Q4 Standard)"
          />
          <input
            style={S.descInput}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={S.totalCount}>{totalSlides} total slides</span>
          <button style={S.saveBtn} onClick={handleSave} disabled={!draft.name.trim() || saving}>{saving ? 'Saving…' : 'Save template'}</button>
          <button style={S.cancelBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>

      <div style={S.deptList}>
        {DEPARTMENTS.map(dept => (
          <DeptSection
            key={dept.id}
            dept={dept}
            shells={draft.departments[dept.name] || []}
            onChange={shells => updateDept(dept.name, shells)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Template list card ────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete, onDuplicate }) {
  const totalSlides = Object.values(template.departments).reduce((sum, s) => sum + s.length, 0)
  const deptCount   = Object.values(template.departments).filter(s => s.length > 0).length

  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <div>
          <div style={S.cardName}>{template.name}</div>
          {template.description && <div style={S.cardDesc}>{template.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.cardBtn} onClick={() => onDuplicate(template)}>Duplicate</button>
          <button style={S.cardBtn} onClick={() => onEdit(template)}>Edit</button>
          <button style={{ ...S.cardBtn, color: '#ef4444', borderColor: '#ef444444' }} onClick={() => onDelete(template.id)}>Delete</button>
        </div>
      </div>
      <div style={S.cardMeta}>
        <span>{totalSlides} slides across {deptCount} department{deptCount !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEPARTMENTS.filter(d => (template.departments[d.name] || []).length > 0).map(d => (
            <span key={d.id} style={{ ...S.deptPill, background: d.color + '22', color: d.color, border: `0.5px solid ${d.color}44` }}>
              {d.name} ({template.departments[d.name].length})
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Template Guide modal ──────────────────────────────────────────────────────
function TemplateGuideModal({ onClose: closeGuide }) {
  return (
    <div style={G.overlay} onClick={closeGuide}>
      <div style={G.modal} onClick={e => e.stopPropagation()}>
        <button style={G.closeBtn} onClick={closeGuide}>✕</button>
        <div style={G.body}>

          <div style={G.brandRule} />

          <div style={G.docHeader}>
            <div>
              <div style={G.eyebrow}>Spark Studio · Admin</div>
              <h2 style={G.docTitle}>Presentation Templates</h2>
              <p style={G.docSubtitle}>Build reusable slide structures that guide the AI when generating client decks — so every presentation starts from your playbook, not a blank page.</p>
            </div>
          </div>

          <div style={G.sectionLabel}>What is a Template?</div>
          <p style={G.introP}>A template is a pre-defined set of slides for each department. When a user applies a template to a client, those slide shells are automatically added to each department's section — giving the AI a clear starting point: what the slide should cover, how to frame it, and what to avoid.</p>
          <p style={{ ...G.introP, marginTop: 10 }}>Think of it as your agency's standard deck structure, baked in. Instead of every team starting from scratch, they start from your best practices.</p>

          <div style={G.divider} />

          <div style={G.sectionLabel}>How It Works</div>
          <div style={G.steps}>
            {[
              { n: 1, title: 'Create a template', desc: 'Click "+ New template" and give it a name (e.g. "Q3 Client Review" or "New Business Pitch"). Templates are reusable across any client.' },
              { n: 2, title: 'Add slides per department', desc: 'Each department gets its own section. Add one or more slide shells — each shell becomes a slide in that department\'s deck when the template is applied.' },
              { n: 3, title: 'Write slide instructions', desc: 'For each shell, give it a title and content notes. The AI uses these as its brief when generating bullets — the more specific, the better the output.' },
              { n: 4, title: 'Use guardrails to shape the AI', desc: '"Do This" tells the AI what to include or emphasize. "Don\'t Do This" tells it what to avoid. Both fields are injected directly into the AI prompt for that slide.' },
              { n: 5, title: 'Apply to a client', desc: 'On the main deck builder, select a template from the Template dropdown. The slide shells are seeded into each department instantly — users can then edit and build on top of them.' },
              { n: 6, title: 'Generate the deck', desc: 'When the team hits Generate Presentation, the AI uses each shell\'s title, instructions, and guardrails — alongside the department\'s uploaded files — to produce polished slides.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={G.step}>
                <div style={G.stepNum}>{n}</div>
                <div>
                  <div style={G.stepTitle}>{title}</div>
                  <div style={G.stepDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={G.divider} />

          <div style={G.sectionLabel}>Slide Instructions — Tips for Best Results</div>
          <div style={G.tipsGrid}>
            {[
              { label: 'Be specific about data', desc: 'Name the metrics you want surfaced — "include CTR, CPC, and conversion rate from the Looker report" gives the AI much better direction than "include performance data".' },
              { label: 'Set the right tone', desc: 'Tell the AI how to frame the content — "position results as progress toward Q3 targets" vs "show raw numbers only". Framing instructions go in the Do This field.' },
              { label: 'Use Don\'t Do This to block bad defaults', desc: 'If the AI tends to add filler bullets or vague summaries, block them: "Do NOT include generic statements like \'results were strong\'" — be specific about what to exclude.' },
              { label: 'One slide, one job', desc: 'Each shell works best when it has a single clear purpose. A "Performance Overview" slide and a "Campaign Breakdown" slide should be separate shells, not one big one.' },
              { label: 'Leave room for the AI', desc: 'Instructions are a brief, not a script. Give the AI enough direction to know what matters — then let it pull the specifics from the uploaded files.' },
              { label: 'Iterate on guardrails', desc: 'After your first generation, review what the AI produced. If a slide missed the mark, tighten the Do This or Don\'t Do This fields and regenerate — it learns from the constraints.' },
            ].map(({ label, desc }) => (
              <div key={label} style={G.tipCard}>
                <div style={G.tipLabel}>{label}</div>
                <div style={G.tipDesc}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={G.divider} />

          <div style={G.callout}>
            <p style={G.calloutP}><strong>Templates don't lock in content.</strong> They seed the deck — every generated slide can still be edited, rewritten, or deleted before export. Think of them as a structured first draft, not a fixed format.</p>
          </div>

          <div style={G.bottomRule} />
          <p style={G.footerNote}>Spark Studio by Conversionia · Admin Reference · Internal Use Only</p>

        </div>
      </div>
    </div>
  )
}

const RED = '#CD2F37'

const G = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:   { background: 'var(--color-bg)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' },
  closeBtn: { position: 'sticky', top: 16, float: 'right', marginRight: 20, marginTop: 16, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: '50%', width: 30, height: 30, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)', zIndex: 10 },
  body:     { padding: '28px 32px 36px', clear: 'both' },
  brandRule: { height: 3, background: RED, borderRadius: 1, marginBottom: 24 },
  docHeader: { marginBottom: 28 },
  eyebrow:   { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: RED, marginBottom: 5 },
  docTitle:  { fontSize: 24, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', margin: 0 },
  docSubtitle: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5, maxWidth: 560 },
  sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 },
  introP:    { fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-primary)' },
  divider:   { borderTop: '1px solid var(--color-border)', margin: '24px 0' },
  steps:     { display: 'flex', flexDirection: 'column', gap: 8 },
  step:      { display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, alignItems: 'start', background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '11px 14px' },
  stepNum:   { width: 24, height: 24, background: RED, color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 },
  stepDesc:  { fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.55 },
  tipsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  tipCard:   { background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '12px 14px' },
  tipLabel:  { fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 3 },
  tipDesc:   { fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 },
  callout:   { background: 'var(--color-bg-secondary)', borderLeft: `3px solid ${RED}`, borderRadius: '0 8px 8px 0', padding: '14px 16px' },
  calloutP:  { fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.65 },
  bottomRule: { height: 1, background: 'var(--color-border)', marginTop: 24 },
  footerNote: { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 10, textAlign: 'center', letterSpacing: '0.01em' },
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel({ onClose, onTemplatesChange }) {
  const [templates,  setTemplates]  = useState([])
  const [editing,    setEditing]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [showGuide,  setShowGuide]  = useState(false)

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(console.error)
  }, [])

  function handleNew() {
    setEditing(createTemplate('New Template'))
  }

  function handleEdit(template) {
    setEditing({ ...template, departments: { ...template.departments } })
  }

  async function handleDuplicate(template) {
    try {
      const copy = await api.createTemplate({
        name: `${template.name} (copy)`,
        description: template.description,
        departments: template.departments,
      })
      setTemplates(prev => [...prev, copy])
    } catch (err) { alert('Failed to duplicate: ' + err.message) }
  }

  async function handleSave(draft) {
    setSaving(true)
    try {
      let next
      if (templates.find(t => t.id === draft.id)) {
        const updated = await api.updateTemplate(draft.id, draft)
        next = templates.map(t => t.id === draft.id ? updated : t)
      } else {
        const created = await api.createTemplate(draft)
        next = [...templates, created]
      }
      setTemplates(next)
      onTemplatesChange?.(next)
      setEditing(null)
    } catch (err) { alert('Failed to save template: ' + err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTemplate(id)
      const next = templates.filter(t => t.id !== id)
      setTemplates(next)
      onTemplatesChange?.(next)
    } catch (err) { alert('Failed to delete: ' + err.message) }
  }

  return (
    <>
    <div style={S.overlay}>
      <div style={S.modal}>

        <div style={S.header}>
          <div>
            <span style={S.title}>Presentation Templates</span>
            <span style={S.sub}>Define reusable slide structures that seed AI-generated decks</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={S.guideBtn} onClick={() => setShowGuide(true)}>Template Guide</button>
            {!editing && (
              <button style={S.newBtn} onClick={handleNew}>+ New template</button>
            )}
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div style={S.body}>
          {editing ? (
            <TemplateEditor
              template={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              saving={saving}
            />
          ) : (
            <div style={S.listArea}>
              {templates.length === 0 ? (
                <div style={S.empty}>
                  <div style={S.emptyTitle}>No templates yet</div>
                  <p style={S.emptyText}>Create a template to define which slides should appear for each department. When generating a deck, users can pick a template to pre-structure the presentation before AI fills in the content.</p>
                  <button style={S.newBtn} onClick={handleNew}>+ Create your first template</button>
                </div>
              ) : (
                templates.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>

    {showGuide && <TemplateGuideModal onClose={() => setShowGuide(false)} />}
    </>
  )
}

const S = {
  overlay:      { position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' },
  modal:        { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0, gap: 16 },
  title:        { display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:          { display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  guideBtn:     { background: 'none', border: '1px solid #CD2F37', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#CD2F37' },
  newBtn:       { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  closeBtn:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  body:         { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },

  // Template list
  listArea:     { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
  card:         { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardName:     { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  cardDesc:     { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  cardMeta:     { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--color-text-muted)' },
  cardBtn:      { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  deptPill:     { fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600 },

  // Empty state
  empty:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' },
  emptyText:    { fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 480, textAlign: 'center', lineHeight: 1.6, margin: 0 },

  // Template editor
  editorPanel:  { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  editorHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0, gap: 16, background: 'var(--color-bg-secondary)' },
  nameInput:    { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '7px 10px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', outline: 'none', width: 340 },
  descInput:    { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: 'var(--color-text-muted)', outline: 'none', width: 340 },
  totalCount:   { fontSize: 11, color: 'var(--color-text-muted)' },
  saveBtn:      { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:    { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },

  // Dept sections in editor
  deptList:     { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  deptSection:  { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' },
  deptHeader:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid var(--color-border)' },
  deptName:     { fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  deptCount:    { fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', borderRadius: 8, padding: '1px 6px' },
  addShellBtn:  { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  shellList:    { display: 'flex', flexDirection: 'column', gap: 0 },
  shellRow:     { display: 'flex', flexDirection: 'column', padding: '8px 14px', borderBottom: '0.5px solid var(--color-border)', gap: 6 },
  shellTop:     { display: 'flex', alignItems: 'center', gap: 8 },
  shellBottom:  { display: 'flex', alignItems: 'flex-start', gap: 8 },
  shellIdx:     { fontSize: 10, color: 'var(--color-text-muted)', width: 18, flexShrink: 0, textAlign: 'center', paddingTop: 2 },
  shellInput:   { flex: 1, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--color-text-primary)', outline: 'none' },
  shellTextarea:{ flex: 1, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--color-text-secondary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 },
  shellSelect:  { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--color-text-muted)', outline: 'none', cursor: 'pointer' },
  removeBtn:    { background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 },
  emptyHint:    { fontSize: 11, color: 'var(--color-text-muted)', padding: '10px 14px', margin: 0, fontStyle: 'italic' },
}
