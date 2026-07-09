import React, { useState, useRef, useCallback } from 'react'
import { WHEEL_DEPTS, DEFAULT_GROUPS, loadTeamConfig, saveTeamConfig, uid } from '../lib/team.js'

// ── SVG helpers ───────────────────────────────────────────────────────────────
const CX = 200, CY = 200
const R_LABEL   = 176   // center of outer label ring
const R_BLACK_O = 188   // outer edge of black ring
const R_BLACK_I = 152   // inner edge of black ring / outer edge of segment ring
const R_SEG_I   = 96    // inner edge of segment ring / outer edge of CS ring
const R_CS_I    = 70    // inner edge of CS ring
const R_CENTER  = 58    // center circle radius

const wheelDepts = WHEEL_DEPTS.filter(d => d.id !== 'client_services')
const SEG_ANGLE  = 360 / wheelDepts.length   // 45°

function toRad(deg) { return (deg - 90) * Math.PI / 180 }

function polar(r, angleDeg) {
  return { x: CX + r * Math.cos(toRad(angleDeg)), y: CY + r * Math.sin(toRad(angleDeg)) }
}

function arcPath(startDeg, endDeg, rOuter, rInner) {
  const s1 = polar(rOuter, startDeg), e1 = polar(rOuter, endDeg)
  const s2 = polar(rInner, endDeg),   e2 = polar(rInner, startDeg)
  const lg = endDeg - startDeg > 180 ? 1 : 0
  return `M${s1.x} ${s1.y} A${rOuter} ${rOuter} 0 ${lg} 1 ${e1.x} ${e1.y} L${s2.x} ${s2.y} A${rInner} ${rInner} 0 ${lg} 0 ${e2.x} ${e2.y}Z`
}

// Arc for textPath — clockwise for top half, counter-clockwise for bottom
// so text is always right-side-up.
function labelArcPath(midDeg, r) {
  const halfArc = 22   // degrees each side of midpoint
  const isBottom = ((midDeg % 360) + 360) % 360 > 180
  if (!isBottom) {
    const s = polar(r, midDeg - halfArc), e = polar(r, midDeg + halfArc)
    return `M${s.x} ${s.y} A${r} ${r} 0 0 1 ${e.x} ${e.y}`
  } else {
    // Reverse arc so text reads normally
    const s = polar(r, midDeg + halfArc), e = polar(r, midDeg - halfArc)
    return `M${s.x} ${s.y} A${r} ${r} 0 0 0 ${e.x} ${e.y}`
  }
}

// Default position for a wheel member (dept + slot index)
function defaultPos(deptId, slotIndex, total) {
  const di = wheelDepts.findIndex(d => d.id === deptId)
  if (di < 0) return { x: CX, y: CY }
  const startDeg = di * SEG_ANGLE
  const midDeg   = startDeg + SEG_ANGLE / 2
  // Stagger slots: alternating radius and slight angle offset
  const r     = slotIndex % 2 === 0 ? 136 : 116
  const angle = midDeg + (slotIndex > 1 ? SEG_ANGLE * 0.2 * (slotIndex % 2 === 0 ? 1 : -1) : 0)
  return polar(r, angle)
}

function csDefaultPos(slotIndex, total) {
  const angle = (slotIndex / Math.max(total, 1)) * 360
  return polar(80, angle)
}

// ── Wheel slide preview ───────────────────────────────────────────────────────
export function TeamSlidePreview({ config, onMemberMove }) {
  const { members = [], groups = DEFAULT_GROUPS } = config || {}
  const svgRef  = useRef(null)
  const dragRef = useRef(null)   // { memberId, startSVGx, startSVGy }

  const centerMember = members.find(m => m.isCenter)
  const wheelMembers = members.filter(m => !m.isCenter && !m.groupId)
  const groupMembers = members.filter(m => m.groupId)

  // Compute photo positions — use saved svgX/svgY if set, else compute default
  const byDept = {}
  for (const d of wheelDepts) byDept[d.id] = []
  const csMems = []
  for (const m of wheelMembers) {
    if (m.deptId === 'client_services') csMems.push(m)
    else if (byDept[m.deptId])          byDept[m.deptId].push(m)
  }

  const photoEntries = []
  wheelDepts.forEach(dept => {
    byDept[dept.id].forEach((m, i) => {
      const def = defaultPos(dept.id, i)
      photoEntries.push({ member: m, x: m.svgX ?? def.x, y: m.svgY ?? def.y, r: 15 })
    })
  })
  csMems.forEach((m, i) => {
    const def = csDefaultPos(i, csMems.length)
    photoEntries.push({ member: m, x: m.svgX ?? def.x, y: m.svgY ?? def.y, r: 12 })
  })

  // ── Drag handling ──────────────────────────────────────────────────────────
  function svgPoint(e) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  function onPhotoPointerDown(e, member) {
    if (!onMemberMove) return
    e.preventDefault()
    e.stopPropagation()
    const p = svgPoint(e)
    dragRef.current = { memberId: member.id, ox: p.x - (member.svgX ?? 0), oy: p.y - (member.svgY ?? 0) }
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup',   onWindowUp)
  }

  function onWindowMove(e) {
    if (!dragRef.current) return
    const p = svgPoint(e)
    onMemberMove(dragRef.current.memberId, p.x - dragRef.current.ox, p.y - dragRef.current.oy)
  }

  function onWindowUp() {
    dragRef.current = null
    window.removeEventListener('pointermove', onWindowMove)
    window.removeEventListener('pointerup',   onWindowUp)
  }

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      display: 'flex', fontFamily: 'Arial, sans-serif',
      background: '#fff', overflow: 'hidden', containerType: 'inline-size',
    }}>

      {/* ── Left half — wheel ─────────────────────────────────────── */}
      <div style={{ flex: '0 0 58%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* MY TEAM title */}
        <div style={{ position: 'absolute', top: '5%', left: '6%' }}>
          <div style={{ fontSize: '3.5cqw', fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>MY TEAM</div>
          <div style={{ width: '4.5cqw', height: '0.4cqw', background: '#CD2F37', marginTop: '0.5cqw' }} />
        </div>

        <svg ref={svgRef} viewBox="0 0 400 400" style={{ width: '90%', height: '90%', overflow: 'visible' }}>
          <defs>
            {/* Label arcs for each dept */}
            {wheelDepts.map((dept, i) => {
              const midDeg = i * SEG_ANGLE + SEG_ANGLE / 2
              return <path key={`larc-${dept.id}`} id={`larc-${dept.id}`} d={labelArcPath(midDeg, R_LABEL)} fill="none" />
            })}
            {/* Clip paths for center + each photo */}
            <clipPath id="cc"><circle cx={CX} cy={CY} r={R_CENTER - 2} /></clipPath>
            {photoEntries.map(({ member: m }) => (
              <clipPath key={`pc-${m.id}`} id={`pc-${m.id}`}>
                <circle cx={0} cy={0} r={1} />
              </clipPath>
            ))}
            {centerMember && <clipPath id="cimg"><circle cx={CX} cy={CY} r={R_CENTER - 3} /></clipPath>}
          </defs>

          {/* ── Outer black ring ── */}
          <circle cx={CX} cy={CY} r={R_BLACK_O} fill="#111" />

          {/* ── Segment ring (alternating light/dark) ── */}
          {wheelDepts.map((dept, i) => {
            const s = i * SEG_ANGLE, e = s + SEG_ANGLE
            return (
              <path
                key={dept.id}
                d={arcPath(s, e, R_BLACK_I, R_SEG_I)}
                fill={i % 2 === 0 ? '#f0f0f0' : '#e0e0e0'}
                stroke="#ccc"
                strokeWidth="0.5"
              />
            )
          })}

          {/* ── Segment divider lines ── */}
          {wheelDepts.map((_, i) => {
            const p1 = polar(R_BLACK_I, i * SEG_ANGLE)
            const p2 = polar(R_SEG_I,   i * SEG_ANGLE)
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#CD2F37" strokeWidth="1.2" />
          })}

          {/* ── Inner CS ring ── */}
          <circle cx={CX} cy={CY} r={R_SEG_I}  fill="#fff" />
          <circle cx={CX} cy={CY} r={R_SEG_I}  fill="none" stroke="#CD2F37" strokeWidth="3" />
          <circle cx={CX} cy={CY} r={R_CS_I}   fill="#fff" />
          <circle cx={CX} cy={CY} r={R_CS_I}   fill="none" stroke="#CD2F37" strokeWidth="1.5" />

          {/* CLIENT SERVICES curved label */}
          <defs>
            <path id="cs-arc" d={`M${polar(R_SEG_I - 10, -40).x} ${polar(R_SEG_I - 10, -40).y} A${R_SEG_I - 10} ${R_SEG_I - 10} 0 0 1 ${polar(R_SEG_I - 10, 40).x} ${polar(R_SEG_I - 10, 40).y}`} />
          </defs>
          <text fontSize="7.5" fontWeight="800" fill="#CD2F37" letterSpacing="0.8">
            <textPath href="#cs-arc" startOffset="50%" textAnchor="middle">CLIENT SERVICES</textPath>
          </text>

          {/* ── Dept labels on outer ring ── */}
          {wheelDepts.map((dept, i) => {
            const midDeg = i * SEG_ANGLE + SEG_ANGLE / 2
            const isBottom = ((midDeg % 360) + 360) % 360 > 180
            return (
              <text key={dept.id} fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="0.7">
                <textPath
                  href={`#larc-${dept.id}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline={isBottom ? 'auto' : 'middle'}
                >
                  {dept.label}
                </textPath>
              </text>
            )
          })}

          {/* ── Wheel member photos ── */}
          {photoEntries.map(({ member: m, x, y, r: pr }) => {
            const isDraggable = !!onMemberMove
            return (
              <g
                key={m.id}
                style={{ cursor: isDraggable ? 'grab' : 'default' }}
                onPointerDown={e => onPhotoPointerDown(e, m)}
              >
                <circle cx={x} cy={y} r={pr + 2} fill="#CD2F37" />
                {m.imageDataUrl ? (
                  <>
                    <defs>
                      <clipPath id={`wc-${m.id}`}><circle cx={x} cy={y} r={pr} /></clipPath>
                    </defs>
                    <image
                      href={m.imageDataUrl}
                      x={x - pr} y={y - pr} width={pr * 2} height={pr * 2}
                      clipPath={`url(#wc-${m.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <circle cx={x} cy={y} r={pr} fill="#bbb" />
                )}
                {isDraggable && (
                  <circle cx={x} cy={y} r={pr + 2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                )}
              </g>
            )
          })}

          {/* ── Center circle ── */}
          <circle cx={CX} cy={CY} r={R_CENTER}     fill="#fff" stroke="#CD2F37" strokeWidth="5" />
          <circle cx={CX} cy={CY} r={R_CENTER - 3} fill="#eee" />
          {centerMember?.imageDataUrl && (
            <image
              href={centerMember.imageDataUrl}
              x={CX - (R_CENTER - 3)} y={CY - (R_CENTER - 3)}
              width={(R_CENTER - 3) * 2} height={(R_CENTER - 3) * 2}
              clipPath="url(#cimg)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Center name + title below circle */}
          {centerMember && (
            <>
              <text x={CX} y={CY + R_CENTER + 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#1a1a1a">{centerMember.name}</text>
              <text x={CX} y={CY + R_CENTER + 22} textAnchor="middle" fontSize="7"  fill="#555">{centerMember.title}</text>
            </>
          )}
        </svg>
      </div>

      {/* ── Right half — sidebar groups ───────────────────────────── */}
      <div style={{
        flex: '0 0 42%',
        background: 'linear-gradient(160deg, #5a0a14 0%, #2a0508 50%, #0a0205 100%)',
        padding: '3cqw 2.8cqw',
        display: 'flex', flexDirection: 'column', gap: '2.2cqw',
        overflowY: 'auto',
      }}>
        {(groups || []).map(group => {
          const gMembers = groupMembers.filter(m => m.groupId === group.id)
          return (
            <div key={group.id}>
              <div style={{ fontSize: '1.6cqw', fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.2, marginBottom: '0.5cqw' }}>{group.label}</div>
              <div style={{ width: '4cqw', height: '0.22cqw', background: '#CD2F37', marginBottom: '1.2cqw' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1cqw' }}>
                {gMembers.length === 0 && (
                  <div style={{ fontSize: '1cqw', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>No members yet</div>
                )}
                {gMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1.1cqw' }}>
                    <div style={{ width: '3.8cqw', height: '3.8cqw', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '0.2cqw solid rgba(255,255,255,0.25)', background: '#444' }}>
                      {m.imageDataUrl && <img src={m.imageDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={m.name} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.15cqw', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{m.name}</div>
                      {m.title   && <div style={{ fontSize: '0.95cqw', color: 'rgba(255,255,255,0.7)' }}>{m.title}</div>}
                      {m.company && <div style={{ fontSize: '0.88cqw', color: 'rgba(255,255,255,0.5)' }}>{m.company}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Member form ───────────────────────────────────────────────────────────────
function MemberForm({ initial, groups, onSave, onCancel }) {
  const [name,         setName]         = useState(initial?.name         || '')
  const [title,        setTitle]        = useState(initial?.title        || '')
  const [company,      setCompany]      = useState(initial?.company      || '')
  const [placement,    setPlacement]    = useState(initial?.groupId ? 'group' : 'wheel')
  const [deptId,       setDeptId]       = useState(initial?.deptId       || WHEEL_DEPTS[0].id)
  const [groupId,      setGroupId]      = useState(initial?.groupId      || groups[0]?.id || '')
  const [isCenter,     setIsCenter]     = useState(initial?.isCenter     || false)
  const [imageDataUrl, setImageDataUrl] = useState(initial?.imageDataUrl || null)
  const imgRef = useRef(null)

  function handleImage(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setImageDataUrl(e.target.result)
    reader.readAsDataURL(file)
  }

  function submit() {
    if (!name.trim()) return
    onSave({
      id:           initial?.id || uid(),
      name:         name.trim(),
      title:        title.trim(),
      company:      company.trim(),
      isCenter:     placement === 'wheel' && isCenter,
      deptId:       placement === 'wheel' ? deptId : null,
      groupId:      placement === 'group' ? groupId : null,
      imageDataUrl,
      svgX:         initial?.svgX ?? null,
      svgY:         initial?.svgY ?? null,
    })
  }

  return (
    <div style={F.form}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div
          style={{ width: 56, height: 56, borderRadius: '50%', background: '#eee', border: '1px solid var(--color-border)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}
          onClick={() => imgRef.current?.click()}
        >
          {imageDataUrl ? <img src={imageDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '📷'}
        </div>
        <div>
          <button style={F.smallBtn} onClick={() => imgRef.current?.click()}>Upload photo</button>
          {imageDataUrl && <button style={{ ...F.smallBtn, marginLeft: 6 }} onClick={() => setImageDataUrl(null)}>Remove</button>}
        </div>
        <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage(e.target.files[0])} />
      </div>

      <label style={F.label}>Name *</label>
      <input style={F.input} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />

      <label style={F.label}>Title</label>
      <input style={F.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Job title" />

      <label style={F.label}>Company</label>
      <input style={F.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="Company (optional)" />

      <label style={F.label}>Placement</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['wheel', 'group'].map(p => (
          <button key={p} style={{ ...F.placementBtn, ...(placement === p ? F.placementBtnActive : {}) }} onClick={() => setPlacement(p)}>
            {p === 'wheel' ? '⚙ Wheel' : '📋 Sidebar group'}
          </button>
        ))}
      </div>

      {placement === 'wheel' && (
        <>
          <label style={F.label}>Department (wheel segment)</label>
          <select style={F.select} value={deptId} onChange={e => setDeptId(e.target.value)}>
            {WHEEL_DEPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <label style={{ ...F.checkRow, marginTop: 10 }}>
            <input type="checkbox" checked={isCenter} onChange={e => setIsCenter(e.target.checked)} />
            <span style={F.checkLabel}>Set as center person (primary contact)</span>
          </label>
        </>
      )}

      {placement === 'group' && (
        <>
          <label style={F.label}>Sidebar group</label>
          <select style={F.select} value={groupId} onChange={e => setGroupId(e.target.value)}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={F.saveBtn} onClick={submit}>Save member</button>
        <button style={F.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

const F = {
  form:              { display: 'flex', flexDirection: 'column' },
  label:             { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
  input:             { width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 10, outline: 'none' },
  select:            { width: '100%', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 10, outline: 'none' },
  placementBtn:      { flex: 1, padding: '6px 0', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', fontSize: 12, cursor: 'pointer', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' },
  placementBtnActive:{ background: 'var(--color-accent-tint)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)', fontWeight: 600 },
  checkRow:          { display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  checkLabel:        { fontSize: 12, color: 'var(--color-text-secondary)' },
  saveBtn:           { flex: 1, padding: '8px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:         { padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '0.5px solid var(--color-border)', background: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  smallBtn:          { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--color-text-primary)' },
}

// ── Main TeamBuilder modal ────────────────────────────────────────────────────
export default function TeamBuilder({ onClose }) {
  const [config,  setConfig]  = useState(loadTeamConfig)
  const [saved,   setSaved]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [tab,     setTab]     = useState('members')

  const { members, groups } = config

  function persist(updated) { setConfig(updated); setSaved(false) }

  function saveMember(member) {
    const exists = members.find(m => m.id === member.id)
    const next   = exists ? members.map(m => m.id === member.id ? member : m) : [...members, member]
    const cleaned = member.isCenter ? next.map(m => m.id === member.id ? m : { ...m, isCenter: false }) : next
    persist({ ...config, members: cleaned })
    setEditing(null)
  }

  function deleteMember(id) { persist({ ...config, members: members.filter(m => m.id !== id) }) }

  // Called when user drags a photo in the live preview
  function handleMemberMove(memberId, x, y) {
    setConfig(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? { ...m, svgX: x, svgY: y } : m),
    }))
    setSaved(false)
  }

  function handleSave() { saveTeamConfig(config); setSaved(true) }

  function updateGroupLabel(groupId, label) {
    persist({ ...config, groups: groups.map(g => g.id === groupId ? { ...g, label } : g) })
  }
  function addGroup() { persist({ ...config, groups: [...groups, { id: uid(), label: 'NEW GROUP' }] }) }
  function deleteGroup(groupId) {
    persist({
      ...config,
      groups:  groups.filter(g => g.id !== groupId),
      members: members.map(m => m.groupId === groupId ? { ...m, groupId: null } : m),
    })
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={S.title}>My Team Builder</span>
            <span style={S.sub}>Add members · drag photos to reposition on the wheel</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.saveBtn} onClick={handleSave}>{saved ? '✓ Saved' : 'Save team'}</button>
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div style={S.body}>

          {/* ── Left panel ── */}
          <div style={S.left}>
            <div style={S.subTabs}>
              <button style={{ ...S.subTab, ...(tab === 'members' ? S.subTabActive : {}) }} onClick={() => setTab('members')}>
                Members <span style={S.badge}>{members.length}</span>
              </button>
              <button style={{ ...S.subTab, ...(tab === 'groups' ? S.subTabActive : {}) }} onClick={() => setTab('groups')}>
                Sidebar groups
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

              {tab === 'members' && (
                <>
                  {editing ? (
                    <MemberForm
                      initial={editing === 'new' ? null : editing}
                      groups={groups}
                      onSave={saveMember}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <button style={S.addBtn} onClick={() => setEditing('new')}>+ Add team member</button>
                      {members.length === 0 && <p style={S.empty}>No members yet.</p>}

                      {members.filter(m => m.isCenter).length > 0 && <div style={S.sectionHd}>Center</div>}
                      {members.filter(m => m.isCenter).map(m => (
                        <MemberRow key={m.id} member={m} badge="CENTER" onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} />
                      ))}

                      {WHEEL_DEPTS.map(dept => {
                        const dm = members.filter(m => m.deptId === dept.id && !m.isCenter)
                        if (!dm.length) return null
                        return (
                          <React.Fragment key={dept.id}>
                            <div style={S.sectionHd}>{dept.label}</div>
                            {dm.map(m => <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} />)}
                          </React.Fragment>
                        )
                      })}

                      {groups.map(g => {
                        const gm = members.filter(m => m.groupId === g.id)
                        if (!gm.length) return null
                        return (
                          <React.Fragment key={g.id}>
                            <div style={S.sectionHd}>{g.label}</div>
                            {gm.map(m => <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} />)}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                </>
              )}

              {tab === 'groups' && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                    These appear as sections in the right sidebar of the slide.
                  </p>
                  {groups.map(g => (
                    <div key={g.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input style={{ ...F.input, marginBottom: 0, flex: 1 }} value={g.label} onChange={e => updateGroupLabel(g.id, e.target.value)} />
                      <button style={S.deleteTiny} onClick={() => deleteGroup(g.id)}>✕</button>
                    </div>
                  ))}
                  <button style={{ ...S.addBtn, marginTop: 8 }} onClick={addGroup}>+ Add group</button>
                </>
              )}
            </div>
          </div>

          {/* ── Right panel — preview ── */}
          <div style={S.preview}>
            <div style={S.previewLabel}>
              Live preview · <span style={{ fontWeight: 400, textTransform: 'none' }}>drag photos to reposition</span>
            </div>
            <TeamSlidePreview config={config} onMemberMove={handleMemberMove} />
            <div style={S.previewHint}>This slide will appear in your generated deck</div>
          </div>

        </div>
      </div>
    </div>
  )
}

function MemberRow({ member, onEdit, onDelete, badge }) {
  return (
    <div style={S.memberRow}>
      <div style={S.memberAvatar}>
        {member.imageDataUrl
          ? <img src={member.imageDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span style={{ fontSize: 14 }}>👤</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={S.memberName}>{member.name}</span>
          {badge && <span style={S.memberBadge}>{badge}</span>}
        </div>
        {member.title   && <div style={S.memberMeta}>{member.title}</div>}
        {member.company && <div style={S.memberMeta}>{member.company}</div>}
      </div>
      <button style={S.editBtn}    onClick={onEdit}>Edit</button>
      <button style={S.deleteTiny} onClick={onDelete}>✕</button>
    </div>
  )
}

const S = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 },
  modal:        { background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1500, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  title:        { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:          { fontSize: 13, color: 'var(--color-text-muted)' },
  saveBtn:      { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  closeBtn:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  body:         { display: 'flex', flex: 1, overflow: 'hidden' },
  left:         { width: 300, flexShrink: 0, borderRight: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  subTabs:      { display: 'flex', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  subTab:       { flex: 1, padding: '9px 0', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', borderBottom: '2px solid transparent' },
  subTabActive: { color: 'var(--color-accent)', fontWeight: 600, borderBottom: '2px solid var(--color-accent)' },
  badge:        { fontSize: 10, background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', padding: '1px 6px', borderRadius: 99, color: 'var(--color-text-muted)' },
  addBtn:       { width: '100%', padding: '8px 0', borderRadius: 'var(--radius-pill)', border: '0.5px dashed var(--color-border)', background: 'none', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: 12 },
  empty:        { fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' },
  sectionHd:    { fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 4px', borderBottom: '0.5px solid var(--color-border)', marginBottom: 4 },
  memberRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--color-border)' },
  memberAvatar: { width: 34, height: 34, borderRadius: '50%', background: '#eee', border: '0.5px solid var(--color-border)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  memberName:   { fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' },
  memberMeta:   { fontSize: 11, color: 'var(--color-text-muted)' },
  memberBadge:  { fontSize: 9, background: '#CD2F3720', border: '0.5px solid #CD2F37', color: '#CD2F37', borderRadius: 99, padding: '1px 5px', fontWeight: 700 },
  editBtn:      { fontSize: 11, background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', cursor: 'pointer', color: 'var(--color-text-secondary)', flexShrink: 0 },
  deleteTiny:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', padding: '2px 4px', flexShrink: 0 },
  preview:      { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: 10, background: 'var(--color-bg-secondary)', overflow: 'auto' },
  previewLabel: { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  previewHint:  { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' },
}
