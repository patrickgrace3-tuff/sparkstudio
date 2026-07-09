import React from 'react'
import { DEPARTMENTS } from '../lib/constants.js'

export default function Sidebar({
  allSlides,
  activeDeptId,
  onSelectDept,
  onGenerate,
  isGenerating,
  presTitle,
  onOpenGlobal,
  globalFileCount,
  onOpenFunnel,
  onOpenTeam,
}) {
  const totalSlides = Object.values(allSlides).reduce((a, b) => a + b.length, 0)

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>Presentation</span>
        <p style={styles.presTitle}>{presTitle}</p>
      </div>

      <nav style={styles.deptList}>
        {DEPARTMENTS.map(dept => {
          const count    = (allSlides[dept.id] || []).length
          const isActive = dept.id === activeDeptId
          return (
            <button
              key={dept.id}
              onClick={() => onSelectDept(dept.id)}
              style={{ ...styles.deptItem, ...(isActive ? styles.deptItemActive : {}) }}
            >
              <span style={{ ...styles.dot, background: dept.color }} />
              <span style={styles.deptName}>{dept.name}</span>
              <span style={styles.badge}>{count}</span>
            </button>
          )
        })}
      </nav>

      {/* Global Files */}
      <button style={styles.globalBtn} onClick={onOpenGlobal}>
        <span style={styles.globalIcon}>🌐</span>
        <span style={styles.globalLabel}>Global Files</span>
        {globalFileCount > 0 && (
          <span style={styles.globalBadge}>{globalFileCount}</span>
        )}
      </button>

      {/* Funnel Builder */}
      <button style={styles.funnelBtn} onClick={onOpenFunnel}>
        <span style={styles.globalIcon}>🔻</span>
        <span style={styles.globalLabel}>Funnel</span>
      </button>

      {/* My Team Builder */}
      <button style={styles.funnelBtn} onClick={onOpenTeam}>
        <span style={styles.globalIcon}>👥</span>
        <span style={styles.globalLabel}>My Team</span>
      </button>

      <div style={styles.footer}>
        <p style={styles.totalLabel}>{totalSlides} slide{totalSlides !== 1 ? 's' : ''} total</p>
        <button
          style={{
            ...styles.generateBtn,
            opacity: isGenerating || totalSlides === 0 ? 0.45 : 1,
            cursor:  isGenerating || totalSlides === 0 ? 'not-allowed' : 'pointer',
          }}
          onClick={onGenerate}
          disabled={isGenerating || totalSlides === 0}
        >
          {isGenerating ? 'Generating…' : 'Generate presentation →'}
        </button>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: { width: 240, flexShrink: 0, background: 'var(--color-bg-secondary)', borderRight: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column' },
  header: { padding: '16px 14px 12px', borderBottom: '0.5px solid var(--color-border)' },
  headerLabel: { fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  presTitle: { fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 2 },
  deptList: { flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 },
  deptItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 8px', borderRadius: 'var(--radius-sm)', border: '0.5px solid transparent', background: 'none', color: 'var(--color-text-primary)', width: '100%', textAlign: 'left', cursor: 'pointer' },
  deptItemActive: { background: 'var(--color-accent-tint)', border: '0.5px solid var(--color-border)' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  deptName: { fontSize: 14, flex: 1 },
  badge: { fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', padding: '1px 7px', borderRadius: 'var(--radius-pill)' },
  footer: { padding: '12px 10px', borderTop: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 },
  totalLabel: { fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' },
  generateBtn: { width: '100%', padding: '10px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--color-accent)', color: '#FFFFFF', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  globalBtn:   { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 6px 0', padding: '9px 8px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', cursor: 'pointer', width: 'calc(100% - 12px)', textAlign: 'left' },
  funnelBtn:   { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 6px 0', padding: '9px 8px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', cursor: 'pointer', width: 'calc(100% - 12px)', textAlign: 'left' },
  globalIcon:  { fontSize: 14 },
  globalLabel: { fontSize: 13, color: 'var(--color-text-primary)', flex: 1 },
  globalBadge: { fontSize: 11, color: '#7F77DD', background: '#7F77DD12', border: '0.5px solid #7F77DD44', padding: '1px 7px', borderRadius: 99 },
}