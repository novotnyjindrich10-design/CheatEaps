/** Práce s doloženou cenou a označeným odhadem. */

export const PRICE_KIND_MENU = 'menu'
export const PRICE_KIND_RANGE = 'range'
export const PRICE_KIND_ESTIMATE = 'estimate'

export function hasVerifiedPrice(restaurant) {
  if (restaurant?.priceKind === PRICE_KIND_ESTIMATE) return false
  if (!restaurant?.priceKind || !restaurant.priceSource || !restaurant.priceVerifiedAt) {
    return false
  }
  if (typeof restaurant.price !== 'number') return false
  if (restaurant.priceKind === PRICE_KIND_RANGE) {
    return typeof restaurant.priceMax === 'number' && restaurant.priceMax >= restaurant.price
  }
  return restaurant.priceKind === PRICE_KIND_MENU
}

export function hasEstimatePrice(restaurant) {
  if (restaurant?.priceKind !== PRICE_KIND_ESTIMATE) return false
  if (typeof restaurant.price !== 'number') return false
  if (typeof restaurant.priceMax !== 'number' || restaurant.priceMax < restaurant.price) return false
  return true
}

/**
 * Nejnižší doložená cena pro filtr rozpočtu.
 * U menu je to konkrétní cena, u ověřeného rozmezí dolní mez v `price`.
 * Neověřený odhad vrací null. Z jiných polí se cena neodvozuje.
 */
export function getBudgetComparePrice(restaurant) {
  if (!hasVerifiedPrice(restaurant)) return null
  return restaurant.price
}

/** Horní doložená cena. Řazení a štítek „Do 120 Kč“. */
export function getVerifiedPriceCeiling(restaurant) {
  if (!hasVerifiedPrice(restaurant)) return null
  if (restaurant.priceKind === PRICE_KIND_RANGE) return restaurant.priceMax
  return restaurant.price
}

function sortKey(restaurant) {
  if (hasVerifiedPrice(restaurant)) {
    return { tier: 0, value: getVerifiedPriceCeiling(restaurant) }
  }
  if (hasEstimatePrice(restaurant)) {
    return { tier: 1, value: restaurant.price }
  }
  return { tier: 2, value: Number.POSITIVE_INFINITY }
}

/** Řazení: nejdřív ověřené, potom odhady, chybějící nakonec. */
export function compareByPrice(a, b, direction = 'asc') {
  const sa = sortKey(a)
  const sb = sortKey(b)
  if (sa.tier !== sb.tier) return sa.tier - sb.tier
  return direction === 'desc' ? sb.value - sa.value : sa.value - sb.value
}

function amountText(restaurant) {
  if (hasVerifiedPrice(restaurant) || hasEstimatePrice(restaurant)) {
    if (
      restaurant.priceKind === PRICE_KIND_RANGE ||
      restaurant.priceKind === PRICE_KIND_ESTIMATE
    ) {
      return `${restaurant.price}–${restaurant.priceMax} Kč`
    }
    return `${restaurant.price} Kč`
  }
  return '—'
}

/** Krátká cena na kartě. Status až v detailu. Odhad jen vizuálně (~). */
export function formatCardPrice(restaurant) {
  if (hasVerifiedPrice(restaurant)) {
    return { primary: amountText(restaurant), tone: 'verified' }
  }
  if (hasEstimatePrice(restaurant)) {
    return { primary: `~${amountText(restaurant)}`, tone: 'estimate' }
  }
  return { primary: '—', tone: 'missing' }
}

/** Plný popis ceny v detailu podniku. */
export function formatPlacePrice(restaurant) {
  if (hasVerifiedPrice(restaurant)) {
    const delivery = restaurant.priceChannel === 'delivery'
    const item = restaurant.priceItem ? restaurant.priceItem : '1 hlavní jídlo'
    return {
      primary: amountText(restaurant),
      statusLabel: delivery ? 'Cena z rozvozu' : 'Ověřená cena',
      caption: item,
      tone: 'verified',
    }
  }

  if (hasEstimatePrice(restaurant)) {
    const low = restaurant.priceConfidence === 'low'
    return {
      primary: amountText(restaurant),
      statusLabel: 'Odhad ceny',
      caption: low
        ? 'Orientační odhad · nízká jistota'
        : 'Orientační hodnota, ne ověřené menu',
      tone: 'estimate',
    }
  }

  return { primary: '—', statusLabel: 'Cena', caption: 'Cena neověřena', tone: 'missing' }
}

export function derivePriceCategory(amount) {
  if (typeof amount !== 'number') return undefined
  if (amount <= 120) return 'budget'
  if (amount <= 200) return 'standard'
  return 'premium'
}
