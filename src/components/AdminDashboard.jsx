import React, { useState, useEffect } from 'react'
import { api } from '../lib/apiClient.js'

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, color }) {
  return (
    <div style={S.tile}>
      <span style={{ ...S.tileValue, color }}>{value ?? '—'}</span>
      <span style={S.tileLabel}>{label}</span>
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ currentUserId }) {
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showInvite,  setShowInvite]  = useState(false)
  const [form,        setForm]        = useState({ email: '', name: '', password: '', role: 'user' })
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  useEffect(() => {
    api.adminGetUsers().then(setUsers).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleInvite() {
    if (!form.email || !form.name || !form.password) return
    setSaving(true); setErr('')
    try {
      const user = await api.adminCreateUser(form)
      setUsers(prev => [...prev, user])
      setForm({ email: '', name: '', password: '', role: 'user' })
      setShowInvite(false)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleRoleToggle(user) {
    const next = user.role === 'admin' ? 'user' : 'admin'
    try {
      const updated = await api.adminUpdateUser(user.id, { role: next })
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
    } catch (e) { setErr(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this user?')) return
    try {
      await api.adminDeleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (e) { setErr(e.message) }
  }

  if (loading) return <div style={S.loading}>Loading users…</div>

  return (
    <div style={S.tabContent}>
      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Users</span>
        <button style={S.primaryBtn} onClick={() => setShowInvite(v => !v)}>
          {showInvite ? 'Cancel' : '+ Invite user'}
        </button>
      </div>

      {err && <div style={S.error}>{err}</div>}

      {showInvite && (
        <div style={S.inviteForm}>
          <input
            style={S.input}
            placeholder="Full name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            style={S.input}
            placeholder="Email address"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <input
            style={S.input}
            placeholder="Temporary password"
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
          <select style={S.select} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button style={S.primaryBtn} onClick={handleInvite} disabled={saving}>
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </div>
      )}

      <table style={S.table}>
        <thead>
          <tr>
            {['Name', 'Email', 'Role', 'Created', 'Actions'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={S.tr}>
              <td style={S.td}>
                {u.name}
                {u.id === currentUserId && <span style={S.youBadge}>You</span>}
              </td>
              <td style={S.td}>{u.email}</td>
              <td style={S.td}>
                <span style={{ ...S.roleBadge, ...(u.role === 'admin' ? S.roleBadgeAdmin : {}) }}>
                  {u.role}
                </span>
              </td>
              <td style={S.td}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td style={S.td}>
                <div style={S.actions}>
                  {u.id !== currentUserId && (
                    <>
                      <button style={S.ghostBtn} onClick={() => handleRoleToggle(u)}>
                        Make {u.role === 'admin' ? 'user' : 'admin'}
                      </button>
                      <button style={S.dangerBtn} onClick={() => handleDelete(u.id)}>Remove</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Clients tab ───────────────────────────────────────────────────────────────
function ClientsTab({ onClientsChange }) {
  const [clients,     setClients]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [err,         setErr]         = useState('')
  const [newName,     setNewName]     = useState('')
  const [adding,      setAdding]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(null)

  useEffect(() => {
    api.adminGetClients().then(setClients).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true); setErr('')
    try {
      const created = await api.createClient(newName.trim())
      const updated = [...clients, { ...created, slide_count: 0, total_tokens: 0, estimated_cost: 0 }]
      setClients(updated)
      onClientsChange?.(updated)
      setNewName('')
    } catch (e) { setErr(e.message) }
    finally { setAdding(false) }
  }

  async function handleDelete(id) {
    try {
      await api.deleteClient(id)
      const updated = clients.filter(c => c.id !== id)
      setClients(updated)
      onClientsChange?.(updated)
      setConfirmDel(null)
    } catch (e) { setErr(e.message) }
  }

  if (loading) return <div style={S.loading}>Loading clients…</div>

  return (
    <div style={S.tabContent}>
      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Clients</span>
        <span style={S.sectionSub}>{clients.length} total</span>
      </div>
      {err && <div style={S.error}>{err}</div>}

      <div style={S.inviteForm}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="New client name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button style={S.primaryBtn} onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : '+ Add client'}
        </button>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            {['Client name', 'Slides', 'Token usage', 'Est. cost', 'Created', ''].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} style={S.tr}>
              <td style={S.td}>{c.name}</td>
              <td style={S.td}>{c.slide_count}</td>
              <td style={S.td}>{fmtTokens(c.total_tokens)}</td>
              <td style={S.td}>{fmtCost(c.estimated_cost)}</td>
              <td style={S.td}>{new Date(c.created_at).toLocaleDateString()}</td>
              <td style={S.td}>
                {confirmDel === c.id ? (
                  <div style={S.actions}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Remove?</span>
                    <button style={S.dangerBtn} onClick={() => handleDelete(c.id)}>Yes</button>
                    <button style={S.ghostBtn}  onClick={() => setConfirmDel(null)}>No</button>
                  </div>
                ) : (
                  <button style={S.dangerBtn} onClick={() => setConfirmDel(c.id)}>Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Styles tab ────────────────────────────────────────────────────────────────
const DEFAULT_STYLES = {
  colorPresets: [
    { label: 'White',     bg: '#FFFFFF', text: '#1a1a1a', accent: '#CD2F37' },
    { label: 'Dark',      bg: '#1E2761', text: '#FFFFFF', accent: '#CADCFC' },
    { label: 'Spark Red', bg: '#CD2F37', text: '#FFFFFF', accent: '#FFFFFF' },
    { label: 'Charcoal',  bg: '#36454F', text: '#F2F2F2', accent: '#ef4444' },
    { label: 'Slate',     bg: '#2C3E50', text: '#ECF0F1', accent: '#3498db' },
    { label: 'Forest',    bg: '#2C5F2D', text: '#F5F5F5', accent: '#97BC62' },
  ],
  titleSlide: { bg: '#1E2761', textCol: '#FFFFFF', accent: '#CADCFC', font: 'Arial, sans-serif' },
  contentSlide: { bg: '#FFFFFF', textCol: '#1a1a1a', accent: '#CD2F37', font: 'Arial, sans-serif' },
}

function ColorField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 80, flexShrink: 0 }}>{label}</span>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 32, height: 32, border: '0.5px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', padding: 1 }} />
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function SlideDefaults({ title, value, onChange }) {
  function set(key, val) { onChange({ ...value, [key]: val }) }
  return (
    <div style={{ background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</span>
      <ColorField label="Background" value={value.bg}      onChange={v => set('bg', v)} />
      <ColorField label="Text"       value={value.textCol} onChange={v => set('textCol', v)} />
      <ColorField label="Accent"     value={value.accent}  onChange={v => set('accent', v)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 80, flexShrink: 0 }}>Font</span>
        <input
          style={{ ...SLocal.input, flex: 1 }}
          value={value.font}
          onChange={e => set('font', e.target.value)}
          placeholder="e.g. Arial, sans-serif"
        />
      </div>
    </div>
  )
}

const SLocal = {
  input: { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--color-text-primary)', outline: 'none' },
}

function StylesTab() {
  const [styles,   setStylesCfg] = useState(null)
  const [loading,  setLoading]   = useState(true)
  const [saving,   setSaving]    = useState(false)
  const [saved,    setSaved]     = useState(false)
  const [err,      setErr]       = useState('')

  // New preset form
  const [newPreset, setNewPreset] = useState({ label: '', bg: '#FFFFFF', text: '#1a1a1a', accent: '#CD2F37' })
  const [showAdd,   setShowAdd]   = useState(false)

  useEffect(() => {
    api.adminGetSetting('slide_styles')
      .then(data => setStylesCfg(data ?? DEFAULT_STYLES))
      .catch(() => setStylesCfg(DEFAULT_STYLES))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true); setSaved(false); setErr('')
    try {
      await api.adminPutSetting('slide_styles', styles)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  function removePreset(i) {
    setStylesCfg(s => ({ ...s, colorPresets: s.colorPresets.filter((_, idx) => idx !== i) }))
  }

  function updatePreset(i, key, val) {
    setStylesCfg(s => {
      const next = [...s.colorPresets]
      next[i] = { ...next[i], [key]: val }
      return { ...s, colorPresets: next }
    })
  }

  function addPreset() {
    if (!newPreset.label.trim()) return
    setStylesCfg(s => ({ ...s, colorPresets: [...s.colorPresets, { ...newPreset }] }))
    setNewPreset({ label: '', bg: '#FFFFFF', text: '#1a1a1a', accent: '#CD2F37' })
    setShowAdd(false)
  }

  if (loading) return <div style={S.loading}>Loading styles…</div>

  return (
    <div style={S.tabContent}>
      {err && <div style={S.error}>{err}</div>}

      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Color Presets</span>
        <button style={S.ghostBtn} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ Add preset'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
        These presets appear in the slide style picker for all users.
      </p>

      {showAdd && (
        <div style={{ background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>New preset</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 80, flexShrink: 0 }}>Name</span>
            <input style={{ ...SLocal.input, flex: 1 }} value={newPreset.label} onChange={e => setNewPreset(p => ({ ...p, label: e.target.value }))} placeholder="Preset name" />
          </div>
          <ColorField label="Background" value={newPreset.bg}     onChange={v => setNewPreset(p => ({ ...p, bg: v }))} />
          <ColorField label="Text"       value={newPreset.text}   onChange={v => setNewPreset(p => ({ ...p, text: v }))} />
          <ColorField label="Accent"     value={newPreset.accent} onChange={v => setNewPreset(p => ({ ...p, accent: v }))} />
          <button style={S.primaryBtn} onClick={addPreset} disabled={!newPreset.label.trim()}>Add preset</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {styles.colorPresets.map((p, i) => (
          <div key={i} style={{ background: p.bg, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                value={p.label}
                onChange={e => updatePreset(i, 'label', e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: p.text, flex: 1 }}
              />
              <button onClick={() => removePreset(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.text, opacity: 0.6 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['bg', 'text', 'accent'].map(k => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                  <input type="color" value={p[k]} onChange={e => updatePreset(i, k, e.target.value)}
                    style={{ width: '100%', height: 24, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }} />
                  <span style={{ fontSize: 9, color: p.text, opacity: 0.7, textTransform: 'uppercase' }}>{k}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 3, background: p.accent, borderRadius: 2 }} />
          </div>
        ))}
      </div>

      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Slide Defaults</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
        Default colors and fonts applied when generating new presentations.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SlideDefaults
          title="Title Slide"
          value={styles.titleSlide}
          onChange={v => setStylesCfg(s => ({ ...s, titleSlide: v }))}
        />
        <SlideDefaults
          title="Content Slide"
          value={styles.contentSlide}
          onChange={v => setStylesCfg(s => ({ ...s, contentSlide: v }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
        <button style={S.primaryBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save styles'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#1D9E75' }}>Saved!</span>}
      </div>
    </div>
  )
}

function fmtTokens(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtCost(n) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.adminStats().then(setStats).catch(console.error)
  }, [])

  return (
    <div style={S.tabContent}>
      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Overview</span>
      </div>
      <div style={S.tileRow}>
        <StatTile label="Users"     value={stats?.users}     color="#6366F1" />
        <StatTile label="Clients"   value={stats?.clients}   color="#1D9E75" />
        <StatTile label="Templates" value={stats?.templates} color="#F59E0B" />
        <StatTile label="Slides"    value={stats?.slides}    color="#EC4899" />
      </div>
      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Token Usage (all time)</span>
      </div>
      <div style={S.tileRow}>
        <StatTile label="Input tokens"  value={fmtTokens(stats?.inputTokens)}  color="#6366F1" />
        <StatTile label="Output tokens" value={fmtTokens(stats?.outputTokens)} color="#1D9E75" />
        <StatTile label="Total tokens"  value={fmtTokens(stats?.totalTokens)}  color="#F59E0B" />
        <StatTile label="Est. cost"     value={fmtCost(stats?.estimatedCost)}  color="#EC4899" />
      </div>
      <p style={S.costNote}>Cost estimated using blended Sonnet 4.6 / Haiku 4.5 rates. Actual charges depend on your Anthropic billing.</p>
    </div>
  )
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard({ onClose, currentUser, onClientsChange }) {
  const [tab, setTab] = useState('overview')

  const isAdmin = currentUser?.role === 'admin'

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users',    label: 'Users' },
    { id: 'clients',  label: 'Clients' },
    { id: 'styles',   label: 'Styles & Templates' },
  ]

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <span style={S.title}>Admin Dashboard</span>
            <span style={S.sub}>User, client, and system management</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...S.rolePill, ...(isAdmin ? S.rolePillAdmin : S.rolePillUser) }}>
              {currentUser?.role ?? 'unknown'}
            </span>
            <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {!isAdmin ? (
          <div style={S.accessDenied}>
            <div style={S.accessDeniedIcon}>🔒</div>
            <div style={S.accessDeniedTitle}>Admin access required</div>
            <div style={S.accessDeniedText}>
              Your account role is <strong>{currentUser?.role ?? 'unknown'}</strong>. Only admins can view this dashboard.
              <br />
              If you should have admin access, sign out and back in to refresh your session — or ask an existing admin to update your role.
            </div>
          </div>
        ) : (
          <>
            <div style={S.tabBar}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  style={{ ...S.tabBtn, ...(tab === t.id ? S.tabBtnActive : {}) }}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={S.body}>
              {tab === 'overview' && <OverviewTab />}
              {tab === 'users'    && <UsersTab currentUserId={currentUser?.id} />}
              {tab === 'clients'  && <ClientsTab onClientsChange={onClientsChange} />}
              {tab === 'styles'   && <StylesTab />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay:       { position: 'fixed', inset: 0, background: 'var(--color-bg)', zIndex: 1000, display: 'flex', flexDirection: 'column' },
  modal:         { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:        { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 },
  title:         { display: 'block', fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' },
  sub:           { display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn:      { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  tabBar:        { display: 'flex', gap: 0, padding: '0 24px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 },
  tabBtn:        { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '11px 16px', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: -1 },
  tabBtnActive:  { color: 'var(--color-accent)', borderBottomColor: 'var(--color-accent)', fontWeight: 600 },
  body:          { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  tabContent:    { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  loading:       { padding: 24, fontSize: 13, color: 'var(--color-text-muted)' },
  error:         { fontSize: 13, color: '#ef4444', background: '#ef444412', border: '0.5px solid #ef444430', borderRadius: 6, padding: '12px 16px', fontWeight: 500 },
  accessDenied:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  accessDeniedIcon:  { fontSize: 40 },
  accessDeniedTitle: { fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' },
  accessDeniedText:  { fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 460, textAlign: 'center', lineHeight: 1.7 },
  rolePill:      { fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', border: '0.5px solid', textTransform: 'uppercase', letterSpacing: '0.05em' },
  rolePillAdmin: { color: '#6366F1', background: '#6366F112', borderColor: '#6366F144' },
  rolePillUser:  { color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  sectionSub:    { fontSize: 12, color: 'var(--color-text-muted)' },

  // Stat tiles
  tileRow:  { display: 'flex', gap: 14, flexWrap: 'wrap' },
  tile:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 },
  tileValue:{ fontSize: 32, fontWeight: 800, lineHeight: 1 },
  tileLabel:{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  costNote: { fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 },

  // Table
  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:     { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)' },
  tr:     { borderBottom: '0.5px solid var(--color-border)' },
  td:     { padding: '10px 12px', color: 'var(--color-text-primary)', verticalAlign: 'middle' },
  actions:{ display: 'flex', gap: 6 },

  // Badges
  youBadge:       { fontSize: 9, fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-accent-tint)', borderRadius: 99, padding: '1px 6px', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  roleBadge:      { fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 99, padding: '2px 8px' },
  roleBadgeAdmin: { color: '#6366F1', background: '#6366F112', borderColor: '#6366F144' },

  // Buttons
  primaryBtn: { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  ghostBtn:   { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--color-text-secondary)' },
  dangerBtn:  { background: 'none', border: '0.5px solid #ef444440', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#ef4444' },

  // Invite form
  inviteForm: { display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', alignItems: 'center' },
  input:      { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none', minWidth: 160 },
  select:     { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--color-text-secondary)', outline: 'none', cursor: 'pointer' },
}
