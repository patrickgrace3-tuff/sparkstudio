import React, { useState, useEffect, useRef, useCallback } from 'react'
import { WHEEL_DEPTS, WHEEL_QUADS, wheelQuadOf, DEFAULT_GROUPS, loadTeamConfig, loadTeamConfigRemote, saveTeamConfig, uid } from '../lib/team.js'
import { importTeamFromPptx } from '../lib/teamImport.js'

// ── My Team slide ─────────────────────────────────────────────────────────────
// Layout measured from the Spark Studio "My Team" slide: white left side with
// the team wheel, dark red panel on the right (template background
// /branding/team-bg.png) listing the side groups.
//
// The wheel (SVG units, 600×600, centre 300,300):
//   red outer ring  (268–300) — the four main departments
//   black ring      (240–268) — sub-departments
//   white area      (110–240) — split into four quadrants by thin lines; photos
//   red Client Services ring (93–110), white centre with the lead + their team
const CX = 300, CY = 300
const R_RED_O = 300, R_RED_I = 268, R_BLACK_I = 240, R_CS_O = 110, R_CS_I = 93
const RED = '#CD2F37'
const PHOTO_R = 23

const QUADS = WHEEL_QUADS
const quadOf = wheelQuadOf

const rad = deg => (deg - 90) * Math.PI / 180
const polar = (r, deg) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) })
const norm = deg => ((deg % 360) + 360) % 360

// Arc for curved text, centred on midDeg; bottom-half labels run the other
// way so they read upright
function textArc(midDeg, r, half = 50) {
  const bottom = norm(midDeg) > 90 && norm(midDeg) < 270
  const a = polar(r, bottom ? midDeg + half : midDeg - half)
  const b = polar(r, bottom ? midDeg - half : midDeg + half)
  return `M${a.x} ${a.y} A${r} ${r} 0 0 ${bottom ? 0 : 1} ${b.x} ${b.y}`
}

// Default spots for a quadrant's members: along arcs, in the order of the
// angle each member belongs near (sub-department label or quadrant middle)
function quadrantSpots(q, n) {
  if (!n) return []
  const rows = n <= 4 ? 1 : n <= 10 ? 2 : 3
  const radii = rows === 1 ? [178] : rows === 2 ? [200, 150] : [212, 175, 138]
  const pad = 13
  const span = (q.end - q.start) - pad * 2
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    return polar(radii[i % rows], q.start + pad + t * span)
  })
}

function defaultPositions(wheelMembers) {
  const pos = {}
  for (const q of QUADS) {
    const mid = (q.start + q.end) / 2
    const angleFor = m => {
      const sub = q.subs.find(s => s.id === m.deptId)
      if (!sub) return mid
      let a = sub.angle
      while (a < q.start) a += 360
      return a
    }
    const ms = wheelMembers.filter(m => quadOf(m.deptId) === q)
      .map((m, i) => ({ m, a: angleFor(m), i }))
      .sort((x, y) => x.a - y.a || x.i - y.i)
    quadrantSpots(q, ms.length).forEach((p, i) => { pos[ms[i].m.id] = p })
  }
  return pos
}

function PhotoCircle({ member, x, y, r, ring = '#8f8f8f', ringW = 2, onPointerDown, draggable }) {
  const id = `ph-${member.id}`
  return (
    <g style={{ cursor: draggable ? 'grab' : 'default' }} onPointerDown={onPointerDown}>
      <circle cx={x} cy={y} r={r + ringW / 2} fill="#fff" stroke={ring} strokeWidth={ringW} />
      {member.imageDataUrl ? (
        <>
          <defs><clipPath id={id}><circle cx={x} cy={y} r={r} /></clipPath></defs>
          <image href={member.imageDataUrl} x={x - r} y={y - r} width={r * 2} height={r * 2} clipPath={`url(#${id})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <circle cx={x} cy={y} r={r} fill="#c9c9c9" />
      )}
    </g>
  )
}

export function TeamSlidePreview({ config, onMemberMove }) {
  const { members = [], groups = DEFAULT_GROUPS } = config || {}
  const svgRef  = useRef(null)
  const dragRef = useRef(null)

  const centerMember = members.find(m => m.isCenter)
  const wheelMembers = members.filter(m => !m.isCenter && !m.groupId && m.deptId !== 'client_services' && quadOf(m.deptId))
  const csMembers    = members.filter(m => !m.isCenter && !m.groupId && m.deptId === 'client_services')
  const groupMembers = members.filter(m => m.groupId)
  const defaults     = defaultPositions(wheelMembers)

  // Saved positions (wx/wy) are in this wheel's units; older ones (svgX/svgY)
  // belonged to the previous layout and are ignored
  const photos = wheelMembers.map(m => ({ m, x: m.wx ?? defaults[m.id].x, y: m.wy ?? defaults[m.id].y }))
  const csSpacing = PHOTO_R * 2 + 12
  const csPhotos = csMembers.map((m, i) => ({
    m,
    x: m.wx ?? CX + (i - (csMembers.length - 1) / 2) * csSpacing,
    y: m.wy ?? CY + 47,
  }))

  function svgPoint(e) {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }
  function startDrag(e, member, x, y) {
    if (!onMemberMove) return
    e.preventDefault(); e.stopPropagation()
    const p = svgPoint(e)
    dragRef.current = { id: member.id, ox: p.x - x, oy: p.y - y }
    const move = ev => {
      if (!dragRef.current) return
      const q = svgPoint(ev)
      onMemberMove(dragRef.current.id, q.x - dragRef.current.ox, q.y - dragRef.current.oy)
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Headings use Arial Black, as on the original slide (sizes measured for it)
  const heavy = '"Arial Black", "Arial Bold", Arial, sans-serif'

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
      background: '#fff', fontFamily: 'Arial, sans-serif', containerType: 'inline-size',
    }}>
      {/* Template background: white left, dark red panel + corner graphic right */}
      <img src="/branding/team-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* MY TEAM */}
      <div style={{ position: 'absolute', left: '3.75%', top: '6.6%', display: 'inline-block' }}>
        <div style={{ fontFamily: heavy, fontSize: '3.27cqw', fontWeight: 900, color: '#111', lineHeight: 1 }}>MY TEAM</div>
        <div style={{ height: '0.55cqw', background: RED, marginTop: '0.9cqw' }} />
      </div>

      {/* The wheel — positioned by a wrapper; the SVG itself only fills it, so
          the PowerPoint export (html2canvas) draws it in the same place */}
      <div style={{ position: 'absolute', left: '16.12%', top: '4.91%', width: '50.13%', height: '89.29%' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 600 600"
        width="100%" height="100%"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {QUADS.map(q => <path key={`a-${q.id}`} id={`team-main-${q.id}`} d={textArc(q.labelAngle, (R_RED_O + R_RED_I) / 2)} fill="none" />)}
          {QUADS.flatMap(q => q.subs).map(sub => <path key={`s-${sub.id}`} id={`team-sub-${sub.id}`} d={textArc(sub.angle, (R_RED_I + R_BLACK_I) / 2, 30)} fill="none" />)}
          <path id="team-cs" d={textArc(0, (R_CS_O + R_CS_I) / 2, 60)} fill="none" />
        </defs>

        {/* Rings */}
        <circle cx={CX} cy={CY} r={R_RED_O} fill={RED} />
        <circle cx={CX} cy={CY} r={R_RED_I} fill="#000" />
        <circle cx={CX} cy={CY} r={R_BLACK_I} fill="#fff" />

        {/* Quadrant dividers */}
        {QUADS.map(q => {
          const a = polar(R_CS_O, q.start), b = polar(R_BLACK_I, q.start)
          return <line key={`d-${q.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4c4c4" strokeWidth="1.2" />
        })}

        {/* Department labels */}
        {QUADS.map(q => (
          <text key={`t-${q.id}`} fontFamily={heavy} fontSize="21.5" fontWeight="900" fill="#fff" letterSpacing="0.5">
            <textPath href={`#team-main-${q.id}`} startOffset="50%" textAnchor="middle" dominantBaseline="central">{q.label}</textPath>
          </text>
        ))}
        {QUADS.flatMap(q => q.subs).map(sub => (
          <text key={`ts-${sub.id}`} fontSize="12.5" fontWeight="700" fill="#fff" letterSpacing="0.4">
            <textPath href={`#team-sub-${sub.id}`} startOffset="50%" textAnchor="middle" dominantBaseline="central">{sub.label}</textPath>
          </text>
        ))}

        {/* Team photos */}
        {photos.map(({ m, x, y }) => (
          <PhotoCircle key={m.id} member={m} x={x} y={y} r={PHOTO_R} draggable={!!onMemberMove} onPointerDown={e => startDrag(e, m, x, y)} />
        ))}

        {/* Client Services */}
        <circle cx={CX} cy={CY} r={(R_CS_O + R_CS_I) / 2} fill="#fff" stroke={RED} strokeWidth={R_CS_O - R_CS_I} />
        <text fontSize="12" fontWeight="800" fill="#fff" letterSpacing="0.3">
          <textPath href="#team-cs" startOffset="50%" textAnchor="middle" dominantBaseline="central">CLIENT SERVICES</textPath>
        </text>
        {centerMember && (
          <>
            <PhotoCircle member={centerMember} x={CX} y={CY - 48} r={29} ring={RED} ringW={1.5} />
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#1a1a1a">{centerMember.name}</text>
            {centerMember.title && <text x={CX} y={CY + 9} textAnchor="middle" fontSize="8.5" fill="#333">{centerMember.title}</text>}
          </>
        )}
        {csPhotos.map(({ m, x, y }) => (
          <PhotoCircle key={m.id} member={m} x={x} y={y} r={PHOTO_R} draggable={!!onMemberMove} onPointerDown={e => startDrag(e, m, x, y)} />
        ))}
      </svg>
      </div>

      {/* Right panel — side groups */}
      <div style={{ position: 'absolute', left: '72.9%', top: '5.6%', width: '19.6%', display: 'flex', flexDirection: 'column', gap: '3.4cqw' }}>
        {(groups || []).map(group => {
          const gMembers = groupMembers.filter(m => m.groupId === group.id)
          if (!gMembers.length && !onMemberMove) return null
          return (
            <div key={group.id}>
              <div style={{ fontFamily: heavy, fontSize: '1.63cqw', fontWeight: 900, color: '#fff', lineHeight: 1.2, textTransform: 'uppercase' }}>{group.label}</div>
              <div style={{ height: '0.22cqw', background: RED, marginTop: '0.7cqw' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25cqw', marginTop: '1.6cqw' }}>
                {gMembers.length === 0 && (
                  <div style={{ fontSize: '1cqw', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>No members yet</div>
                )}
                {gMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1.15cqw' }}>
                    <div style={{ width: '4.6cqw', height: '4.6cqw', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: `0.25cqw solid ${RED}`, background: '#555', boxSizing: 'border-box' }}>
                      {m.imageDataUrl && <img src={m.imageDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={m.name} />}
                    </div>
                    <div style={{ color: '#fff', minWidth: 0 }}>
                      <div style={{ fontSize: '1.1cqw', fontWeight: 700, lineHeight: 1.25 }}>{m.name}</div>
                      {m.title   && <div style={{ fontSize: '0.82cqw', lineHeight: 1.3 }}>{m.title}</div>}
                      {m.company && <div style={{ fontSize: '0.82cqw', lineHeight: 1.3 }}>{m.company}</div>}
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
      wx:           initial?.wx ?? null,
      wy:           initial?.wy ?? null,
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
export default function TeamBuilder({ onClose, clientId }) {
  const [config,  setConfig]  = useState(loadTeamConfig)
  const [saved,   setSaved]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [tab,     setTab]     = useState('members')
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState(null) // { members, groups, summary, fileName } awaiting confirmation
  const importRef = useRef(null)

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const result = await importTeamFromPptx(file, config.groups ?? DEFAULT_GROUPS)
      setImported({ ...result, fileName: file.name })
      setTab('members')
      setEditing(null)
    } catch (err) {
      alert('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  function applyImport(mode) {
    const keep = mode === 'add' ? config.members : []
    // Only one lead in the centre: an imported lead replaces the current one
    const hasNewLead = imported.members.some(m => m.isCenter)
    const kept = hasNewLead ? keep.map(m => ({ ...m, isCenter: false })) : keep
    persist({ ...config, groups: imported.groups, members: [...kept, ...imported.members] })
    setImported(null)
  }

  useEffect(() => {
    if (clientId) loadTeamConfigRemote(clientId).then(setConfig)
  }, [clientId])

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
      members: prev.members.map(m => m.id === memberId ? { ...m, wx: x, wy: y } : m),
    }))
    setSaved(false)
  }

  function handleSave() { saveTeamConfig(config, clientId); setSaved(true) }

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
                      {imported ? (
                        <div style={S.importBox}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>Found {imported.summary.total} people in {imported.fileName}</div>
                          <ul style={{ margin: '6px 0 8px', paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                            {imported.summary.lead > 0 && <li>Client Services lead (centre)</li>}
                            {imported.summary.clientServices > 0 && <li>{imported.summary.clientServices} in Client Services</li>}
                            {imported.summary.wheel > 0 && <li>{imported.summary.wheel} on the wheel, placed by department</li>}
                            {imported.summary.grouped > 0 && <li>{imported.summary.grouped} in sidebar groups{imported.summary.newGroups.length ? ` (new: ${imported.summary.newGroups.join(', ')})` : ''}</li>}
                          </ul>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                            Photos keep the crop and position from the slide.{imported.summary.unnamed ? ` ${imported.summary.unnamed} ${imported.summary.unnamed === 1 ? 'person needs a name' : 'people need names'} — use Edit on each to add name, title and company.` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {members.length > 0 && <button style={S.addBtn} onClick={() => applyImport('replace')}>Replace current team</button>}
                            <button style={members.length > 0 ? S.secondaryBtn : S.addBtn} onClick={() => applyImport('add')}>{members.length > 0 ? 'Add to current team' : 'Add these people'}</button>
                            <button style={S.secondaryBtn} onClick={() => setImported(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...S.addBtn, flex: 1 }} onClick={() => setEditing('new')}>+ Add team member</button>
                          <button style={S.secondaryBtn} onClick={() => importRef.current?.click()} disabled={importing} title="Create the team from an existing My Team slide — photos, positions, and names where the slide has them">
                            {importing ? 'Reading…' : '↑ Import slide'}
                          </button>
                          <input ref={importRef} type="file" accept=".pptx" style={{ display: 'none' }} onChange={handleImportFile} />
                        </div>
                      )}
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
          <span style={{ ...S.memberName, ...(member.name ? {} : { color: '#b45309', fontStyle: 'italic' }) }}>{member.name || 'Needs name'}</span>
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
  importBox:    { border: '0.5px solid var(--color-border)', borderRadius: 8, padding: 12, background: 'var(--color-bg-secondary)', marginBottom: 12 },
  secondaryBtn: { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' },
  modal:        { background: 'var(--color-bg)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
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
