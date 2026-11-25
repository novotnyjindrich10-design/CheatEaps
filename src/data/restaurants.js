/**
 * Vstupní bod dat restaurací.
 * Těžký katalog se načítá async přes catalogLoader (ne v kritické cestě úvodu).
 */
export { DATA_SOURCE_NOTES, DEMO_DATA_NOTICE } from './sourceNotes.js'
export { loadDemoRestaurants, getCachedDemoRestaurants } from './catalogLoader.js'

import { getCachedDemoRestaurants, loadDemoRestaurants } from './catalogLoader.js'
import { getPublishedExtras, subscribePublished } from './publishedCatalog.js'
import { mapsDirectionsUrl } from '../utils/googleRating.js'

export { subscribePublished }

export function listRestaurants() {
  const demoRestaurants = getCachedDemoRestaurants() || []
  const extras = getPublishedExtras()
  if (!extras.length) return demoRestaurants
  const seen = new Set(demoRestaurants.map((r) => r.id))
  const merged = [...demoRestaurants]
  for (const place of extras) {
    if (!place?.id || seen.has(place.id)) continue
    seen.add(place.id)
    merged.push(place)
  }
  return merged
}

/** Kompatibilita se starším `import { restaurants }`. Po načtení katalogu je to živý getter. */
export function getRestaurantsSnapshot() {
  return listRestaurants()
}

export function getRestaurantById(id) {
  const needle = decodeURIComponent(String(id ?? ''))
  return listRestaurants().find((r) => String(r.id) === needle)
}

/** Trasa na podnik. Odkaz na profil nebo hledání je zvlášť. */
export function mapsNavigateUrl(restaurant) {
  return mapsDirectionsUrl(restaurant)
}

export async function ensureRestaurantsLoaded() {
  await loadDemoRestaurants()
  return listRestaurants()
}
