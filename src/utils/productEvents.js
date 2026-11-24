/**
 * Lehký produktový event bus bez externí analytiky.
 * Neposílá data třetím stranám. Mock / preview se nepočítají jako ostré metriky,
 * dokud serverové uložení (např. place-stats) nepotvrdí zápis.
 */

const QUEUE_KEY = 'foodgo.productEvents.v1'
const MAX_QUEUE = 40

const ALLOWED = new Set([
  'restaurant_detail_open',
  'navigation_click',
  'filters_applied',
  'search_submitted',
  'sponsored_impression',
  'sponsored_click',
  'promotion_inquiry_submitted',
  'promotion_order_created',
  'payment_verified',
])

function readQueue() {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(rows) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE)))
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {string} name
 * @param {Record<string, string|number|boolean|undefined>} [props]
 */
export function trackProductEvent(name, props = {}) {
  if (!ALLOWED.has(name)) return
  if (typeof window === 'undefined') return
  const entry = {
    name,
    at: new Date().toISOString(),
    props: Object.fromEntries(
      Object.entries(props || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]),
    ),
  }
  const next = [...readQueue(), entry]
  writeQueue(next)
  try {
    window.dispatchEvent(new CustomEvent('foodgo:product-event', { detail: entry }))
  } catch {
    /* ignore */
  }
}

export function recentProductEvents() {
  return readQueue()
}
