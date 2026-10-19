import { api } from './apiClient.js'

// Saves a client's slide-builder slides one request at a time. Every change
// (import, edit, delete, Push Changes) sends the whole set; if more changes
// happen while a save is running, only the newest set is sent next, so an
// older save can never land after a newer one.
const queues = new Map() // clientId → { running, pending, waiters }

export function saveSlides(clientId, slides) {
  let q = queues.get(clientId)
  if (!q) { q = { running: false, pending: null, waiters: [] }; queues.set(clientId, q) }
  q.pending = slides
  const done = new Promise((resolve, reject) => q.waiters.push({ resolve, reject }))
  if (!q.running) run(clientId, q)
  return done
}

async function run(clientId, q) {
  q.running = true
  while (q.pending) {
    const slides  = q.pending
    const waiters = q.waiters
    q.pending = null
    q.waiters = []
    try {
      await api.bulkSaveSlides(clientId, slides)
      waiters.forEach(w => w.resolve())
    } catch (err) {
      waiters.forEach(w => w.reject(err))
    }
  }
  q.running = false
}
