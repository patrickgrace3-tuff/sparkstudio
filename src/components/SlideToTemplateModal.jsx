import React, { useState, useEffect } from 'react'
import { callClaude } from '../lib/api.js'
import { api } from '../lib/apiClient.js'

// Modal: converts a dept slide into a template shell (AI-fills instructions/dos/don'ts).
// Props:
//   slide      — the source slide object
//   deptName   — department name string
//   templates  — current templates array
//   clientId   — for token logging
//   onClose    — dismiss
//   onSaved    — called with updated templates array after save
export default function SlideToTemplateModal({ slide, deptName, templates, clientId, onClose, onSaved }) {
  const [shell, setShell] = useState({ title: slide.title, content: '', doThis: '', dontDoThis: '' })
  const [generating, setGenerating] = useState(true)
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? '')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auto-generate shell fields when modal opens
  useEffect(() => {
    let cancelled = false
    async function generate() {
      const bullets = (slide.bullets ?? []).join('\n')
      const table   = slide.table ? `Table headers: ${slide.table.headers?.join(', ')}` : ''
      const body    = slide.body ?? ''

      const prompt = `You are helping build a reusable presentation template. Based on the slide below, write three fields for a template shell so future AI-generated decks can recreate a similar slide with fresh data.

Slide title: ${slide.title}
Department: ${deptName}
${body ? `Slide instructions/body: ${body}` : ''}
${bullets ? `Bullet points:\n${bullets}` : ''}
${table}

Return ONLY valid JSON (no markdown):
{
  "content": "2-4 sentence description of what this slide should cover and what data or story it should tell. Be specific about the type of analysis, metrics, or narrative the slide should contain.",
  "doThis": "2-3 concrete best-practice instructions for generating this slide well. Focus on formatting, framing, and what makes it effective.",
  "dontDoThis": "2-3 things to avoid that would make this slide weak or confusing."
}`

      try {
        const raw    = await callClaude(prompt, '', 600, { clientId })
        const clean  = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        if (!cancelled) {
          setShell(s => ({
            ...s,
            content:    parsed.content    ?? '',
            doThis:     parsed.doThis     ?? '',
            dontDoThis: parsed.dontDoThis ?? '',
          }))
        }
      } catch {
        // Leave fields blank — user can fill them manually
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }
    generate()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setError('')
    if (mode === 'new' && !newTemplateName.trim()) {
      setError('Enter a template name.')
      return
    }
    setSaving(true)
    try {
      let template
      if (mode === 'new') {
        template = await api.createTemplate({
          name: newTemplateName.trim(),
          description: '',
          departments: { [deptName]: [shell] },
        })
      } else {
        template = templates.find(t => t.id === selectedTemplateId)
        if (!template) { setError('Template not found.'); setSaving(false); return }
        const existing = template.departments[deptName] ?? []
        template = await api.updateTemplate(template.id, {
          ...template,
          departments: { ...template.departments, [deptName]: [...existing, shell] },
        })
      }
      // Refresh full template list and return it
      const updated = await api.getTemplates()
      onSaved(updated)
      onClose()
    } catch (err) {
      setError('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        <div style={S.header}>
          <div>
            <div style={S.title}>Save as Template Slide</div>
            <div style={S.sub}>{deptName} · {slide.title}</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {generating && (
          <div style={S.genBanner}>
            <div style={S.spinner} />
            <span>AI is generating instructions, dos &amp; don'ts…</span>
          </div>
        )}

        <div style={S.fields}>
          <label style={S.label}>Slide Title</label>
          <input
            style={S.input}
            value={shell.title}
            onChange={e => setShell(s => ({ ...s, title: e.target.value }))}
          />

          <label style={S.label}>Slide Instructions</label>
          <textarea
            style={S.textarea}
            value={shell.content}
            onChange={e => setShell(s => ({ ...s, content: e.target.value }))}
            placeholder="What should this slide cover?"
            rows={3}
          />

          <div style={S.guardrailRow}>
            <div style={S.guardrailField}>
              <label style={{ ...S.label, color: '#16a34a' }}>Do This</label>
              <textarea
                style={{ ...S.textarea, borderColor: '#16a34a44' }}
                value={shell.doThis}
                onChange={e => setShell(s => ({ ...s, doThis: e.target.value }))}
                placeholder="Best practices for generating this slide"
                rows={2}
              />
            </div>
            <div style={S.guardrailField}>
              <label style={{ ...S.label, color: '#dc2626' }}>Don't Do This</label>
              <textarea
                style={{ ...S.textarea, borderColor: '#dc262644' }}
                value={shell.dontDoThis}
                onChange={e => setShell(s => ({ ...s, dontDoThis: e.target.value }))}
                placeholder="Common mistakes to avoid"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div style={S.dest}>
          <div style={S.destLabel}>Add to template</div>
          <div style={S.destTabs}>
            <button
              style={{ ...S.destTab, ...(mode === 'existing' ? S.destTabActive : {}) }}
              onClick={() => setMode('existing')}
              disabled={templates.length === 0}
            >
              Existing template
            </button>
            <button
              style={{ ...S.destTab, ...(mode === 'new' ? S.destTabActive : {}) }}
              onClick={() => setMode('new')}
            >
              New template
            </button>
          </div>

          {mode === 'existing' ? (
            templates.length === 0 ? (
              <p style={S.hint}>No templates yet — switch to "New template".</p>
            ) : (
              <select
                style={S.select}
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )
          ) : (
            <input
              style={S.input}
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Template name (e.g. Q4 Standard)"
              autoFocus
            />
          )}
        </div>

        {error && <div style={S.error}>{error}</div>}

        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.saveBtn} onClick={handleSave} disabled={saving || generating}>
            {saving ? 'Saving…' : 'Save to Template'}
          </button>
        </div>

      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', width: 560, maxWidth: '95vw',
    maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)',
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:   { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px 6px' },

  genBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px', background: 'var(--color-bg-secondary)',
    borderBottom: '0.5px solid var(--color-border)',
    fontSize: 12, color: 'var(--color-text-secondary)',
  },
  spinner: {
    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
    border: '2px solid var(--color-border)',
    borderTopColor: 'var(--color-accent)',
    animation: 'spin 0.7s linear infinite',
  },

  fields: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  label:  { fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:  { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontFamily: 'inherit' },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 },
  guardrailRow: { display: 'flex', gap: 10 },
  guardrailField: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },

  dest: { padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  destLabel: { fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  destTabs: { display: 'flex', gap: 6 },
  destTab: { fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' },
  destTabActive: { background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' },
  select: { padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', width: '100%' },
  hint: { fontSize: 12, color: 'var(--color-text-muted)', margin: 0 },

  error: { margin: '0 20px', padding: '8px 12px', background: '#dc262611', border: '0.5px solid #dc262644', borderRadius: 6, fontSize: 12, color: '#dc2626' },

  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '14px 20px', borderTop: '0.5px solid var(--color-border)',
  },
  cancelBtn: { padding: '7px 16px', fontSize: 13, borderRadius: 'var(--radius-pill)', border: '0.5px solid var(--color-border)', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn:   { padding: '7px 18px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
}
