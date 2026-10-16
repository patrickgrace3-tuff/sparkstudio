import { api } from './apiClient.js'
import { DEPARTMENTS } from './constants.js'

// The latest Market Research deck (uploaded by admins) is added automatically
// to the start of the Marketing section of every generated presentation, for
// every client. Its slides are used exactly as stored — never rewritten by AI.

export const MARKET_RESEARCH_DEPT_ID = 'marketing'

// Newest deck with its slides, or null if none has been uploaded
export async function fetchLatestMarketResearch() {
  const decks = await api.getMarketResearchDecks()
  if (!decks?.length) return null
  return api.getMarketResearchDeck(decks[0].id)
}

// ── Per-client copy ───────────────────────────────────────────────────────────
// A client can edit its own copy of the latest deck without changing the admin
// version. Stored in client_data under 'marketresearch' as
// { deckId, deckName, slides, updatedAt }. A copy only applies to the deck it
// was made from — when admins upload a newer deck, clients get the new one.
export const CLIENT_MR_KEY = 'marketresearch'

export async function fetchClientMarketResearchCopy(clientId) {
  const res = await api.getClientData(clientId, CLIENT_MR_KEY)
  const v = res?.value
  return v?.deckId && Array.isArray(v.slides) ? v : null
}

export function saveClientMarketResearchCopy(clientId, deck, slides) {
  const value = { deckId: deck.id, deckName: deck.name, slides, updatedAt: new Date().toISOString() }
  return api.setClientData(clientId, CLIENT_MR_KEY, value).then(() => value)
}

export function clearClientMarketResearchCopy(clientId) {
  return api.setClientData(clientId, CLIENT_MR_KEY, null)
}

// The deck a client's presentation should use: its own copy of the latest
// deck when it has one, otherwise the admin version
export async function fetchMarketResearchForClient(clientId) {
  const deck = await fetchLatestMarketResearch()
  if (!deck) return null
  let copy = null
  try { copy = clientId ? await fetchClientMarketResearchCopy(clientId) : null } catch { /* fall back to admin version */ }
  return copy?.deckId === deck.id ? { ...deck, slides: copy.slides, customised: true } : deck
}

export function marketResearchDeckSlides(mrDeck) {
  const dept = DEPARTMENTS.find(d => d.id === MARKET_RESEARCH_DEPT_ID)?.name ?? 'Marketing'
  return (mrDeck?.slides ?? []).map((s, i) => ({
    title:   s.title,
    bullets: s.bullets ?? [],
    body:    s.body ?? (s.bullets ?? []).join('\n'),
    table:   s.table ?? null,
    notes:   s.notes ?? '',
    source:  s.source ?? '',
    freeTextBoxes:    s.freeTextBoxes ?? null,
    extraBulletBoxes: s.extraBulletBoxes ?? null,
    style:   s.style ?? {},
    dept,
    sourceId: `mr-${mrDeck.id}-${i}`,
    _marketResearch: mrDeck.id,
  }))
}

export const withoutMarketResearch = slides => (slides ?? []).filter(s => !s._marketResearch)

// Inserts the slides at the start of the Marketing section, keeping the deck's
// department order (before the first slide of any later department if
// Marketing has no slides of its own).
export function insertMarketResearch(slides, mrSlides) {
  const base = withoutMarketResearch(slides)
  if (!mrSlides.length) return base
  const deptName = mrSlides[0].dept
  const rank = name => {
    const i = DEPARTMENTS.findIndex(d => d.name === name)
    return i === -1 ? Infinity : i
  }
  const mrRank = rank(deptName)
  let at = base.findIndex(s => s.dept === deptName)
  if (at === -1) at = base.findIndex(s => rank(s.dept) > mrRank)
  if (at === -1) at = base.length
  return [...base.slice(0, at), ...mrSlides, ...base.slice(at)]
}
