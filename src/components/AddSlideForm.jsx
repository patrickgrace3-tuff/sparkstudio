import React, { useState } from 'react'

export default function AddSlideForm({ onAdd, onAiAssist, isEnhancing }) {
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')

  function handleAdd() {
    if (!title.trim()) return
    onAdd({ title: title.trim(), body: body.trim() || '(No content added yet)' })
    setTitle('')
    setBody('')
  }

  async function handleAiAssist() {
    if (!title.trim() || !body.trim()) return
    const enhanced = await onAiAssist(title.trim(), body.trim())
    if (enhanced) setBody(enhanced)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
  }

  return (
    <div style={styles.form}>
      <input
        style={styles.input}
        type="text"
        placeholder="Slide title  (e.g. Q3 Revenue Summary)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKey}
      />
      <textarea
        style={styles.textarea}
        placeholder="Key points, data, or talking points for this slide…"
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={handleKey}
      />
      <div style={styles.row}>
        <button style={styles.btnPrimary} onClick={handleAdd}>
          Add slide
        </button>
        <button
          style={{
            ...styles.btnSecondary,
            opacity: isEnhancing || !body.trim() ? 0.5 : 1,
            cursor: isEnhancing || !body.trim() ? 'not-allowed' : 'pointer',
          }}
          onClick={handleAiAssist}
          disabled={isEnhancing || !body.trim()}
        >
          {isEnhancing ? 'Enhancing…' : 'AI enhance notes →'}
        </button>
        <span style={styles.hint}>⌘↵ to add</span>
      </div>
    </div>
  )
}

const styles = {
  form: {
    background: 'var(--color-bg-secondary)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  input: {
    background: 'var(--color-bg)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    width: '100%',
    outline: 'none',
  },
  textarea: {
    background: 'var(--color-bg)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    width: '100%',
    height: 72,
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimary: {
    background: 'var(--color-accent)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
  },
  btnSecondary: {
    background: 'none',
    color: 'var(--color-accent-dark)',
    border: '0.5px solid var(--color-border-medium)',
    borderRadius: 'var(--radius-pill)',
    padding: '8px 14px',
    fontSize: 13,
  },
  hint: {
    marginLeft: 'auto',
    fontSize: 11,
    color: 'var(--color-text-muted)',
  },
}
