export const RECENT_VIEWS_KEY = 'cheapeats.views.recent.v1'
const MAX = 12

function readRaw() {
  try {
    const raw = localStorage.getItem(RECENT_VIEWS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(ids) {
  try {
    localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(ids))
    return true
  } catch {
    return false
  }
}

export function listRecentViews() {
  return readRaw()
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, MAX)
}

export function rememberRecentView(restaurantId) {
  const id = String(restaurantId || '').trim()
  if (!id) return listRecentViews()
  const next = [id, ...listRecentViews().filter((item) => item !== id)].slice(0, MAX)
  writeRaw(next)
  return next
}
