/**
 * Authenticated fetch wrapper for the SparkStudio API.
 * Reads VITE_API_URL from env (falls back to localhost:3001 in dev).
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getToken() {
  return localStorage.getItem('ss:token')
}

export function setToken(token) {
  if (token) localStorage.setItem('ss:token', token)
  else        localStorage.removeItem('ss:token')
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    setToken(null)
    throw new Error('Unauthorized')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

export const api = {
  // Auth
  login:    (email, password)   => apiFetch('/api/auth/login',    { method: 'POST', body: { email, password } }),
  register: (email, name, pass) => apiFetch('/api/auth/register', { method: 'POST', body: { email, name, password: pass } }),
  me:       ()                  => apiFetch('/api/auth/me'),

  // Clients
  getClients:    ()              => apiFetch('/api/clients'),
  createClient:  (name)          => apiFetch('/api/clients',       { method: 'POST',   body: { name } }),
  updateClient:  (id, name)      => apiFetch(`/api/clients/${id}`, { method: 'PATCH',  body: { name } }),
  deleteClient:  (id)            => apiFetch(`/api/clients/${id}`, { method: 'DELETE' }),

  // Slides
  getSlides:     (clientId)            => apiFetch(`/api/slides/${clientId}`),
  bulkSaveSlides:(clientId, slides)    => apiFetch(`/api/slides/${clientId}/bulk`, { method: 'PUT', body: { slides } }),
  addSlide:      (clientId, slide)     => apiFetch(`/api/slides/${clientId}`,      { method: 'POST',   body: slide }),
  updateSlide:   (clientId, id, data)  => apiFetch(`/api/slides/${clientId}/${id}`, { method: 'PATCH', body: data }),
  deleteSlide:   (clientId, id)        => apiFetch(`/api/slides/${clientId}/${id}`, { method: 'DELETE' }),

  // Presentations (versions)
  getPresentations: (clientId)        => apiFetch(`/api/presentations/${clientId}`),
  getPresentation:  (clientId, vid)   => apiFetch(`/api/presentations/${clientId}/${vid}`),
  savePresentation: (clientId, data)  => apiFetch(`/api/presentations/${clientId}`, { method: 'POST', body: data }),
  deletePresentation:(clientId, vid)  => apiFetch(`/api/presentations/${clientId}/${vid}`, { method: 'DELETE' }),

  // Client data blobs (funnel, team, files, checklists)
  getClientData:  (clientId, key)        => apiFetch(`/api/clientdata/${clientId}/${key}`),
  setClientData:  (clientId, key, value) => apiFetch(`/api/clientdata/${clientId}/${key}`, { method: 'PUT', body: { value } }),

  // Admin
  adminStats:       ()              => apiFetch('/api/admin/stats'),
  adminGetUsers:    ()              => apiFetch('/api/admin/users'),
  adminCreateUser:  (u)             => apiFetch('/api/admin/users',       { method: 'POST',   body: u }),
  adminUpdateUser:  (id, u)         => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH',  body: u }),
  adminDeleteUser:  (id)            => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminGetClients:  ()              => apiFetch('/api/admin/clients'),

  // Templates
  getTemplates:   ()          => apiFetch('/api/templates'),
  createTemplate: (t)         => apiFetch('/api/templates',       { method: 'POST', body: t }),
  updateTemplate: (id, t)     => apiFetch(`/api/templates/${id}`, { method: 'PUT',  body: t }),
  deleteTemplate: (id)        => apiFetch(`/api/templates/${id}`, { method: 'DELETE' }),
}
