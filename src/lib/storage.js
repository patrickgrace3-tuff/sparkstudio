/**
 * storage.js — per-client slide persistence
 */

import { slidesKey } from './clients.js'

export function loadSlides(clientId) {
  try {
    const raw = localStorage.getItem(slidesKey(clientId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveSlides(clientId, slides) {
  try {
    localStorage.setItem(slidesKey(clientId), JSON.stringify(slides))
  } catch (err) {
    console.error('[storage] Failed to save slides:', err)
  }
}

export function clearSlides(clientId) {
  localStorage.removeItem(slidesKey(clientId))
}