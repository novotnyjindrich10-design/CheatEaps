/**
 * Vstupní bod dat restaurací.
 * Seznam podniků: src/data/demoRestaurants.js + schválené podniky z publishedCatalog.
 */
export { DATA_SOURCE_NOTES, DEMO_DATA_NOTICE, demoRestaurants as restaurants } from './demoRestaurants'

import { demoRestaurants } from './demoRestaurants'
import { getPublishedExtras, subscribePublished } from './publishedCatalog.js'
import { mapsDirectionsUrl } from '../utils/googleRating'

export { subscribePublished }

export function listRestaurants() {
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

export function getRestaurantById(id) {
  const needle = decodeURIComponent(String(id ?? ''))
  return listRestaurants().find((r) => String(r.id) === needle)
}

/** Trasa na podnik. Odkaz na profil nebo hledání je zvlášť. */
export function mapsNavigateUrl(restaurant) {
  return mapsDirectionsUrl(restaurant)
}
