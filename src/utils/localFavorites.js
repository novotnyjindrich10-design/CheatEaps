/** Guest oblíbené v localStorage. Auth sync zůstává na /api/favorites. */

export const LOCAL_FAVORITES_KEY = 'cheapeats.favorites.v1'

function readRaw() {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(ids) {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(ids))
    return true
  } catch {
    return false
  }
}

export function normalizeFavoriteIds(ids, { exists } = {}) {
  const seen = new Set()
  const out = []
  for (const value of ids || []) {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) continue
    if (typeof exists === 'function' && !exists(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function listLocalFavorites({ exists } = {}) {
  return normalizeFavoriteIds(readRaw(), { exists })
}

export function isLocalFavorite(restaurantId, { exists } = {}) {
  const id = String(restaurantId || '').trim()
  if (!id) return false
  return listLocalFavorites({ exists }).includes(id)
}

export function toggleLocalFavorite(restaurantId, { exists } = {}) {
  const id = String(restaurantId || '').trim()
  if (!id) return { ok: false, ids: listLocalFavorites({ exists }), message: 'Neplatné ID.' }
  if (typeof exists === 'function' && !exists(id)) {
    return { ok: false, ids: listLocalFavorites({ exists }), message: 'Podnik v katalogu není.' }
  }
  const current = listLocalFavorites({ exists })
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  if (!writeRaw(next)) {
    return { ok: false, ids: current, message: 'Úložiště prohlížeče není dostupné.' }
  }
  return { ok: true, ids: next, favorite: next.includes(id) }
}

export function removeMissingLocalFavorites(exists) {
  const cleaned = listLocalFavorites({ exists })
  writeRaw(cleaned)
  return cleaned
}
