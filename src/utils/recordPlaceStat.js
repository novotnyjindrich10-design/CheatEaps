import { fetchWithTimeout } from './fetchTimeout'

const recent = new Map()

/**
 * Jedna událost na podnik. Detail se v jedné relaci nepočítá znovu.
 * Kliky se ignorují jen při dvojitém stisku. Server pořád odmítne cizí původ.
 */
export function recordPlaceStat(restaurantId, event) {
  const id = String(restaurantId || '').trim()
  const name = String(event || '').trim()
  if (!id || !name || typeof window === 'undefined') return
  const key = `${name}:${id}`
  const now = Date.now()
  if (name === 'profile_view') {
    try {
      const stored = sessionStorage.getItem(`foodgo.stat.${key}`)
      if (stored) return
      sessionStorage.setItem(`foodgo.stat.${key}`, '1')
    } catch {
      if (recent.has(key)) return
    }
  } else if (now - (recent.get(key) || 0) < 1500) {
    return
  }
  recent.set(key, now)
  fetchWithTimeout('/api/place-stats/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ restaurantId: id, event: name }),
  }).catch(() => {})
}
