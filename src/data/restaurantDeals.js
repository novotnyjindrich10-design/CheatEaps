/**
 * Veřejný katalog slev. Bez kódů, bez postupu uplatnění a bez zdrojové URL.
 * Tyhle údaje vrací jen server po přihlášení (src/server/dealPrivate.js).
 * Nabídku vypneš tím, že dáš active: false, nebo ji ze seznamu smažeš.
 */

const KFC = [
  'kfc-rasinova-2',
  'kfc-masarykova-39',
  'kfc-videnska-132-100',
  'kfc-netroufalky-770-16',
]

const MCDONALDS = ['mcdonald-s-masarykova-32', 'mcdonald-s-namesti-svobody-19']

const BURGER_KING = [
  'burger-king-u-dalnice-777',
  'burger-king-nadrazni-10',
  'burger-king-ceska-142-29',
  'burger-king-videnska-132-100',
  'burger-king-netroufalky-770',
]

const BAGETERIE = [
  'bageterie-boulevard-masarykova-7',
  'bageterie-boulevard-netroufalky-770-16',
  'bageterie-boulevard-vankovka',
]

const CHECKED_AT = '2026-10-29'

/** @type {const} */
const OFFERS = [
  {
    offerId: 'kfc-isic-twister',
    benefitType: 'student',
    headline: 'ISIC: 2× Twister za 149 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: KFC,
  },
  {
    offerId: 'kfc-isic-qurrito',
    benefitType: 'student',
    headline: 'ISIC: Qurrito a hranolky 80 g za 100 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: KFC,
  },
  {
    offerId: 'kfc-isic-cheeseburger',
    benefitType: 'student',
    headline: 'ISIC: Cheeseburger za 35 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: KFC,
  },
  {
    offerId: 'mcdonalds-isic-mcmenu',
    benefitType: 'student',
    headline: 'ISIC: velké McMenu za 155 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'mcdonalds-isic-mcmuffin',
    benefitType: 'student',
    headline: 'ISIC: McMuffin se slaninou a vajíčkem menu za 89 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'mcdonalds-isic-mccafe',
    benefitType: 'student',
    headline: 'ISIC: Café latte 0,3 l nebo cappuccino 0,2 l za 55 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'burger-king-isic-steakhouse',
    benefitType: 'student',
    headline: 'ISIC: Steakhouse menu za 189 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: BURGER_KING,
  },
  {
    offerId: 'burger-king-isic-chicken',
    benefitType: 'student',
    headline: 'ISIC: kuřecí combo za 129 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: BURGER_KING,
  },
  {
    offerId: 'ugo-isic-fresh',
    benefitType: 'student',
    headline: 'ISIC: fresh č. 9, 0,3 l za 79 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['ugo-cimburkova-4', 'ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-salad',
    benefitType: 'student',
    headline: 'ISIC: salátové menu od 165 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-bowl',
    benefitType: 'student',
    headline: 'ISIC: bowl menu kuře 189 Kč nebo losos 209 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-grill',
    benefitType: 'student',
    headline: 'ISIC: grill menu za 129 Kč',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'starbucks-isic-upsize',
    benefitType: 'student',
    headline: 'ISIC: nápoj Venti za cenu Grande',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['starbucks-namesti-svobody-5'],
  },
  {
    offerId: 'starbucks-isic-venti-bogo',
    benefitType: 'bogo',
    headline: 'Dva nápoje Venti, levnější zdarma',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'listed',
    validFrom: null,
    validUntil: '2026-11-17',
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: ['starbucks-namesti-svobody-5'],
  },
  {
    offerId: 'bageterie-isic-app',
    benefitType: 'loyalty',
    headline: 'Studentská nabídka v aplikaci Bageterie Boulevard',
    studentOnly: true,
    requiresLoyaltyApp: true,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    active: true,
    discountPercent: null,
    percentBase: '',
    restaurantIds: BAGETERIE,
  },
]

export function todayIso(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(date)
}

export function isDealListable(deal, date = new Date()) {
  if (!deal || deal.active === false) return false
  if (deal.verification !== 'listed' && deal.verification !== 'verified') return false
  const today = todayIso(date)
  if (deal.validFrom && today < deal.validFrom) return false
  if (deal.validUntil && today > deal.validUntil) return false
  return true
}

function expand(offer) {
  return offer.restaurantIds.map((restaurantId) => ({
    id: `${offer.offerId}--${restaurantId}`,
    offerId: offer.offerId,
    restaurantId,
    benefitType: offer.benefitType,
    headline: offer.headline,
    studentOnly: offer.studentOnly,
    requiresLoyaltyApp: offer.requiresLoyaltyApp,
    verification: offer.verification,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    active: offer.active,
    discountPercent: offer.discountPercent,
    percentBase: offer.percentBase,
    checkedAt: CHECKED_AT,
  }))
}

export function allDealRows() {
  return OFFERS.flatMap(expand)
}

export function publicDeals(date = new Date()) {
  return allDealRows().filter((deal) => isDealListable(deal, date))
}

export function publicDealById(id, date = new Date()) {
  return publicDeals(date).find((deal) => deal.id === id) ?? null
}

export function publicDealsForRestaurant(restaurantId, date = new Date()) {
  return publicDeals(date).filter((deal) => deal.restaurantId === restaurantId)
}

export function restaurantHasPublicDeal(restaurantId, date = new Date()) {
  return publicDealsForRestaurant(restaurantId, date).length > 0
}

const searchCache = new Map()

export function publicDealSearchText(restaurantId, date = new Date()) {
  const day = todayIso(date)
  if (!searchCache.has(day)) {
    const map = new Map()
    for (const deal of publicDeals(date)) {
      const badges = dealBadgeLabels(deal).join(' ')
      const prev = map.get(deal.restaurantId) ?? ''
      map.set(deal.restaurantId, `${prev} ${deal.headline} ${badges}`.trim())
    }
    searchCache.set(day, map)
  }
  return searchCache.get(day).get(restaurantId) ?? ''
}

/** Štítky, které karta smí ukázat. Procento jen při doloženém základu. */
export function dealBadgeLabels(deal) {
  if (!deal) return []
  const labels = []
  const percent = deal.discountPercent
  const base = typeof deal.percentBase === 'string' ? deal.percentBase.trim() : ''
  if ((percent === 10 || percent === 20) && base) labels.push(`−${percent} %`)
  if (deal.benefitType === 'bogo') labels.push('1+1 zdarma')
  if (deal.studentOnly) labels.push('Studentská sleva')
  if (deal.requiresLoyaltyApp) labels.push('Věrnostní výhoda')
  return labels
}

export function dealBadgesForRestaurant(restaurantId, date = new Date()) {
  const deals = publicDealsForRestaurant(restaurantId, date)
  const seen = new Set()
  const badges = []
  for (const deal of deals) {
    for (const label of dealBadgeLabels(deal)) {
      if (seen.has(label)) continue
      seen.add(label)
      const matching = deals.filter((item) => dealBadgeLabels(item).includes(label))
      badges.push({
        label,
        count: matching.length,
        dealId: matching[0].id,
      })
    }
  }
  return badges
}

export function dealValidityNote(deal) {
  if (!deal) return ''
  if (deal.verification !== 'verified' || !deal.validFrom || !deal.validUntil) {
    return 'Platnost nebyla plně ověřena. Tohle není garantovaná aktivní sleva.'
  }
  return ''
}

export function dealOfferIds() {
  return OFFERS.map((offer) => offer.offerId)
}
