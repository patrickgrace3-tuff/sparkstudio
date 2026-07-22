// Looker REST API helper (self-hosted / GCP Looker)
// baseUrl and clientId are persisted in localStorage for convenience.
// clientSecret is intentionally NOT persisted — it must be re-entered each session.

export const LOOKER_CREDS_KEY = 'sparkstudio_looker_creds'

export const LOOKER_REPORTS = [
  { id: '1',  name: 'Monthly Performance Summary' },
  { id: '2',  name: 'Lead Source Breakdown' },
  { id: '3',  name: 'Conversion Funnel Report' },
  { id: '4',  name: 'Campaign ROI Overview' },
  { id: '5',  name: 'Audience Demographics' },
]

export function loadLookerCreds() {
  try { return JSON.parse(localStorage.getItem(LOOKER_CREDS_KEY)) || {} }
  catch { return {} }
}

export function saveLookerCreds(creds) {
  // Strip clientSecret before persisting — it must be re-entered each session
  const { clientSecret: _omit, ...safe } = creds
  localStorage.setItem(LOOKER_CREDS_KEY, JSON.stringify(safe))
}

// Authenticate and return a short-lived access token.
async function getToken(baseUrl, clientId, clientSecret) {
  const res = await fetch(`${baseUrl}/api/4.0/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

// Run a Look and return its CSV text.
export async function runLookerReport({ baseUrl, clientId, clientSecret, lookId, startDate, endDate }) {
  const token = await getToken(baseUrl, clientId, clientSecret)

  // Build date filter string Looker understands, e.g. "2024/01/01 to 2024/01/31"
  const dateFilter = `${startDate} to ${endDate}`

  const params = new URLSearchParams({
    'filters[date]': dateFilter,
    limit: 5000,
  })

  const res = await fetch(`${baseUrl}/api/4.0/looks/${lookId}/run/csv?${params}`, {
    headers: { Authorization: `token ${token}` },
  })
  if (!res.ok) throw new Error(`Report fetch failed: ${res.status} ${await res.text()}`)
  return res.text()
}
