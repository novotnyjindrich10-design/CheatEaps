import { getVerifiedPriceFloor } from './price.js'
import { haversineKm, hasVerifiedCoordinates } from './geo.js'
import { getRestaurantCategory } from './restaurantTags.js'

/**
 * Podobné podniky: stejná kategorie, blížší ověřená cena a kratší vzdušná vzdálenost
 * jen rozhodují pořadí. Bez stejné kategorie nic nevrací. Stejné ID vynechá.
 */
export function similarRestaurants(restaurants, current, limit = 6) {
  if (!current?.id) return []
  const category = getRestaurantCategory(current)
  if (!category || category === 'neuvedeno') return []
  const price = getVerifiedPriceFloor(current)
  const origin = hasVerifiedCoordinates(current) ? current : null
  const cap = Math.max(0, limit)
  const ranked = []

  for (const other of restaurants || []) {
    if (!other?.id || other.id === current.id) continue
    if (getRestaurantCategory(other) !== category) continue
    let score = 6
    const otherPrice = getVerifiedPriceFloor(other)
    if (price != null && otherPrice != null) {
      const diff = Math.abs(price - otherPrice)
      if (diff <= 30) score += 3
      else if (diff <= 60) score += 1
    }
    if (origin && hasVerifiedCoordinates(other)) {
      const km = haversineKm(origin.lat, origin.lon, other.lat, other.lon)
      if (km <= 1.2) score += 3
      else if (km <= 3) score += 1
    }
    ranked.push({ other, score })
  }

  ranked.sort(
    (a, b) => b.score - a.score || String(a.other.name).localeCompare(String(b.other.name), 'cs'),
  )
  return ranked.slice(0, cap).map((item) => item.other)
}
