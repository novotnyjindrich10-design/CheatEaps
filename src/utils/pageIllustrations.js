import {
  illustrationFromPhoto,
  pixabayIdsByTheme,
  pixabayLibraryReady,
  pixabayPhotosById,
} from '../data/pixabayLibrary.js'
import { pixabayManualPhotoByPlaceId } from '../data/pixabayManualPicks.js'

function withPhoto(restaurant, photoId) {
  const fields = illustrationFromPhoto(pixabayPhotosById[photoId])
  if (!fields) return restaurant
  return { ...restaurant, ...fields }
}

/**
 * Na jedné stránce se stejná fotka neopakuje, dokud má téma volné snímky.
 * Preferuje katalogové přiřazení; když by se na stránce opakovalo, vezme
 * další snímek ze stejného tématu. Ruční výjimky nemění.
 * Výsledek je deterministický pro dané pořadí restaurací na stránce.
 */
export function varyPixabayOnPage(restaurants) {
  if (!pixabayLibraryReady || !Array.isArray(restaurants) || restaurants.length < 2) {
    return restaurants
  }
  const usedOnPage = new Set()
  let changed = false
  const next = restaurants.map((restaurant) => {
    if (restaurant?.foodIllustrationKind !== 'pixabay') return restaurant
    if (Number.isInteger(pixabayManualPhotoByPlaceId[restaurant.id])) {
      usedOnPage.add(restaurant.foodIllustrationPixabayId)
      return restaurant
    }
    const theme = restaurant.foodIllustrationTheme
    const pool = pixabayIdsByTheme[theme] || []
    const current = restaurant.foodIllustrationPixabayId
    if (pool.length < 2 || !Number.isInteger(current)) {
      if (Number.isInteger(current)) usedOnPage.add(current)
      return restaurant
    }
    const start = pool.indexOf(current)
    const order = start >= 0 ? pool.slice(start).concat(pool.slice(0, start)) : [current, ...pool]
    const pick = order.find((id) => !usedOnPage.has(id)) || current
    usedOnPage.add(pick)
    if (pick === current) return restaurant
    changed = true
    return withPhoto(restaurant, pick)
  })
  return changed ? next : restaurants
}

/** Převezme jen id, které patří do stejného tematického fondu. */
export function applyPixabayChoice(restaurant, photoId) {
  const id = Number(photoId)
  if (!restaurant || !Number.isInteger(id) || id <= 0) return restaurant
  if (restaurant.foodIllustrationKind !== 'pixabay') return restaurant
  if (Number.isInteger(pixabayManualPhotoByPlaceId[restaurant.id])) return restaurant
  const pool = pixabayIdsByTheme[restaurant.foodIllustrationTheme] || []
  if (!pool.includes(id)) return restaurant
  return withPhoto(restaurant, id)
}
