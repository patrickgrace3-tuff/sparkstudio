import React, { useState } from 'react'
import { DEPT_REQUIREMENTS } from '../lib/constants.js'
import { loadChecklist, saveChecklist } from '../lib/files.js'

// Informational checklist of what a department is expected to provide,
// shown at the top of its Files tab. Checking an item off is just a visual
// reminder for the team — it doesn't gate slide generation.
export default function RequirementsChecklist({ clientId, deptId, deptColor }) {
  const items = DEPT_REQUIREMENTS[deptId]
  const [checked, setChecked] = useState(() => loadChecklist(clientId, deptId))
  const [collapsed, setCollapsed] = useState(false)

  if (!items || !items.length) return null

  function toggle(item) {
    const next = checked.includes(item) ? checked.filter(i => i !== item) : [...checked, item]
    setChecked(next)
    saveChecklist(clientId, deptId, next)
  }

  const doneCount = items.filter(i => checked.includes(i)).length

  return (
    <div style={styles.wrap}>
      <button style={styles.header} onClick={() => setCollapsed(c => !c)}>
        <span style={{ ...styles.dot, background: deptColor || '#CD2F37' }} />
        <span style={styles.title}>What this department needs to provide</span>
        <span style={styles.count}>{doneCount}/{items.length}</span>
        <span style={styles.chevron}>{collapsed ? '▾' : '▴'}</span>
      </button>
      {!collapsed && (
        <ul style={styles.list}>
          {items.map(item => (
            <li key={item} style={styles.item}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => toggle(item)}
                  style={styles.checkbox}
                />
                <span style={{ ...styles.itemText, ...(checked.includes(item) ? styles.itemTextDone : {}) }}>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const styles = {
  wrap:       { borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)' },
  header:     { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer', textAlign: 'left' },
  dot:        { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  title:      { fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 },
  count:      { fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' },
  chevron:    { fontSize: 11, color: 'var(--color-text-muted)' },
  list:       { listStyle: 'none', margin: 0, padding: '0 16px 10px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  item:       { display: 'flex' },
  label:      { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' },
  checkbox:   { marginTop: 2, flexShrink: 0, cursor: 'pointer' },
  itemText:   { fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 },
  itemTextDone: { color: 'var(--color-text-muted)', textDecoration: 'line-through' },
}
