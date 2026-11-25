export const RECENT_SEARCHES_KEY = 'cheapeats.search.recent.v1'
const MAX = 8

function readRaw() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(items) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

export function listRecentSearches() {
  return readRaw()
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, MAX)
}

export function rememberRecentSearch(query) {
  const value = String(query || '').trim().slice(0, 80)
  if (value.length < 2) return listRecentSearches()
  const next = [value, ...listRecentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(
    0,
    MAX,
  )
  writeRaw(next)
  return next
}

export function clearRecentSearches() {
  writeRaw([])
  return []
}

export function removeRecentSearch(query) {
  const value = String(query || '').trim().toLowerCase()
  const next = listRecentSearches().filter((item) => item.toLowerCase() !== value)
  writeRaw(next)
  return next
}
