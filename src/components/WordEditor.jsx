import React, { useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'

/**
 * Minimal rich-text editor using contentEditable + execCommand.
 * Supports: Bold, Italic, H1, H2, bullet list.
 */
export default function WordEditor({ value, onChange }) {
  const ref = useRef(null)

  // Initialise content once — sanitize before writing to innerHTML
  useEffect(() => {
    const safe = DOMPurify.sanitize(value || '')
    if (ref.current && ref.current.innerHTML !== safe) {
      ref.current.innerHTML = safe
    }
  }, [])

  function exec(cmd, val) {
    ref.current?.focus()
    document.execCommand(cmd, false, val ?? null)
    onChange(ref.current.innerHTML)
  }

  return (
    <div style={styles.wrap}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('bold') }} title="Bold"><strong>B</strong></button>
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('italic') }} title="Italic"><em>I</em></button>
        <div style={styles.divider} />
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'h1') }} title="Heading 1">H1</button>
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'h2') }} title="Heading 2">H2</button>
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'p') }} title="Paragraph">¶</button>
        <div style={styles.divider} />
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} title="Bullet list">• List</button>
        <button style={styles.tbBtn} onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }} title="Numbered list">1. List</button>
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={styles.editor}
        onInput={() => onChange(ref.current.innerHTML)}
      />
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', flex: 1, border: '0.5px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexWrap: 'wrap' },
  tbBtn: { background: 'none', border: '0.5px solid transparent', borderRadius: 4, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'inherit' },
  divider: { width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' },
  editor: { flex: 1, padding: '14px 16px', fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-primary)', outline: 'none', overflowY: 'auto', minHeight: 200, background: 'var(--color-bg)' },
}