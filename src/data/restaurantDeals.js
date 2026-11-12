/**
 * Veřejný katalog ověřených slev (správa přes tento soubor).
 *
 * Jak přidat / upravit / vypnout akci:
 * 1. Doplň nebo uprav záznam v OFFERS (a případně restaurantIds).
 * 2. Kód a postup uplatnění drž v src/server/dealPrivate.js (ne ve frontendu).
 * 3. verification: 'verified' = smí se zobrazit; 'listed' / 'unverified' = skryté.
 * 4. active: false okamžitě vypne nabídku.
 * 5. Platnost řídí validFrom / validUntil (Europe/Prague, YYYY-MM-DD).
 * 6. originalPrice / salePrice / discountPercent jen když je zdroj doloží.
 * 7. Po úpravě spusť npm test.
 *
 * Testovací nabídky (TEST_OFFERS) se nikdy neexportují do produkčního katalogu.
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

/** Poslední ruční kontrola oficiálních stránek ISIC.cz (2026-11-04). */
const CHECKED_AT = '2026-11-04'

/**
 * Zdroj u stálých nabídek neuvádí konec. FoodGo je drží aktivní jen do data
 * další kontroly — není to datum konce akce u restaurace.
 */
const RECHECK_UNTIL = '2026-12-04'

const RECHECK_NOTE =
  'Oficiální stránka ISIC neuvádí datum začátku ani konce. FoodGo nabídku znovu ověří nejpozději k datu konce zobrazení v katalogu.'

/** @type {const} */
const OFFERS = [
  {
    offerId: 'kfc-isic-twister',
    benefitType: 'student',
    title: 'ISIC: 2× Twister za 149 Kč',
    description: 'Dva Twistery za zvýhodněnou cenu pro držitele ISIC a ALIVE.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 149,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    checkedAt: CHECKED_AT,
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Platí v restauracích KFC po celé ČR.',
      'Lze využít i online přes Objednej & Vyzvedni (kód až po přihlášení v FoodGo).',
      RECHECK_NOTE,
    ],
    restaurantIds: KFC,
  },
  {
    offerId: 'kfc-isic-qurrito',
    benefitType: 'student',
    title: 'ISIC: Qurrito a hranolky 80 g za 100 Kč',
    description: 'Qurrito s hranolky 80 g za studentskou cenu.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 100,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    checkedAt: CHECKED_AT,
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Qurrito a hranolky 80 g za 100 Kč, KFC po celé ČR.',
      'Lze využít i online přes Objednej & Vyzvedni (kód až po přihlášení).',
      RECHECK_NOTE,
    ],
    restaurantIds: KFC,
  },
  {
    offerId: 'kfc-isic-cheeseburger',
    benefitType: 'student',
    title: 'ISIC: Cheeseburger za 35 Kč',
    description: 'Cheeseburger za studentskou cenu.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 35,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    checkedAt: CHECKED_AT,
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Cheeseburger za 35 Kč, KFC po celé ČR.',
      'Lze využít i online přes Objednej & Vyzvedni (kód až po přihlášení).',
      RECHECK_NOTE,
    ],
    restaurantIds: KFC,
  },
  {
    offerId: 'mcdonalds-isic-mcmenu',
    benefitType: 'student',
    title: 'ISIC: velké McMenu za 155 Kč',
    description: 'Velké McMenu za zvláštní studentskou cenu (ne procento z běžného menu).',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 155,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    checkedAt: CHECKED_AT,
    conditions: [
      'Jednou za den.',
      'Platí na Big Mac, McRoyal, McChicken a 6 ks McNuggets.',
      'Částka je zvláštní cena ze stránky ISIC, ne procento.',
      RECHECK_NOTE,
    ],
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'mcdonalds-isic-mcmuffin',
    benefitType: 'student',
    title: 'ISIC: McMuffin se slaninou a vajíčkem menu za 89 Kč',
    description: 'Snídaňové menu za studentskou cenu.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 89,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    checkedAt: CHECKED_AT,
    conditions: ['Jednou za den.', 'Před zaplacením ukaž platný průkaz ISIC nebo ITIC.', RECHECK_NOTE],
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'mcdonalds-isic-mccafe',
    benefitType: 'student',
    title: 'ISIC: Café latte 0,3 l nebo cappuccino 0,2 l za 55 Kč',
    description: 'McCafé nápoj za studentskou cenu.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 55,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    checkedAt: CHECKED_AT,
    conditions: ['Jednou za den.', 'Před zaplacením ukaž platný průkaz ISIC nebo ITIC.', RECHECK_NOTE],
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'mcdonalds-isic-cheeseburger-menu',
    benefitType: 'student',
    title: 'ISIC: Cheeseburger menu za 109 Kč',
    description: 'Cheeseburger, střední hranolky a střední nápoj 0,4 l.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 109,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    checkedAt: CHECKED_AT,
    conditions: [
      'Jednou za den.',
      'Cheeseburger, střední hranolky a střední nápoj 0,4 l za 109 Kč.',
      RECHECK_NOTE,
    ],
    restaurantIds: MCDONALDS,
  },
  {
    offerId: 'burger-king-isic-steakhouse',
    benefitType: 'student',
    title: 'ISIC: Steakhouse menu za 189 Kč',
    description: 'Steakhouse burger, střední hranolky a bezedný nápoj 0,3 l.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 189,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/burger-king/720',
    checkedAt: CHECKED_AT,
    conditions: [
      'Steakhouse burger, střední hranolky a bezedný nápoj 0,3 l za 189 Kč.',
      'Cena je na anglické verzi záznamu ISIC.',
      'Na pokladně ukaž platný průkaz ISIC.',
      RECHECK_NOTE,
    ],
    restaurantIds: BURGER_KING,
  },
  {
    offerId: 'burger-king-isic-chicken',
    benefitType: 'student',
    title: 'ISIC: kuřecí combo za 129 Kč',
    description: 'Crispy Chicken burger, 6 nugetek a omáčka.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 129,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/burger-king/720',
    checkedAt: CHECKED_AT,
    conditions: [
      'Crispy Chicken burger, 6 nugetek a omáčka za 129 Kč.',
      'Cena je na anglické verzi záznamu ISIC.',
      'Na pokladně ukaž platný průkaz ISIC.',
      RECHECK_NOTE,
    ],
    restaurantIds: BURGER_KING,
  },
  {
    offerId: 'ugo-isic-fresh',
    benefitType: 'student',
    title: 'ISIC: fresh č. 9, 0,3 l za 79 Kč',
    description: 'Drink č. 9 na rovnováhu, 0,3 l.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 79,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    checkedAt: CHECKED_AT,
    conditions: ['Drink č. 9 na rovnováhu, 0,3 l, za 79 Kč.', 'Jednou za den.', RECHECK_NOTE],
    restaurantIds: ['ugo-cimburkova-4', 'ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-salad',
    benefitType: 'student',
    title: 'ISIC: salátové menu od 165 Kč',
    description: 'Salát se zauzeným kuřetem a ledový čaj nebo Rajec.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 165,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    checkedAt: CHECKED_AT,
    conditions: [
      'Salát se zauzeným kuřetem a ledový čaj 0,3 l nebo Rajec 0,33 l, od 165 Kč.',
      'Rajec jen ve vybraných provozovnách.',
      'Jednou za den. Neplatí na letišti v Praze.',
      'Přiřazeno jen salaterii Campus Square, ne freshbaru na Cimburkově.',
      RECHECK_NOTE,
    ],
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-bowl',
    benefitType: 'student',
    title: 'ISIC: bowl menu kuře 189 Kč nebo losos 209 Kč',
    description: 'Poke bowl s nápojem za studentskou cenu.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 189,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    checkedAt: CHECKED_AT,
    conditions: [
      'Poke bowl kuře za 189 Kč nebo losos za 209 Kč, k tomu ledový čaj nebo Rajec.',
      'Jednou za den. Jen salaterie Campus Square.',
      RECHECK_NOTE,
    ],
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'ugo-isic-grill',
    benefitType: 'student',
    title: 'ISIC: grill menu za 129 Kč',
    description: 'Malá polévka, wrap a nápoj.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: 129,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    checkedAt: CHECKED_AT,
    conditions: [
      'Malá polévka, wrap a ledový čaj 0,3 l nebo Rajec 0,33 l za 129 Kč.',
      'Rajec jen ve vybraných provozovnách. Jednou za den.',
      'Neplatí na letišti v Praze. Jen salaterie Campus Square.',
      RECHECK_NOTE,
    ],
    restaurantIds: ['ugo-netroufalky-770-14'],
  },
  {
    offerId: 'starbucks-isic-upsize',
    benefitType: 'student',
    title: 'ISIC: nápoj Venti za cenu Grande',
    description: 'Upsize jakéhokoli nápoje — Venti za cenu Grande.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: RECHECK_UNTIL,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: null,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/starbucks/9265',
    checkedAt: CHECKED_AT,
    conditions: [
      'Nápoj ve velikosti Venti za cenu Grande.',
      'Vlastní kelímek podle stránky ISIC ubere dalších 10 Kč (to není sleva 10 %).',
      'Neplatí ve Starbucks Reserve Jungmannova v Praze.',
      RECHECK_NOTE,
    ],
    restaurantIds: ['starbucks-namesti-svobody-5'],
  },
  {
    offerId: 'starbucks-isic-venti-bogo',
    benefitType: 'bogo',
    title: '1+1 zdarma na nápoje Venti',
    description: 'Dva nápoje Venti, levnější zdarma. Limitovaná nabídka dle ISIC.',
    studentOnly: true,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: null,
    validUntil: '2026-11-17',
    sourceHasEndDate: true,
    active: true,
    originalPrice: null,
    salePrice: null,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/starbucks/9265',
    checkedAt: CHECKED_AT,
    conditions: [
      'Dva nápoje Venti, levnější je zdarma.',
      'Oficiální stránka ISIC uvádí konec 17. 11. 2026.',
      'Nabídka je na stránce ISIC — u pokladny ukaž platný průkaz.',
    ],
    restaurantIds: ['starbucks-namesti-svobody-5'],
  },
  {
    offerId: 'bageterie-isic-app',
    benefitType: 'loyalty',
    title: 'Studentská nabídka v aplikaci Bageterie Boulevard',
    description:
      'ISIC uvádí jen existenci studentské nabídky v aplikaci. Konkrétní částku ani procento neuvádí.',
    studentOnly: true,
    requiresLoyaltyApp: true,
    verification: 'listed',
    validFrom: null,
    validUntil: null,
    sourceHasEndDate: false,
    active: true,
    originalPrice: null,
    salePrice: null,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/bageterie-boulevard/6946',
    checkedAt: CHECKED_AT,
    conditions: [
      'ISIC říká jen to, že studentská nabídka je v aplikaci v sekci kupóny.',
      'Konkrétní částku, procento ani kód web neuvádí — nevymýšlíme je.',
      'Bez doložené ceny a platnosti se nezobrazuje jako aktivní sleva.',
    ],
    restaurantIds: BAGETERIE,
  },
]

/**
 * Jen pro unit testy. Prefix __test__ / test-restaurant — nesmí se dostat do OFFERS.
 * @type {const}
 */
export const TEST_ONLY_OFFERS = [
  {
    offerId: '__test__-active-verified',
    benefitType: 'percent',
    title: 'TEST: aktivní ověřená sleva',
    description: 'Jen pro testy.',
    studentOnly: false,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    sourceHasEndDate: true,
    active: true,
    originalPrice: 200,
    salePrice: 150,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://example.test/oficialni-akce',
    checkedAt: '2026-11-04',
    conditions: ['Testovací podmínka.'],
    restaurantIds: ['__test__-restaurant-a'],
  },
  {
    offerId: '__test__-future',
    benefitType: 'percent',
    title: 'TEST: budoucí sleva',
    description: 'Jen pro testy.',
    studentOnly: false,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: '2027-01-01',
    validUntil: '2027-01-31',
    sourceHasEndDate: true,
    active: true,
    originalPrice: null,
    salePrice: 99,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://example.test/future',
    checkedAt: '2026-11-04',
    conditions: ['Ještě nezačala.'],
    restaurantIds: ['__test__-restaurant-a'],
  },
  {
    offerId: '__test__-expired',
    benefitType: 'percent',
    title: 'TEST: vypršelá sleva',
    description: 'Jen pro testy.',
    studentOnly: false,
    requiresLoyaltyApp: false,
    verification: 'verified',
    validFrom: '2025-01-01',
    validUntil: '2025-06-01',
    sourceHasEndDate: true,
    active: true,
    originalPrice: null,
    salePrice: 50,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://example.test/expired',
    checkedAt: '2026-11-04',
    conditions: ['Už neplatí.'],
    restaurantIds: ['__test__-restaurant-a'],
  },
  {
    offerId: '__test__-unverified',
    benefitType: 'percent',
    title: 'TEST: neověřená sleva',
    description: 'Jen pro testy.',
    studentOnly: false,
    requiresLoyaltyApp: false,
    verification: 'unverified',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    sourceHasEndDate: true,
    active: true,
    originalPrice: null,
    salePrice: 80,
    discountPercent: null,
    percentBase: '',
    sourceUrl: 'https://example.test/unverified',
    checkedAt: '2026-11-04',
    conditions: ['Nesmí se zobrazit.'],
    restaurantIds: ['__test__-restaurant-a'],
  },
]

export const DEALS_EMPTY_MESSAGE =
  'Momentálně nemáme žádné ověřené slevy. Nové nabídky postupně přidáváme.'

const pragueDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' })

export function todayIso(date = new Date()) {
  return pragueDayFormat.format(date)
}

/** Aktivní veřejná sleva: ověřená, zapnutá a v okně platnosti. */
export function isDealListable(deal, date = new Date()) {
  if (!deal || deal.active === false) return false
  if (deal.verification !== 'verified') return false
  if (!deal.sourceUrl || !String(deal.sourceUrl).startsWith('https://')) return false
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
    title: offer.title,
    headline: offer.title,
    description: offer.description || '',
    studentOnly: offer.studentOnly,
    requiresLoyaltyApp: offer.requiresLoyaltyApp,
    verification: offer.verification,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    sourceHasEndDate: Boolean(offer.sourceHasEndDate),
    active: offer.active,
    originalPrice: offer.originalPrice,
    salePrice: offer.salePrice,
    discountPercent: offer.discountPercent,
    percentBase: offer.percentBase,
    sourceUrl: offer.sourceUrl,
    checkedAt: offer.checkedAt || CHECKED_AT,
    conditions: Array.isArray(offer.conditions) ? [...offer.conditions] : [],
  }))
}

export function allDealRows() {
  return OFFERS.flatMap(expand)
}

/** Jen pro testy — expanduje TEST_ONLY_OFFERS. */
export function testOnlyDealRows() {
  return TEST_ONLY_OFFERS.flatMap(expand)
}

/** Denní cache: dřív se při filtru 775 podniků znovu expandovaly všechny nabídky. */
const publicDealsDayCache = new Map()
const publicDealsByRestaurantCache = new Map()
const searchCache = new Map()

export function publicDeals(date = new Date()) {
  const day = todayIso(date)
  const cached = publicDealsDayCache.get(day)
  if (cached) return cached
  const list = allDealRows().filter((deal) => isDealListable(deal, date))
  publicDealsDayCache.set(day, list)
  return list
}

function publicDealsIndex(date = new Date()) {
  const day = todayIso(date)
  const cached = publicDealsByRestaurantCache.get(day)
  if (cached) return cached
  const index = new Map()
  for (const deal of publicDeals(date)) {
    const list = index.get(deal.restaurantId)
    if (list) list.push(deal)
    else index.set(deal.restaurantId, [deal])
  }
  publicDealsByRestaurantCache.set(day, index)
  return index
}

export function publicDealById(id, date = new Date()) {
  return publicDeals(date).find((deal) => deal.id === id) ?? null
}

export function publicDealsForRestaurant(restaurantId, date = new Date()) {
  return publicDealsIndex(date).get(restaurantId) ?? []
}

export function restaurantHasPublicDeal(restaurantId, date = new Date()) {
  return publicDealsIndex(date).has(restaurantId)
}

export function publicDealSearchText(restaurantId, date = new Date()) {
  const day = todayIso(date)
  if (!searchCache.has(day)) {
    const map = new Map()
    for (const deal of publicDeals(date)) {
      const badges = dealBadgeLabels(deal).join(' ')
      const prev = map.get(deal.restaurantId) ?? ''
      map.set(
        deal.restaurantId,
        `${prev} ${deal.title} ${deal.description} ${badges}`.trim(),
      )
    }
    searchCache.set(day, map)
  }
  return searchCache.get(day).get(restaurantId) ?? ''
}

/**
 * Hlavní štítek nabídky. Procento jen při doloženém discountPercent + percentBase.
 * Jinak bogo / doložená akční cena / obecná „Sleva“.
 */
export function dealHighlightLabel(deal) {
  if (!deal) return 'Sleva'
  const percent = deal.discountPercent
  const base = typeof deal.percentBase === 'string' ? deal.percentBase.trim() : ''
  if ((percent === 10 || percent === 20) && base) return `−${percent} %`
  if (deal.benefitType === 'bogo') return '1+1 zdarma'
  if (typeof deal.salePrice === 'number' && Number.isFinite(deal.salePrice)) {
    return `${deal.salePrice} Kč`
  }
  return 'Sleva'
}

/** Štítky na kartě. Procento jen s doloženým základem. */
export function dealBadgeLabels(deal) {
  if (!deal) return []
  const labels = [dealHighlightLabel(deal)]
  if (deal.studentOnly && !labels.includes('Studentská sleva')) labels.push('Studentská sleva')
  if (deal.requiresLoyaltyApp) labels.push('Věrnostní výhoda')
  return [...new Set(labels)]
}

export function dealBadgesForRestaurant(restaurantId, date = new Date()) {
  const deals = publicDealsForRestaurant(restaurantId, date)
  if (deals.length === 0) return []
  return [
    {
      label: 'Sleva',
      count: deals.length,
      dealId: deals[0].id,
    },
  ]
}

export function dealValidityNote(deal) {
  if (!deal) return ''
  if (deal.verification !== 'verified') {
    return 'Nabídka není ověřená. Nezobrazujeme ji jako aktivní slevu.'
  }
  if (!deal.sourceHasEndDate && deal.validUntil) {
    return `Zdroj neuvádí datum konce. Znovu ověříme nejpozději ${deal.validUntil}.`
  }
  if (!deal.validUntil) {
    return 'Platnost nebyla plně doložena datem konce.'
  }
  return ''
}

export function dealOfferIds() {
  return OFFERS.map((offer) => offer.offerId)
}

export function countPublicDeals(date = new Date()) {
  return publicDeals(date).length
}

export function countPublicDealRestaurants(date = new Date()) {
  return new Set(publicDeals(date).map((deal) => deal.restaurantId)).size
}
