import React, { useState, useEffect } from 'react'
import { FUNNEL_STAGES, loadFunnelConfig, loadFunnelConfigRemote, saveFunnelConfig, cycleItemState } from '../lib/funnel.js'

// Item state color map
const STATE_COLOR   = { on: '#CD2F37', inhouse: '#1A6FA8', off: '#444' }
const STATE_OPACITY = { on: 1,         inhouse: 1,         off: 0.45 }

function stateKey(val) {
  if (!val || val === false) return 'off'
  if (val === 'inhouse') return 'inhouse'
  return 'on'
}

// ── Scaled funnel icon ────────────────────────────────────────────────────────
function FunnelIconScaled() {
  return (
    <svg viewBox="0 0 48 48" fill="none"
      style={{ width: '3.2cqw', height: '3.2cqw', minWidth: 14, minHeight: 14, flexShrink: 0 }}>
      <circle cx="24" cy="24" r="23" stroke="#CD2F37" strokeWidth="2" fill="rgba(0,0,0,0.5)" />
      {[0, 1, 2, 3].map(i => {
        const top = 10 + i * 7, w = 28 - i * 5, x = (48 - w) / 2
        return <rect key={i} x={x} y={top} width={w} height={5} rx={1}
          fill={i === 0 ? '#CD2F37' : i === 1 ? '#a02030' : i === 2 ? '#7a1828' : '#4a0e18'} />
      })}
    </svg>
  )
}

// ── Slide-style preview of one funnel ────────────────────────────────────────
export function FunnelSlidePreview({ config, label }) {
  const funnelData = config && (config.current || config.target || config)

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
      {/* Dot pattern */}
      <div style={{
        position: 'absolute', right: 0, top: 0, width: '18%', height: '100%',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }} />

      {/* Slide label badge */}
      {label && (
        <div style={{
          position: 'absolute', top: '2cqw', right: '3cqw',
          fontSize: '1.1cqw', fontWeight: 700, color: '#fff',
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          padding: '0.3cqw 0.9cqw', borderRadius: '0.5cqw', letterSpacing: '0.08em',
        }}>{label}</div>
      )}

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-evenly',
        padding: '2.5cqw 3cqw',
        gap: '0.8cqw',
      }}>
        {FUNNEL_STAGES.map(stage => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7cqw', flexShrink: 0, width: '20cqw' }}>
              <FunnelIconScaled />
              <span style={{
                fontSize: '1.3cqw', fontWeight: 800, color: '#fff',
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}>{stage.label}</span>
            </div>

            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.7cqw',
              padding: '0.6cqw 0.9cqw',
              display: 'flex', flexWrap: 'wrap', gap: '0.4cqw',
            }}>
              {stage.items.map((item, i) => {
                const val = funnelData?.[stage.id]?.[item]
                const sk  = stateKey(val)
                return (
                  <span key={i} style={{
                    background: sk === 'off' ? 'rgba(255,255,255,0.06)' : STATE_COLOR[sk],
                    color: sk === 'off' ? 'rgba(255,255,255,0.3)' : '#fff',
                    fontSize: '0.85cqw',
                    fontWeight: 500,
                    padding: '0.25cqw 0.7cqw',
                    borderRadius: '0.35cqw',
                    whiteSpace: 'nowrap',
                    border: sk === 'off' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  }}>{item}</span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '1.5cqw', left: '2.5cqw',
        display: 'flex', gap: '1.5cqw', alignItems: 'center',
      }}>
        <LegendDot color="#CD2F37" label="Conversion Managed" />
        <LegendDot color="#1A6FA8" label="In-House" />
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4cqw' }}>
      <div style={{ width: '0.9cqw', height: '0.9cqw', borderRadius: '50%', background: color, minWidth: 8, minHeight: 8 }} />
      <span style={{ fontSize: '0.8cqw', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ── Toggle switch component ───────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={onChange}
        style={{
          width: 32, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0,
          background: checked ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
          border: '0.5px solid var(--color-border)',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 12, height: 12, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      {label && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>}
    </label>
  )
}

// ── State cycle pill (Off / On / In-House) ───────────────────────────────────
function StatePill({ value }) {
  const sk = stateKey(value)
  if (sk === 'off') return (
    <span style={pill('off')}>Off</span>
  )
  if (sk === 'inhouse') return (
    <span style={pill('inhouse')}>In-House</span>
  )
  return <span style={pill('on')}>On</span>
}

function pill(sk) {
  return {
    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
    background: sk === 'off' ? 'transparent' : STATE_COLOR[sk] + '22',
    color: sk === 'off' ? 'var(--color-text-muted)' : STATE_COLOR[sk],
    border: `0.5px solid ${sk === 'off' ? 'var(--color-border)' : STATE_COLOR[sk] + '55'}`,
    letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0,
  }
}

// ── Main FunnelBuilder modal ──────────────────────────────────────────────────
export default function FunnelBuilder({ onClose, clientId }) {
  const [config, setConfig] = useState(loadFunnelConfig)
  const [activeTab, setActiveTab] = useState('current')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (clientId) loadFunnelConfigRemote(clientId).then(setConfig)
  }, [clientId])

  const activeFunnel = config[activeTab] || {}

  function cycleItem(stageId, item) {
    setConfig(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [stageId]: {
          ...prev[activeTab]?.[stageId],
          [item]: cycleItemState(prev[activeTab]?.[stageId]?.[item]),
        },
      },
    }))
    setSaved(false)
  }

  function setStageState(stageId, items, newState) {
    setConfig(prev => {
      const stageMap = {}
      for (const item of items) stageMap[item] = newState
      return { ...prev, [activeTab]: { ...prev[activeTab], [stageId]: { ...prev[activeTab]?.[stageId], ...stageMap } } }
    })
    setSaved(false)
  }

  function handleSave() {
    saveFunnelConfig(config, clientId)
    setSaved(true)
  }

  // Count per stage for the active funnel
  function stageCounts(stage) {
    const on      = stage.items.filter(i => activeFunnel[stage.id]?.[i] === 'on').length
    const inhouse = stage.items.filter(i => activeFunnel[stage.id]?.[i] === 'inhouse').length
    return { on, inhouse, total: stage.items.length }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={S.title}>Funnel Builder</span>
            <span style={S.sub}>Configure your current and target funnel states</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={S.legend}>
              <LegendChip color="#CD2F37" label="Conversion Managed" />
              <LegendChip color="#1A6FA8" label="In-House" />
              <LegendChip color="#555" label="Off" dim />
            </div>
            <button style={S.saveBtn} onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={S.tabBar}>
          <button
            style={{ ...S.tab, ...(activeTab === 'current' ? S.tabActive : {}) }}
            onClick={() => setActiveTab('current')}
          >
            Current State
            <span style={S.tabHint}>Where we are</span>
          </button>
          <button
            style={{ ...S.tab, ...(activeTab === 'target' ? S.tabActive : {}) }}
            onClick={() => setActiveTab('target')}
          >
            Target State
            <span style={S.tabHint}>Where we want to go</span>
          </button>
          <div style={S.tabHintGlobal}>
            Click an item to cycle: <span style={{ color: '#CD2F37' }}>On</span> → <span style={{ color: '#1A6FA8' }}>In-House</span> → <strong>Off</strong>
          </div>
        </div>

        <div style={S.body}>

          {/* Left — checklist */}
          <div style={S.checklist}>
            {FUNNEL_STAGES.map(stage => {
              const counts = stageCounts(stage)
              const allOff = counts.on + counts.inhouse === 0
              const allOn  = counts.on === stage.items.length

              return (
                <div key={stage.id} style={S.stageSection}>
                  <div style={S.stageHeader}>
                    <span style={S.stageLabel}>{stage.label}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {counts.on > 0 && (
                        <span style={{ fontSize: 10, color: '#CD2F37', fontWeight: 700 }}>{counts.on} Spark</span>
                      )}
                      {counts.inhouse > 0 && (
                        <span style={{ fontSize: 10, color: '#1A6FA8', fontWeight: 700 }}>{counts.inhouse} In-House</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>/ {counts.total}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={S.stageAction} onClick={() => setStageState(stage.id, stage.items, 'on')} title="All Spark">All On</button>
                      <button style={S.stageAction} onClick={() => setStageState(stage.id, stage.items, false)} title="All Off">All Off</button>
                    </div>
                  </div>

                  <div style={S.itemGrid}>
                    {stage.items.map(item => {
                      const val = activeFunnel[stage.id]?.[item]
                      const sk  = stateKey(val)
                      return (
                        <div
                          key={item}
                          onClick={() => cycleItem(stage.id, item)}
                          style={{
                            ...S.itemRow,
                            opacity: sk === 'off' ? 0.45 : 1,
                            borderLeft: sk !== 'off' ? `2px solid ${STATE_COLOR[sk]}` : '2px solid transparent',
                          }}
                        >
                          <span style={S.itemText}>{item}</span>
                          <StatePill value={val} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right — single live preview matching active tab */}
          <div style={S.preview}>
            <div style={S.previewBlock}>
              <div style={S.previewLabel}>{activeTab === 'current' ? 'CURRENT STATE' : 'TARGET STATE'}</div>
              <FunnelSlidePreview config={config[activeTab]} label={activeTab === 'current' ? 'CURRENT' : 'TARGET'} />
            </div>
            <div style={S.previewHint}>Both slides will appear in your generated deck</div>
          </div>

        </div>
      </div>
    </div>
  )
}

function LegendChip({ color, label, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 10, height: 10, borderRadius: 3, flexShrink: 0,
        background: dim ? 'var(--color-bg-tertiary)' : color,
        border: dim ? '0.5px solid var(--color-border)' : 'none',
      }} />
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

const S = {
  overlay:     { position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', padding: 0 },
  modal:       { background: 'var(--color-bg)', borderRadius: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'none' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0, gap: 12 },
  title:       { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:         { fontSize: 12, color: 'var(--color-text-muted)' },
  legend:      { display: 'flex', gap: 12, alignItems: 'center', padding: '6px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--color-border)' },
  saveBtn:     { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  closeBtn:    { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  tabBar:      { display: 'flex', alignItems: 'center', gap: 0, padding: '0 18px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0, background: 'var(--color-bg-secondary)' },
  tab:         { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 18px', border: 'none', borderBottom: '2px solid transparent', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600, marginBottom: -0.5, gap: 1, transition: 'color 0.15s' },
  tabActive:   { color: 'var(--color-accent)', borderBottomColor: 'var(--color-accent)' },
  tabHint:     { fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)', letterSpacing: '0.02em' },
  tabHintGlobal: { marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', paddingRight: 4 },
  body:        { display: 'flex', flex: 1, overflow: 'hidden' },
  checklist:   { width: 320, flexShrink: 0, borderRight: '0.5px solid var(--color-border)', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 },
  stageSection:{ display: 'flex', flexDirection: 'column', gap: 6 },
  stageHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', flexWrap: 'wrap' },
  stageLabel:  { fontSize: 10, fontWeight: 800, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.09em', flex: 1 },
  stageAction: { fontSize: 9, padding: '2px 7px', borderRadius: 4, border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 600 },
  itemGrid:    { display: 'flex', flexDirection: 'column', gap: 2 },
  itemRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.1s, opacity 0.1s', paddingLeft: 8 },
  itemText:    { fontSize: 11, color: 'var(--color-text-secondary)', flex: 1, userSelect: 'none' },
  preview:     { flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 20px', gap: 16, background: 'var(--color-bg-secondary)', overflowY: 'auto' },
  previewBlock:{ display: 'flex', flexDirection: 'column', gap: 6 },
  previewLabel:{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  previewHint: { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 4 },
}
