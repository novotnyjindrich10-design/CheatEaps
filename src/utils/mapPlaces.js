import { BRNO_BOUNDS, hasVerifiedCoordinates } from './geo.js'
import { formatCardPrice } from './price.js'

/** Brno střed — výchozí viewport mapy. */
export const BRNO_MAP_CENTER = Object.freeze({ lat: 49.1951, lon: 16.6068 })
export const BRNO_MAP_DEFAULT_ZOOM = 12

/** Volnější rám kolem Brna — mapa se neodscrolluje do Prahy, ale jde mírně oddálit. */
export const BRNO_MAP_MAX_BOUNDS = Object.freeze([
  [BRNO_BOUNDS.minLat - 0.08, BRNO_BOUNDS.minLon - 0.12],
  [BRNO_BOUNDS.maxLat + 0.08, BRNO_BOUNDS.maxLon + 0.12],
])

/** Stabilní otisk sad bodů — fitBounds jen když se množina ID změní. */
export function placesFingerprint(places) {
  if (!places?.length) return ''
  return places
    .map((place) => place.id)
    .filter(Boolean)
    .sort()
    .join('|')
}

/**
 * Body pro mapu z už filtrovaného seznamu.
 * Neplatné / mimo Brno souřadnice vynechá.
 */
export function placesForMap(restaurants) {
  if (!Array.isArray(restaurants)) return []
  const out = []
  for (const place of restaurants) {
    if (!place?.id || !hasVerifiedCoordinates(place)) continue
    const price = formatCardPrice(place)
    out.push({
      id: place.id,
      name: String(place.name || '').trim() || place.id,
      address: String(place.address || '').trim(),
      lat: place.lat,
      lon: place.lon,
      category: place.category || '',
      sponsored: Boolean(place.sponsored || place.placement === 'sponsored'),
      priceFrom: place.priceFrom ?? place.price ?? null,
      priceVerified: Boolean(place.priceVerified),
      priceLabel: price.primary !== '—' ? price.primary : '',
      priceStatus: price.status || '',
    })
  }
  return out
}

export function boundsFromPlaces(places) {
  if (!places?.length) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const place of places) {
    minLat = Math.min(minLat, place.lat)
    maxLat = Math.max(maxLat, place.lat)
    minLon = Math.min(minLon, place.lon)
    maxLon = Math.max(maxLon, place.lon)
  }
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite)) return null
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ]
}
