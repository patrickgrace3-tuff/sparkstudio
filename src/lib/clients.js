/**
 * clients.js
 *
 * Client management — default list + localStorage persistence.
 * Each client is fully isolated: their own slides and generated deck.
 */

export const DEFAULT_CLIENTS = [
  { id: 'a-duie-pyle',   name: 'A. Duie Pyle' },
  { id: 'client-b',      name: 'Client B' },
  { id: 'client-c',      name: 'Client C' },
]

const CLIENTS_KEY = 'pres-builder:clients'

export function loadClients() {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_CLIENTS
  } catch {
    return DEFAULT_CLIENTS
  }
}

export function saveClients(clients) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients))
}

/** Storage key for a specific client's slides */
export function slidesKey(clientId) {
  return `pres-builder:slides:${clientId}`
}

/** Generate a URL-safe id from a display name */
export function nameToId(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}