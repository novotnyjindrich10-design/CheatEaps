const PREFIX = 'cheapeats.scroll:'

export function scrollKeyFor(pathWithSearch) {
  return `${PREFIX}${String(pathWithSearch || '')}`
}

export function saveScrollPosition(pathWithSearch, y = typeof window !== 'undefined' ? window.scrollY : 0) {
  try {
    sessionStorage.setItem(scrollKeyFor(pathWithSearch), String(Math.max(0, Math.round(y))))
  } catch {
    /* ignore */
  }
}

export function readScrollPosition(pathWithSearch) {
  try {
    const raw = sessionStorage.getItem(scrollKeyFor(pathWithSearch))
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function clearScrollPosition(pathWithSearch) {
  try {
    sessionStorage.removeItem(scrollKeyFor(pathWithSearch))
  } catch {
    /* ignore */
  }
}
