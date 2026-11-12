import { filterAndSortRestaurants } from './filterRestaurants.js'

/**
 * Náhodný výběr z filtrovaných podniků.
 * Sponzorované se nepreferují; pokud padnou, volající je musí označit.
 */
export function surpriseCandidates(restaurants, filters = {}) {
  return filterAndSortRestaurants(restaurants, {
    ...filters,
    sortBy: filters.sortBy || 'name',
    suppressDuplicates: true,
  })
}

export function pickSurpriseRestaurant(restaurants, filters = {}, rng = Math.random) {
  const pool = surpriseCandidates(restaurants, filters)
  if (pool.length === 0) return { restaurant: null, poolSize: 0, index: -1 }
  const index = Math.floor(rng() * pool.length)
  const safeIndex = Math.min(pool.length - 1, Math.max(0, index))
  return { restaurant: pool[safeIndex], poolSize: pool.length, index: safeIndex }
}
