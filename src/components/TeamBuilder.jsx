import React, { useState, useRef } from 'react'
import { WHEEL_DEPTS, DEFAULT_GROUPS, loadTeamConfig, saveTeamConfig, uid } from '../lib/team.js'

// ── Wheel slide preview ───────────────────────────────────────────────────────
// Renders the circular org-chart slide matching the reference design.
export function TeamSlidePreview({ config }) {
  const { members = [], groups = DEFAULT_GROUPS } = config || {}

  const centerMember = members.find(m => m.isCenter)
  const wheelMembers = members.filter(m => !m.isCenter && !m.groupId)
  const groupMembers = members.filter(m => m.groupId)

  // Position avatars around the wheel. Each of the 8 outer depts gets a slice.
  // We place up to ~2 photos per segment in the middle ring.
  const wheelDepts = WHEEL_DEPTS.filter(d => d.id !== 'client_services')
  const segCount   = wheelDepts.length   // 8
  const segAngle   = 360 / segCount      // 45°

  // SVG dimensions (viewBox 400×400, center 200,200)
  const CX = 200, CY = 200
  const R_OUTER_LABEL = 185   // outer ring label arc
  const R_OUTER       = 160   // outer ring outer edge
  const R_INNER       = 120   // inner circle edge / photo ring
  const R_PHOTO_INNER = 85    // inner CLIENT SERVICES ring
  const R_CENTER      = 52    // center circle

  function toRad(deg) { return (deg * Math.PI) / 180 }

  function polarToCart(cx, cy, r, angleDeg) {
    const a = toRad(angleDeg - 90)  // 0° = top
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  // Build SVG arc path for one segment
  function segPath(startDeg, endDeg, rOuter, rInner) {
    const s1 = polarToCart(CX, CY, rOuter, startDeg)
    const e1 = polarToCart(CX, CY, rOuter, endDeg)
    const s2 = polarToCart(CX, CY, rInner, endDeg)
    const e2 = polarToCart(CX, CY, rInner, startDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return [
      `M ${s1.x} ${s1.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${e1.x} ${e1.y}`,
      `L ${s2.x} ${s2.y}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${e2.x} ${e2.y}`,
      'Z',
    ].join(' ')
  }

  // Place wheel member photos — up to 2 per dept segment, stacked radially
  function getWheelPhotos() {
    const byDept = {}
    for (const d of wheelDepts) byDept[d.id] = []
    for (const m of wheelMembers) {
      if (byDept[m.deptId]) byDept[m.deptId].push(m)
    }
    const photos = []
    wheelDepts.forEach((dept, i) => {
      const startDeg = i * segAngle - 90  // offset so first dept is top-right
      const midDeg   = startDeg + segAngle / 2
      const slots    = byDept[dept.id].slice(0, 3)
      slots.forEach((member, si) => {
        // stagger: outer then inner within segment
        const r     = si === 0 ? 140 : si === 1 ? 118 : 130
        const angle = si === 2 ? midDeg + segAngle * 0.15 : midDeg
        const pos   = polarToCart(CX, CY, r, angle)
        photos.push({ member, pos, r: 14 })
      })
    })
    // Inner ring (CLIENT SERVICES dept members)
    const csMems = wheelMembers.filter(m => m.deptId === 'client_services').slice(0, 4)
    csMems.forEach((member, i) => {
      const angle = (i / Math.max(csMems.length, 1)) * 360 - 90
      const pos   = polarToCart(CX, CY, 68, angle)
      photos.push({ member, pos, r: 12 })
    })
    return photos
  }

  const wheelPhotos = getWheelPhotos()

  return (
    <div style={{
      width: '100%', aspectRatio: '16/9',
      display: 'flex', fontFamily: 'Arial, sans-serif',
      background: '#fff', overflow: 'hidden', containerType: 'inline-size',
    }}>
      {/* ── Left half — wheel ─────────────────────────────────── */}
      <div style={{ flex: '0 0 58%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2cqw' }}>
        {/* MY TEAM title */}
        <div style={{ position: 'absolute', top: '6cqw', left: '4cqw' }}>
          <div style={{ fontSize: '3.2cqw', fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>MY TEAM</div>
          <div style={{ width: '4cqw', height: '0.35cqw', background: '#CD2F37', marginTop: '0.4cqw' }} />
        </div>

        {/* SVG wheel */}
        <svg viewBox="0 0 400 400" style={{ width: '82%', height: '82%' }}>
          <defs>
            <clipPath id="center-clip">
              <circle cx={CX} cy={CY} r={R_CENTER} />
            </clipPath>
            {wheelPhotos.map(({ member }) => (
              <clipPath key={`clip-${member.id}`} id={`clip-${member.id}`}>
                <circle cx="0" cy="0" r="1" />
              </clipPath>
            ))}
          </defs>

          {/* Outer black ring */}
          <circle cx={CX} cy={CY} r={R_OUTER_LABEL} fill="#111" />

          {/* Dept segments — alternating fill */}
          {wheelDepts.map((dept, i) => {
            const startDeg = i * segAngle - 90
            const endDeg   = startDeg + segAngle
            const fill     = i % 2 === 0 ? '#f5f5f5' : '#eaeaea'
            return (
              <g key={dept.id}>
                <path d={segPath(startDeg, endDeg, R_OUTER, R_INNER)} fill={fill} stroke="#fff" strokeWidth="1.5" />
              </g>
            )
          })}

          {/* CLIENT SERVICES inner ring */}
          <circle cx={CX} cy={CY} r={R_PHOTO_INNER} fill="#fff" stroke="#CD2F37" strokeWidth="3" />
          <circle cx={CX} cy={CY} r={R_PHOTO_INNER - 1} fill="none" stroke="#fff" strokeWidth="2" />

          {/* Dept label text on outer ring */}
          {wheelDepts.map((dept, i) => {
            const midDeg = i * segAngle - 90 + segAngle / 2
            const pos    = polarToCart(CX, CY, 172, midDeg)
            const rot    = midDeg + 90
            return (
              <text
                key={dept.id}
                x={pos.x} y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fontWeight="700"
                fill="#fff"
                letterSpacing="0.5"
                transform={`rotate(${rot}, ${pos.x}, ${pos.y})`}
              >{dept.label}</text>
            )
          })}

          {/* Inner ring dept dividers */}
          {wheelDepts.map((_, i) => {
            const deg = i * segAngle - 90
            const p1  = polarToCart(CX, CY, R_INNER, deg)
            const p2  = polarToCart(CX, CY, R_PHOTO_INNER, deg)
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#CD2F37" strokeWidth="1" />
          })}

          {/* CLIENT SERVICES label */}
          <text x={CX} y={CY - R_PHOTO_INNER + 10} textAnchor="middle" fontSize="6" fontWeight="700" fill="#CD2F37" letterSpacing="0.4">CLIENT SERVICES</text>

          {/* Wheel member photos */}
          {wheelPhotos.map(({ member, pos, r: pr }) => (
            <g key={member.id}>
              <circle cx={pos.x} cy={pos.y} r={pr + 1.5} fill="#CD2F37" />
              {member.imageDataUrl ? (
                <>
                  <defs>
                    <clipPath id={`wclip-${member.id}`}>
                      <circle cx={pos.x} cy={pos.y} r={pr} />
                    </clipPath>
                  </defs>
                  <image
                    href={member.imageDataUrl}
                    x={pos.x - pr} y={pos.y - pr}
                    width={pr * 2} height={pr * 2}
                    clipPath={`url(#wclip-${member.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <circle cx={pos.x} cy={pos.y} r={pr} fill="#ddd" />
              )}
            </g>
          ))}

          {/* Center circle */}
          <circle cx={CX} cy={CY} r={R_CENTER} fill="#fff" stroke="#CD2F37" strokeWidth="4" />
          {centerMember?.imageDataUrl ? (
            <>
              <defs>
                <clipPath id="center-img-clip"><circle cx={CX} cy={CY} r={R_CENTER - 2} /></clipPath>
              </defs>
              <image
                href={centerMember.imageDataUrl}
                x={CX - (R_CENTER - 2)} y={CY - (R_CENTER - 2)}
                width={(R_CENTER - 2) * 2} height={(R_CENTER - 2) * 2}
                clipPath="url(#center-img-clip)"
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          ) : (
            <circle cx={CX} cy={CY} r={R_CENTER - 2} fill="#eee" />
          )}
          {centerMember && (
            <>
              <text x={CX} y={CY + R_CENTER + 9}  textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#1a1a1a">{centerMember.name}</text>
              <text x={CX} y={CY + R_CENTER + 19} textAnchor="middle" fontSize="6.5" fill="#555">{centerMember.title}</text>
            </>
          )}
        </svg>
      </div>

      {/* ── Right half — group sidebar ─────────────────────────── */}
      <div style={{
        flex: '0 0 42%',
        background: 'linear-gradient(160deg, #5a0a14 0%, #2a0508 50%, #0a0205 100%)',
        padding: '3cqw 2.5cqw',
        display: 'flex', flexDirection: 'column', gap: '2cqw',
        overflowY: 'auto',
      }}>
        {(groups || []).map(group => {
          const gMembers = groupMembers.filter(m => m.groupId === group.id)
          return (
            <div key={group.id}>
              <div style={{ fontSize: '1.5cqw', fontWeight: 900, color: '#fff', letterSpacing: '0.05em', marginBottom: '0.4cqw' }}>{group.label}</div>
              <div style={{ width: '4cqw', height: '0.2cqw', background: '#CD2F37', marginBottom: '1cqw' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9cqw' }}>
                {gMembers.length === 0 && (
                  <div style={{ fontSize: '1cqw', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>No members yet</div>
                )}
                {gMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1cqw' }}>
                    <div style={{ width: '3.5cqw', height: '3.5cqw', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '0.15cqw solid rgba(255,255,255,0.2)', background: '#333' }}>
                      {m.imageDataUrl && <img src={m.imageDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={m.name} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.1cqw', fontWeight: 700, color: '#fff' }}>{m.name}</div>
                      <div style={{ fontSize: '0.9cqw', color: 'rgba(255,255,255,0.7)' }}>{m.title}</div>
                      {m.company && <div style={{ fontSize: '0.85cqw', color: 'rgba(255,255,255,0.5)' }}>{m.company}</div>}
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
    })
  }

  return (
    <div style={F.form}>
      {/* Photo */}
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
          <button
            key={p}
            style={{ ...F.placementBtn, ...(placement === p ? F.placementBtnActive : {}) }}
            onClick={() => setPlacement(p)}
          >
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
            <span style={F.checkLabel}>Set as center person (primary account executive)</span>
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
  const [config, setConfig] = useState(loadTeamConfig)
  const [saved,   setSaved]  = useState(false)
  const [editing, setEditing] = useState(null)  // null | 'new' | member object
  const [tab,     setTab]    = useState('members') // 'members' | 'groups'

  const { members, groups } = config

  function persist(updated) {
    setConfig(updated)
    setSaved(false)
  }

  function saveMember(member) {
    const exists = members.find(m => m.id === member.id)
    const next   = exists
      ? members.map(m => m.id === member.id ? member : m)
      : [...members, member]
    // Only one center allowed
    const cleaned = member.isCenter
      ? next.map(m => m.id === member.id ? m : { ...m, isCenter: false })
      : next
    persist({ ...config, members: cleaned })
    setEditing(null)
  }

  function deleteMember(id) {
    persist({ ...config, members: members.filter(m => m.id !== id) })
  }

  function handleSave() {
    saveTeamConfig(config)
    setSaved(true)
  }

  function updateGroupLabel(groupId, label) {
    persist({ ...config, groups: groups.map(g => g.id === groupId ? { ...g, label } : g) })
  }

  function addGroup() {
    const id = uid()
    persist({ ...config, groups: [...groups, { id, label: 'NEW GROUP' }] })
  }

  function deleteGroup(groupId) {
    persist({
      ...config,
      groups:  groups.filter(g => g.id !== groupId),
      members: members.map(m => m.groupId === groupId ? { ...m, groupId: null } : m),
    })
  }

  const centerMember = members.find(m => m.isCenter)

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={S.title}>My Team Builder</span>
            <span style={S.sub}>Build your team wheel slide</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.saveBtn} onClick={handleSave}>{saved ? '✓ Saved' : 'Save team'}</button>
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div style={S.body}>

          {/* ── Left panel ── */}
          <div style={S.left}>
            {/* Sub-tabs */}
            <div style={S.subTabs}>
              <button style={{ ...S.subTab, ...(tab === 'members' ? S.subTabActive : {}) }} onClick={() => setTab('members')}>
                Team members <span style={S.badge}>{members.length}</span>
              </button>
              <button style={{ ...S.subTab, ...(tab === 'groups' ? S.subTabActive : {}) }} onClick={() => setTab('groups')}>
                Sidebar groups
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

              {/* MEMBERS TAB */}
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

                      {members.length === 0 && (
                        <p style={S.empty}>No team members yet. Add your first member above.</p>
                      )}

                      {/* Center person */}
                      {centerMember && (
                        <div style={S.sectionHeader}>Center — Account Executive</div>
                      )}
                      {members.filter(m => m.isCenter).map(m => (
                        <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} badge="CENTER" />
                      ))}

                      {/* Wheel members by dept */}
                      {WHEEL_DEPTS.map(dept => {
                        const deptMems = members.filter(m => m.deptId === dept.id && !m.isCenter)
                        if (deptMems.length === 0) return null
                        return (
                          <React.Fragment key={dept.id}>
                            <div style={S.sectionHeader}>{dept.label}</div>
                            {deptMems.map(m => (
                              <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} />
                            ))}
                          </React.Fragment>
                        )
                      })}

                      {/* Sidebar group members */}
                      {groups.map(g => {
                        const gMems = members.filter(m => m.groupId === g.id)
                        if (gMems.length === 0) return null
                        return (
                          <React.Fragment key={g.id}>
                            <div style={S.sectionHeader}>{g.label}</div>
                            {gMems.map(m => (
                              <MemberRow key={m.id} member={m} onEdit={() => setEditing(m)} onDelete={() => deleteMember(m.id)} />
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                </>
              )}

              {/* GROUPS TAB */}
              {tab === 'groups' && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                    Sidebar groups appear on the right side of the slide. Edit their names or add new ones.
                  </p>
                  {groups.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        style={{ ...F.input, marginBottom: 0, flex: 1 }}
                        value={g.label}
                        onChange={e => updateGroupLabel(g.id, e.target.value)}
                      />
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
            <div style={S.previewLabel}>Live preview</div>
            <TeamSlidePreview config={config} />
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
          : <span style={{ fontSize: 14 }}>👤</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={S.memberName}>{member.name}</span>
          {badge && <span style={S.memberBadge}>{badge}</span>}
        </div>
        {member.title && <div style={S.memberMeta}>{member.title}</div>}
        {member.company && <div style={S.memberMeta}>{member.company}</div>}
      </div>
      <button style={S.editBtn} onClick={onEdit}>Edit</button>
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
  sectionHeader:{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 4px', borderBottom: '0.5px solid var(--color-border)', marginBottom: 4 },
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
