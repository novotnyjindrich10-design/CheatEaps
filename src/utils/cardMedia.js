import { resolveDetailHero } from './placePhoto.js'

/** Karta používá stejné pořadí zdrojů jako detail. */
export function resolveCardMedia(restaurant) {
  return resolveDetailHero(restaurant)
}
