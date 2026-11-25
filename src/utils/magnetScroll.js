const STORAGE_KEY = 'cheapeats.magnet.v1'

export function readMagnetPreference() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMagnetPreference(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

/** Index karty, jejíž start je ≤ scrollTop (s malou tolerancí). */
export function currentMagnetIndex(offsets, scrollTop) {
  const list = Array.isArray(offsets) ? offsets.map(Number).filter((n) => Number.isFinite(n)) : []
  if (list.length === 0) return 0
  let current = 0
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] <= scrollTop + 12) current = i
  }
  return current
}

/**
 * Index karty po gestu.
 * intentional + direction: jedno běžné gesto = ±1 karta od aktuální.
 * Jinak nejbližší offset k aktuálnímu scrollTop.
 */
export function resolveMagnetIndex({ offsets, scrollTop, direction = 0, intentional = false }) {
  const list = Array.isArray(offsets) ? offsets.map(Number).filter((n) => Number.isFinite(n)) : []
  if (list.length === 0) return 0

  if (intentional && direction !== 0) {
    const current = currentMagnetIndex(list, scrollTop)
    if (direction > 0) return Math.min(list.length - 1, current + 1)
    // Při scrollu nahoru: pokud jsme hluboko v kartě, nejdřív na její začátek.
    if (scrollTop > list[current] + 28) return current
    return Math.max(0, current - 1)
  }

  let nearest = 0
  let nearestDist = Infinity
  for (let i = 0; i < list.length; i += 1) {
    const dist = Math.abs(list[i] - scrollTop)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = i
    }
  }
  return nearest
}

export function measureMagnetOffsets(scroller, itemSelector = '[data-magnet-item]') {
  if (!scroller) return []
  const top = scroller.scrollTop
  const base = scroller.getBoundingClientRect().top
  return [...scroller.querySelectorAll(itemSelector)].map((node) => {
    const rect = node.getBoundingClientRect()
    return Math.max(0, rect.top - base + top)
  })
}

export function scrollMagnetToOffset(scroller, offset, { behavior = 'smooth' } = {}) {
  if (!scroller) return 0
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  const top = Math.min(max, Math.max(0, Math.round(offset)))
  scroller.scrollTo({ top, behavior })
  return top
}

/** Je gesto dost výrazné na přechod o jednu kartu? */
export function isIntentionalMagnetGesture({ deltaY = 0, velocityY = 0, viewportHeight = 640 }) {
  const distanceOk = Math.abs(deltaY) >= Math.max(40, viewportHeight * 0.14)
  const speedOk = Math.abs(velocityY) >= 0.45
  return distanceOk || speedOk
}
