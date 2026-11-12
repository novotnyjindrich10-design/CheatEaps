import { hasVerifiedCoordinates } from './geo.js'

/** Brno střed — výchozí viewport mapy. */
export const BRNO_MAP_CENTER = Object.freeze({ lat: 49.1951, lon: 16.6068 })
export const BRNO_MAP_DEFAULT_ZOOM = 12

/**
 * Body pro mapu z už filtrovaného seznamu.
 * Neplatné / mimo Brno souřadnice vynechá.
 */
export function placesForMap(restaurants) {
  if (!Array.isArray(restaurants)) return []
  const out = []
  for (const place of restaurants) {
    if (!place?.id || !hasVerifiedCoordinates(place)) continue
    out.push({
      id: place.id,
      name: String(place.name || '').trim() || place.id,
      address: String(place.address || '').trim(),
      lat: place.lat,
      lon: place.lon,
      category: place.category || '',
      sponsored: Boolean(place.sponsored || place.placement === 'sponsored'),
      priceFrom: place.priceFrom ?? null,
      priceVerified: Boolean(place.priceVerified),
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
