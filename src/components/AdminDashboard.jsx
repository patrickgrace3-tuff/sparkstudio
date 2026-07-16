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
function ClientsTab() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    api.adminGetClients().then(setClients).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={S.loading}>Loading clients…</div>

  return (
    <div style={S.tabContent}>
      <div style={S.sectionHeader}>
        <span style={S.sectionTitle}>Clients</span>
        <span style={S.sectionSub}>{clients.length} total</span>
      </div>
      {err && <div style={S.error}>{err}</div>}
      <table style={S.table}>
        <thead>
          <tr>
            {['Client name', 'Slides', 'Created'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} style={S.tr}>
              <td style={S.td}>{c.name}</td>
              <td style={S.td}>{c.slide_count}</td>
              <td style={S.td}>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
    </div>
  )
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard({ onClose, currentUser }) {
  const [tab, setTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users',    label: 'Users' },
    { id: 'clients',  label: 'Clients' },
  ]

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <span style={S.title}>Admin Dashboard</span>
            <span style={S.sub}>User, client, and system management</span>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
        </div>

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
          {tab === 'clients'  && <ClientsTab />}
        </div>
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
  error:         { fontSize: 12, color: '#ef4444', background: '#ef444412', border: '0.5px solid #ef444430', borderRadius: 6, padding: '8px 12px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  sectionSub:    { fontSize: 12, color: 'var(--color-text-muted)' },

  // Stat tiles
  tileRow:  { display: 'flex', gap: 14, flexWrap: 'wrap' },
  tile:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 },
  tileValue:{ fontSize: 32, fontWeight: 800, lineHeight: 1 },
  tileLabel:{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },

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
