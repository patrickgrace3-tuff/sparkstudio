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

// ── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel({ onClose, onTemplatesChange }) {
  const [templates, setTemplates] = useState([])
  const [editing,   setEditing]   = useState(null)
  const [saving,    setSaving]    = useState(false)

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
    <div style={S.overlay}>
      <div style={S.modal}>

        <div style={S.header}>
          <div>
            <span style={S.title}>Presentation Templates</span>
            <span style={S.sub}>Define reusable slide structures that seed AI-generated decks</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
  )
}

const S = {
  overlay:      { position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' },
  modal:        { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0, gap: 16 },
  title:        { display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:          { display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
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
