/**
 * Datový model denních / studentských nabídek.
 * Veřejný katalog zatím neplníme falešnými položkami — jen struktura a helpery.
 */

/**
 * @typedef {object} DailyMenuItem
 * @property {string} id
 * @property {string} restaurantId
 * @property {string} title
 * @property {number|null} priceCzk
 * @property {string} validOn ISO date YYYY-MM-DD (Europe/Prague calendar day)
 * @property {string} source
 * @property {boolean} verified
 * @property {string} [expiresAt] ISO datetime
 * @property {string} [note]
 */

/** @type {DailyMenuItem[]} */
export const publishedDailyMenus = []

export function isDailyMenuFresh(item, now = new Date()) {
  if (!item?.verified) return false
  if (!item.validOn || !/^\d{4}-\d{2}-\d{2}$/.test(item.validOn)) return false
  if (item.expiresAt) {
    const exp = Date.parse(item.expiresAt)
    if (!Number.isFinite(exp) || exp <= now.getTime()) return false
  }
  const pragueDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return item.validOn === pragueDay
}

export function dailyMenusForRestaurant(restaurantId, { includeUnverified = false } = {}) {
  const id = String(restaurantId || '').trim()
  return publishedDailyMenus.filter((item) => {
    if (item.restaurantId !== id) return false
    if (!includeUnverified && !isDailyMenuFresh(item)) return false
    return true
  })
}
