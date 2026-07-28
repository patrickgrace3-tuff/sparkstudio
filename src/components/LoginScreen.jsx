import React, { useState } from 'react'
import { api, setToken } from '../lib/apiClient.js'

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      setToken(res.token)
      onLogin(res.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <div style={S.brandLogo}>
          <img src="https://hub.conversionia.com/images/logo_full.svg" alt="Conversionia" style={{ height: 40 }} />
        </div>

        <div style={S.logo}>
          <img src="/branding/spark-studio-logo.png" style={{ height: 48 }} onError={e => e.target.style.display='none'} />
          <span style={S.appName}>SparkStudio</span>
        </div>

        <h2 style={S.title}>Sign in</h2>

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          {error && <p style={S.error}>{error}</p>}

          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <p style={S.toggle}>
          Don't have an account? Email{' '}
          <a href="mailto:PGrace@conversionia.com" style={S.link}>PGrace@conversionia.com</a>
        </p>
      </div>
    </div>
  )
}

const S = {
  backdrop:   { position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  card:       { width: 380, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 },
  brandLogo:  { display: 'flex', justifyContent: 'center' },
  logo:       { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' },
  appName:  { fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' },
  title:    { fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, textAlign: 'center' },
  form:     { display: 'flex', flexDirection: 'column', gap: 14 },
  field:    { display: 'flex', flexDirection: 'column', gap: 5 },
  label:    { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' },
  input:    { padding: '9px 11px', border: '0.5px solid var(--color-border)', borderRadius: 7, fontSize: 14, background: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' },
  error:    { fontSize: 12, color: '#ef4444', margin: 0 },
  btn:      { padding: '11px 0', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', letterSpacing: '0.03em' },
  toggle:   { fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 },
  link:     { color: 'var(--color-accent)', fontSize: 12, textDecoration: 'none' },
}
