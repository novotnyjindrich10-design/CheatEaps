export const FILTER_PREFS_KEY = 'cheapeats.filters.prefs.v1'

const ALLOWED = new Set([
  'maxBudget',
  'cuisineType',
  'maxDistance',
  'sortBy',
  'veganOnly',
  'vegetarianOnly',
  'verifiedPricesOnly',
  'hoursOnly',
  'openNowOnly',
  'view',
])

export function readFilterPrefs() {
  try {
    const raw = localStorage.getItem(FILTER_PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const out = {}
    for (const key of ALLOWED) {
      if (key in parsed) out[key] = parsed[key]
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

/** Uloží jen bezpečné preference (bez volného textu hledání a deals). */
export function writeFilterPrefs(filters = {}) {
  const payload = {}
  for (const key of ALLOWED) {
    if (filters[key] !== undefined && filters[key] !== '' && filters[key] !== false) {
      payload[key] = filters[key]
    }
  }
  try {
    if (Object.keys(payload).length === 0) {
      localStorage.removeItem(FILTER_PREFS_KEY)
      return null
    }
    localStorage.setItem(FILTER_PREFS_KEY, JSON.stringify(payload))
    return payload
  } catch {
    return null
  }
}
