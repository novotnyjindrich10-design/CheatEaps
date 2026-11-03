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
 * Na jedné stránce se stejná fotka neopakuje, dokud má téma aspoň dva snímky.
 * Detail bez předaného id zůstává u stabilního přiřazení.
 */
export function varyPixabayOnPage(restaurants) {
  if (!pixabayLibraryReady || !Array.isArray(restaurants) || restaurants.length < 2) {
    return restaurants
  }
  const recent = []
  let changed = false
  const next = restaurants.map((restaurant) => {
    if (restaurant?.foodIllustrationKind !== 'pixabay') return restaurant
    if (Number.isInteger(pixabayManualPhotoByPlaceId[restaurant.id])) {
      recent.push(restaurant.foodIllustrationPixabayId)
      return restaurant
    }
    const theme = restaurant.foodIllustrationTheme
    const pool = pixabayIdsByTheme[theme] || []
    const current = restaurant.foodIllustrationPixabayId
    if (pool.length < 2 || !Number.isInteger(current)) return restaurant
    const start = pool.indexOf(current)
    const order = start >= 0 ? pool.slice(start).concat(pool.slice(0, start)) : [current]
    const gap = Math.max(1, pool.length - 1)
    const blocked = new Set(recent.slice(-gap))
    const pick = order.find((id) => !blocked.has(id)) || current
    recent.push(pick)
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
