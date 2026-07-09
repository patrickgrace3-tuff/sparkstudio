import React, { useState } from 'react'
import { FUNNEL_STAGES, loadFunnelConfig, saveFunnelConfig } from '../lib/funnel.js'

// ── Funnel icon SVG (layered trapezoid) ──────────────────────────────────────
function FunnelIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="23" stroke="#CD2F37" strokeWidth="2" fill="rgba(0,0,0,0.5)" />
      {[0, 1, 2, 3].map(i => {
        const top = 10 + i * 7
        const w   = 28 - i * 5
        const x   = (48 - w) / 2
        return (
          <rect key={i} x={x} y={top} width={w} height={5}
            rx={1} fill={i === 0 ? '#CD2F37' : i === 1 ? '#a02030' : i === 2 ? '#7a1828' : '#4a0e18'} />
        )
      })}
    </svg>
  )
}

// ── Slide-style preview of the funnel ────────────────────────────────────────
export function FunnelSlidePreview({ config, scale = 1 }) {
  const activeStages = FUNNEL_STAGES

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      background: 'radial-gradient(ellipse at 70% 50%, #5a0a14 0%, #2a0508 40%, #0a0205 100%)',
      position: 'relative',
      overflow: 'hidden',
      containerType: 'inline-size',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Decorative dots pattern on right */}
      <div style={{
        position: 'absolute', right: 0, top: 0, width: '18%', height: '100%',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-evenly',
        padding: '2.5cqw 3cqw',
        gap: '1cqw',
      }}>
        {activeStages.map(stage => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw', minHeight: 0 }}>
            {/* Icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8cqw', flexShrink: 0, width: '18cqw' }}>
              <div style={{ flexShrink: 0 }}>
                <FunnelIconScaled />
              </div>
              <span style={{
                fontSize: '1.6cqw', fontWeight: 800, color: '#fff',
                letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{stage.label}</span>
            </div>

            {/* Pill tags box */}
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.8cqw',
              padding: '0.8cqw 1cqw',
              display: 'flex', flexWrap: 'wrap', gap: '0.5cqw',
            }}>
              {stage.items.map((item, i) => {
                const active = config?.[stage.id]?.[item] !== false
                return (
                  <span key={i} style={{
                    background: active ? '#CD2F37' : '#4a4a4a',
                    color: '#fff',
                    fontSize: '0.95cqw',
                    fontWeight: 500,
                    padding: '0.3cqw 0.8cqw',
                    borderRadius: '0.4cqw',
                    whiteSpace: 'nowrap',
                    opacity: active ? 1 : 0.55,
                  }}>{item}</span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


function FunnelIconScaled() {
  return (
    <svg width="3.5cqw" height="3.5cqw" viewBox="0 0 48 48" fill="none"
      style={{ width: '3.5cqw', height: '3.5cqw', minWidth: 16, minHeight: 16 }}>
      <circle cx="24" cy="24" r="23" stroke="#CD2F37" strokeWidth="2" fill="rgba(0,0,0,0.5)" />
      {[0, 1, 2, 3].map(i => {
        const top = 10 + i * 7
        const w   = 28 - i * 5
        const x   = (48 - w) / 2
        return (
          <rect key={i} x={x} y={top} width={w} height={5}
            rx={1} fill={i === 0 ? '#CD2F37' : i === 1 ? '#a02030' : i === 2 ? '#7a1828' : '#4a0e18'} />
        )
      })}
    </svg>
  )
}

// ── Main FunnelBuilder modal ──────────────────────────────────────────────────
export default function FunnelBuilder({ onClose }) {
  const [config, setConfig] = useState(loadFunnelConfig)
  const [saved,  setSaved]  = useState(false)

  function toggle(stageId, item) {
    setConfig(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], [item]: !prev[stageId]?.[item] },
    }))
    setSaved(false)
  }

  function toggleStage(stageId, items) {
    const allOn = items.every(item => config[stageId]?.[item] !== false)
    setConfig(prev => {
      const next = { ...prev[stageId] }
      for (const item of items) next[item] = !allOn
      return { ...prev, [stageId]: next }
    })
    setSaved(false)
  }

  function handleSave() {
    saveFunnelConfig(config)
    setSaved(true)
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <span style={S.title}>Funnel Builder</span>
            <span style={S.sub}>Check or uncheck items to build your funnel slide</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.saveBtn} onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save funnel'}
            </button>
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div style={S.body}>

          {/* Left — checklist */}
          <div style={S.checklist}>
            {FUNNEL_STAGES.map(stage => {
              const allOn = stage.items.every(item => config[stage.id]?.[item] !== false)
              const someOn = stage.items.some(item => config[stage.id]?.[item] !== false)
              return (
                <div key={stage.id} style={S.stageSection}>
                  <div style={S.stageHeader}>
                    <input
                      type="checkbox"
                      checked={allOn}
                      ref={el => { if (el) el.indeterminate = !allOn && someOn }}
                      onChange={() => toggleStage(stage.id, stage.items)}
                      style={S.checkbox}
                    />
                    <span style={S.stageLabel}>{stage.label}</span>
                    <span style={S.stageCount}>
                      {stage.items.filter(i => config[stage.id]?.[i] !== false).length}/{stage.items.length}
                    </span>
                  </div>
                  <div style={S.itemGrid}>
                    {stage.items.map(item => (
                      <label key={item} style={S.itemLabel}>
                        <input
                          type="checkbox"
                          checked={config[stage.id]?.[item] !== false}
                          onChange={() => toggle(stage.id, item)}
                          style={S.checkbox}
                        />
                        <span style={S.itemText}>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right — live preview */}
          <div style={S.preview}>
            <div style={S.previewLabel}>Live preview</div>
            <FunnelSlidePreview config={config} />
            <div style={S.previewHint}>
              This slide will appear in your generated deck
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

const S = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 },
  modal:        { background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1500, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  title:        { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginRight: 12 },
  sub:          { fontSize: 13, color: 'var(--color-text-muted)' },
  saveBtn:      { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  closeBtn:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  body:         { display: 'flex', flex: 1, overflow: 'hidden' },
  checklist:    { width: 340, flexShrink: 0, borderRight: '0.5px solid var(--color-border)', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 },
  stageSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  stageHeader:  { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  stageLabel:   { fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 },
  stageCount:   { fontSize: 11, color: 'var(--color-text-muted)' },
  itemGrid:     { display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 },
  itemLabel:    { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  itemText:     { fontSize: 12, color: 'var(--color-text-secondary)' },
  checkbox:     { accentColor: 'var(--color-accent)', cursor: 'pointer', flexShrink: 0 },
  preview:      { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: 10, background: 'var(--color-bg-secondary)', overflow: 'auto' },
  previewLabel: { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  previewHint:  { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' },
}
