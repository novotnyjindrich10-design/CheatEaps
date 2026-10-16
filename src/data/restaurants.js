/**
 * Vstupní bod dat restaurací.
 * Seznam podniků: src/data/demoRestaurants.js (ověřené brněnské provozovny).
 */
export { DATA_SOURCE_NOTES, DEMO_DATA_NOTICE, demoRestaurants as restaurants } from './demoRestaurants'

import { demoRestaurants } from './demoRestaurants'
import { mapsDirectionsUrl } from '../utils/googleRating'

export function getRestaurantById(id) {
  const needle = decodeURIComponent(String(id ?? ''))
  return demoRestaurants.find((r) => String(r.id) === needle)
}

/** Trasa na podnik. Odkaz na profil nebo hledání je zvlášť. */
export function mapsNavigateUrl(restaurant) {
  return mapsDirectionsUrl(restaurant)
}
