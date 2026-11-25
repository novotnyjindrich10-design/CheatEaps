/**
 * Asynchronní načtení katalogu — ať se ~1 MB dat nestahuje/neparsují
 * v kritické cestě úvodní stránky (modulepreload).
 */
let catalogCache = null
let catalogPromise = null

export function getCachedDemoRestaurants() {
  return catalogCache
}

export function loadDemoRestaurants() {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (!catalogPromise) {
    catalogPromise = import('./demoRestaurants.js')
      .then((mod) => {
        catalogCache = mod.demoRestaurants
        return catalogCache
      })
      .catch((error) => {
        catalogPromise = null
        throw error
      })
  }
  return catalogPromise
}

/** Testy / SSR mohou cache naplnit synchronně. */
export function primeDemoRestaurantsCache(list) {
  catalogCache = Array.isArray(list) ? list : null
  catalogPromise = catalogCache ? Promise.resolve(catalogCache) : null
}
