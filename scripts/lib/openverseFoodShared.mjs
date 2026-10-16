/**
 * Sdílená logika pro Openverse ilustrace jídel (pilot i bulk).
 * Licence: jen CC0 / PDM / CC BY / CC BY-SA.
 *
 * Dish keys jsou typ jídla (ne jen kategorie restaurace).
 * Specifické name hints mají přednost před obecnou kategorií.
 */

export const UA = 'CheapEatsBrno/1.0 (student project; Openverse food illustrations)'
export const OPENVERSE = 'https://api.openverse.org/v1/images/'
export const ALLOWED = new Set(['cc0', 'pdm', 'by', 'by-sa'])
export const PREFERRED = new Set(['cc0', 'pdm'])

/** Metadata očekávaného obsahu assetu – pro audit. */
export const DISH_SPECS = {
  pizza: {
    key: 'pizza',
    query: 'margherita pizza food',
    fallbacks: ['pizza food plate'],
    dish: 'pizza',
    keywords: ['pizza', 'margherita'],
    contentTags: ['pizza'],
    forbidTags: ['cake', 'coffee', 'sushi', 'goulash'],
  },
  burger: {
    key: 'burger',
    query: 'hamburger burger food',
    fallbacks: ['cheeseburger food'],
    dish: 'burger',
    keywords: ['burger', 'hamburger', 'cheeseburger'],
    contentTags: ['burger', 'hamburger'],
    forbidTags: ['cake', 'sushi', 'coffee', 'baguette', 'pastry'],
  },
  kebab: {
    key: 'kebab',
    query: 'gyro pita sandwich',
    fallbacks: ['greek gyro food', 'shawarma wrap'],
    dish: 'kebab',
    keywords: ['gyro', 'pita', 'sandwich', 'kebab', 'shawarma'],
    contentTags: ['kebab', 'gyro', 'shawarma'],
    forbidTags: ['cake', 'coffee', 'sushi', 'pizza'],
  },
  cina: {
    key: 'cina',
    query: 'chinese kung pao chicken rice',
    fallbacks: ['kung pao chicken', 'chinese noodles stir fry'],
    dish: 'čínské jídlo',
    keywords: ['chinese', 'kung', 'pao', 'rice', 'noodle'],
    contentTags: ['chinese', 'kung_pao', 'noodle'],
    forbidTags: ['pizza', 'burger', 'cake', 'coffee'],
  },
  asijske: {
    key: 'asijske',
    query: 'pho vietnamese noodle soup',
    fallbacks: ['ramen noodle soup', 'asian noodle soup'],
    dish: 'asijské jídlo / nudle',
    keywords: ['pho', 'vietnamese', 'noodle', 'soup', 'ramen', 'asian'],
    contentTags: ['pho', 'noodle', 'asian'],
    forbidTags: ['burger', 'pizza', 'cake', 'baguette'],
  },
  pho: {
    key: 'pho',
    query: 'pho vietnamese noodle soup',
    fallbacks: ['pho soup'],
    dish: 'pho',
    keywords: ['pho', 'vietnamese', 'noodle', 'soup'],
    contentTags: ['pho', 'noodle'],
    forbidTags: ['sushi', 'burger', 'pizza'],
  },
  sushi: {
    key: 'sushi',
    query: 'nigiri sushi food',
    fallbacks: ['sushi platter food', 'sushi roll plate'],
    dish: 'sushi',
    keywords: ['sushi', 'nigiri', 'sashimi', 'roll'],
    contentTags: ['sushi', 'nigiri'],
    forbidTags: ['burger', 'pizza', 'pho', 'cake', 'chicken'],
  },
  ramen: {
    key: 'ramen',
    query: 'ramen noodle bowl',
    fallbacks: ['ramen noodles food'],
    dish: 'ramen',
    keywords: ['ramen', 'noodle', 'soup'],
    contentTags: ['ramen', 'noodle'],
    forbidTags: ['burger', 'pizza', 'cake'],
  },
  mexiko: {
    key: 'mexiko',
    query: 'tacos mexican food',
    fallbacks: ['taco food'],
    dish: 'tacos',
    keywords: ['taco', 'mexican', 'burrito'],
    contentTags: ['taco', 'mexican'],
    forbidTags: ['sushi', 'cake', 'coffee'],
  },
  kava: {
    key: 'kava',
    query: 'coffee latte cup cafe',
    fallbacks: ['espresso coffee cup', 'flat white coffee'],
    dish: 'káva',
    keywords: ['coffee', 'latte', 'espresso', 'cappuccino'],
    contentTags: ['coffee', 'latte'],
    forbidTags: ['meat', 'chicken', 'burger', 'raw', 'steak', 'goulash'],
  },
  sladke: {
    key: 'sladke',
    query: 'cake pastry dessert',
    fallbacks: ['strawberry cake food'],
    dish: 'dort / zákusek',
    keywords: ['cake', 'pastry', 'dessert', 'cupcake', 'tart'],
    contentTags: ['cake', 'dessert', 'pastry'],
    forbidTags: ['chicken', 'burger', 'meat', 'sushi', 'goulash'],
  },
  baguette: {
    key: 'baguette',
    query: 'baguette sandwich food',
    fallbacks: ['sandwich food'],
    dish: 'bageta / sendvič',
    keywords: ['sandwich', 'baguette', 'sub'],
    contentTags: ['baguette', 'sandwich', 'bread'],
    forbidTags: ['cake', 'sushi', 'fried_chicken'],
  },
  fried_chicken: {
    key: 'fried_chicken',
    query: 'fried chicken strips fries',
    fallbacks: ['fried chicken food plate', 'crispy chicken strips'],
    dish: 'smažené kuře / stripsy',
    keywords: ['chicken', 'fried', 'strips', 'crispy'],
    contentTags: ['fried_chicken', 'chicken', 'strips'],
    forbidTags: ['baguette', 'pastry', 'cake', 'bread', 'sushi', 'coffee'],
  },
  fries: {
    key: 'fries',
    query: 'french fries food',
    fallbacks: ['french fries plate'],
    dish: 'hranolky',
    keywords: ['fries', 'french', 'potato'],
    contentTags: ['fries', 'fastfood'],
    forbidTags: ['cake', 'pastry', 'sushi', 'coffee'],
  },
  fastfood: {
    key: 'fastfood',
    query: 'french fries food',
    fallbacks: ['french fries plate', 'hamburger fries food'],
    dish: 'fast food / hranolky',
    keywords: ['fries', 'french', 'fast', 'food'],
    contentTags: ['fries', 'fastfood'],
    forbidTags: ['cake', 'pastry', 'baguette', 'bread', 'sushi', 'coffee'],
  },
  ceske: {
    key: 'ceske',
    query: 'goulash stew food',
    fallbacks: ['goulash food', 'pork dumpling food'],
    dish: 'české jídlo',
    keywords: ['goulash', 'stew', 'dumpling', 'pork', 'svickova'],
    contentTags: ['goulash', 'czech', 'stew'],
    forbidTags: ['sushi', 'pizza', 'cake'],
  },
  zdrave: {
    key: 'zdrave',
    query: 'salad bowl vegetables',
    fallbacks: ['salad lettuce food'],
    dish: 'salát / bowl',
    keywords: ['salad', 'bowl', 'healthy', 'vegetable', 'lettuce'],
    contentTags: ['salad', 'healthy'],
    forbidTags: ['fried_chicken', 'burger', 'cake'],
  },
  vegetarianske: {
    key: 'vegetarianske',
    query: 'vegetable curry rice',
    fallbacks: ['vegetarian curry tofu', 'indian vegetarian food'],
    dish: 'vegetariánské jídlo',
    keywords: ['vegetable', 'curry', 'rice', 'tofu', 'vegetarian', 'paneer'],
    contentTags: ['vegetarian', 'curry'],
    forbidTags: ['chicken', 'beef', 'pork', 'meat', 'burger'],
  },
  veganske: {
    key: 'veganske',
    query: 'veggie burger food',
    fallbacks: ['plant based burger', 'vegan food burger'],
    dish: 'veganský burger',
    keywords: ['vegan', 'burger', 'veggie', 'plant'],
    contentTags: ['vegan', 'burger'],
    forbidTags: ['meat', 'chicken', 'beef'],
  },
  neuvedeno: {
    key: 'neuvedeno',
    query: 'pasta italian food plate',
    fallbacks: ['spaghetti pasta food'],
    dish: 'hlavní jídlo',
    keywords: ['pasta', 'spaghetti', 'food', 'meal', 'dish'],
    contentTags: ['pasta', 'meal'],
    forbidTags: [],
  },
}

/** Alias pro starší importy. */
export const DISH_BY_CATEGORY = DISH_SPECS

/**
 * Silné tipy jen z názvu/id – mají přednost před kategorií.
 * Záměrně nečteme OSM cuisine z popisu (často multi-tag a přebíjí primární kategorii).
 */
export const SPECIFIC_NAME_HINTS = [
  { re: /\b(kfc|chicken\s*inn|fried\s*chicken|kuřec[ií]|chicken\s*wings)\b/i, key: 'fried_chicken' },
  { re: /sushi/i, key: 'sushi' }, // i Mr.Sushito / Sushi Bar
  { re: /\bramen\b/i, key: 'ramen' },
  { re: /\b(pho|phở)\b/i, key: 'pho' },
  { re: /bageter|baguette|subway/i, key: 'baguette' },
  { re: /\b(burger|smash)\b/i, key: 'burger' },
  { re: /\b(pizza|pizzer)/i, key: 'pizza' },
  { re: /kebab|kebap|d[oö]ner|gyros|shawarma/i, key: 'kebab' },
  { re: /taco|burrito|mexick|mexican/i, key: 'mexiko' },
  { re: /poke|poké/i, key: 'asijske' }, // Pokecz
  { re: /\bwok\b/i, key: 'cina' },
]

/** Obecnější hinty – jen když kategorie chybí / neuvedeno (název + popis). */
export const GENERIC_NAME_HINTS = [
  { re: /sushi/i, key: 'sushi' },
  { re: /\b(pho|phở)\b/i, key: 'pho' },
  { re: /\bramen\b/i, key: 'ramen' },
  { re: /thai|vietnam|vietnamese|korea|korean|japan|japanese|bento|asian/i, key: 'asijske' },
  { re: /čín|cina|cine|kung|china|chinese/i, key: 'cina' },
  { re: /kavár|cafe|coffee|espresso|latte|čajovna/i, key: 'kava' },
  { re: /cukrár|pastry|zmrzlin|gelato|dort|pekár/i, key: 'sladke' },
  { re: /\bvegan\b/i, key: 'veganske' },
  { re: /vegetari|veggie|salad|salát|healthy|zdrav/i, key: 'zdrave' },
  { re: /pivnic|hospoda|svíčk|guláš|česk/i, key: 'ceske' },
]

/** Mapování kategorie → výchozí dish key (když není specifický hint). */
export const CATEGORY_DEFAULT_KEY = {
  pizza: 'pizza',
  burger: 'burger',
  kebab: 'kebab',
  cina: 'cina',
  asijske: 'asijske',
  mexiko: 'mexiko',
  kava: 'kava',
  sladke: 'sladke',
  fastfood: 'fastfood',
  ceske: 'ceske',
  zdrave: 'zdrave',
  vegetarianske: 'vegetarianske',
  veganske: 'veganske',
  neuvedeno: 'neuvedeno',
}

export function placeText(place) {
  return [place?.name, place?.id, place?.description, place?.type, place?.cuisineType]
    .filter(Boolean)
    .join(' ')
}

export function dishSpecForPlace(place, overrides = {}) {
  if (overrides[place.id]) {
    const o = overrides[place.id]
    const base = DISH_SPECS[o.key] || {}
    return { ...base, ...o, source: 'override' }
  }

  const nameId = `${place?.name || ''} ${place?.id || ''}`
  const text = placeText(place)

  // 1) Silný signál v názvu/id – přebije kategorii (Chicken Inn, Sushi Mix, Bageterie…)
  for (const hint of SPECIFIC_NAME_HINTS) {
    if (hint.re.test(nameId) && DISH_SPECS[hint.key]) {
      return { ...DISH_SPECS[hint.key], source: 'name_specific' }
    }
  }

  // 2) Primární kategorie podniku
  const category = place.category || 'neuvedeno'
  const catKey = CATEGORY_DEFAULT_KEY[category]
  if (catKey && category !== 'neuvedeno' && DISH_SPECS[catKey]) {
    return { ...DISH_SPECS[catKey], source: 'category' }
  }

  // 3) Neuvedeno: tip z názvu/popisu (včetně „Vietnamese“, OSM cuisine v popisu)
  for (const hint of GENERIC_NAME_HINTS) {
    if (!hint.key) continue
    if (hint.re.test(text) && DISH_SPECS[hint.key]) {
      return { ...DISH_SPECS[hint.key], source: 'name' }
    }
  }

  return { ...DISH_SPECS.neuvedeno, source: 'fallback' }
}

/**
 * Audit: je asset (podle dish/tags/title) kompatibilní s očekávaným dish key?
 * Vrací { ok, reasons[] }.
 */
export function auditAssignment(place, dishKey, assetMeta = {}) {
  const reasons = []
  const spec = DISH_SPECS[dishKey]
  if (!spec) {
    reasons.push(`neznámý dish key: ${dishKey}`)
    return { ok: false, reasons }
  }

  const text = placeText(place).toLowerCase()
  const assetBlob = [
    assetMeta.foodIllustrationDish,
    assetMeta.dish,
    assetMeta.title,
    assetMeta.foodIllustrationAttribution,
    ...(assetMeta.contentTags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  // Zjevné rozpory – silné signály z názvu/id (ne OSM multi-tagy v popisu)
  const nameId = `${place?.name || ''} ${place?.id || ''}`
  if (/\b(kfc|chicken\s*inn|kuřec)/i.test(nameId) && /baguette|pastry|cake|bread|pečiv|dort/i.test(assetBlob)) {
    reasons.push('kuřecí fastfood vs pečivo/bageta')
  }
  if (/sushi/i.test(nameId) && /burger|pizza|pho|goulash|cake/i.test(assetBlob) && !/sushi|nigiri|sashimi/i.test(assetBlob)) {
    reasons.push('sushi podnik vs nesushi jídlo')
  }
  if (
    (place.category === 'kava' || /\b(kavár|cafe|coffee)\b/i.test(nameId)) &&
    /raw meat|steak|goulash|chicken strip|burger/i.test(assetBlob)
  ) {
    reasons.push('kavárna vs masité jídlo')
  }
  if ((place.category === 'sladke' || /\bcukrár/i.test(nameId)) && /chicken|burger|goulash|sushi|taco/i.test(assetBlob)) {
    reasons.push('cukrárna vs nesladké jídlo')
  }
  if (
    place.category === 'fastfood' &&
    /baguette|pastry|cake|pečiv|cinnamon|bakery/i.test(assetBlob) &&
    !/\b(bageter|subway|sandwich)\b/i.test(nameId)
  ) {
    reasons.push('fastfood vs pečivo (není bageterie)')
  }
  if (dishKey === 'fried_chicken' && /baguette|pastry|cake|bread/i.test(assetBlob)) {
    reasons.push('fried_chicken key vs pečivo asset')
  }
  if (dishKey === 'sushi' && !/sushi|nigiri|sashimi|roll/i.test(assetBlob)) {
    reasons.push('sushi key bez sushi v metadatech assetu')
  }
  if (dishKey === 'kava' && !/coffee|latte|espresso|café|káv/i.test(assetBlob)) {
    reasons.push('kava key bez kávy v metadatech')
  }

  for (const tag of spec.forbidTags || []) {
    if (assetBlob.includes(tag.replace('_', ' ')) || assetBlob.includes(tag)) {
      // forbidTags are about asset content conflicting with expected dish type
      // only flag if asset clearly has forbidden content as primary
      if (tag === 'baguette' && /baguette/.test(assetBlob) && dishKey !== 'baguette') {
        reasons.push(`asset obsahuje zakázaný tag pro ${dishKey}: ${tag}`)
      }
    }
  }

  return { ok: reasons.length === 0, reasons }
}

export function scoreResult(item, keywords) {
  if (!ALLOWED.has(item.license)) return -1
  if (item.mature) return -1
  const blob = `${item.title || ''} ${(item.tags || []).map((t) => t.name).join(' ')}`.toLowerCase()
  let score = 0
  for (const word of keywords) {
    if (blob.includes(word.toLowerCase())) score += 3
  }
  if (
    !/\b(food|pizza|burger|cake|coffee|salad|taco|kebab|noodle|soup|pasta|meal|dish|curry|pho|sandwich|veggie|lettuce|naan|shawarma|rice|gyro|latte|espresso|chicken|fries|sushi|ramen|nigiri)\b/i.test(
      blob,
    )
  ) {
    score -= 4
  }
  if (/\b(logo|interior|building|street|person|people|map|screenshot|window|stall|shop|girl|man|woman|eating)\b/i.test(blob)) {
    score -= 5
  }
  if (/\b(chicken|beef|pork|meat)\b/i.test(blob) && keywords.some((k) => /vegetar|vegan|paneer|tofu|thali/i.test(k))) {
    score -= 8
  }
  if (/\b(baguette|pastry|bakery|bread)\b/i.test(blob) && keywords.some((k) => /chicken|fries|burger|sushi/i.test(k))) {
    score -= 6
  }
  if (PREFERRED.has(item.license)) score += 2
  if ((item.width || 0) >= 800 && (item.height || 0) >= 500) score += 1
  if ((item.width || 0) < 400 || (item.height || 0) < 300) score -= 2
  return score
}

export function extOf(url, filetype) {
  if (filetype && /^[a-z0-9]+$/i.test(filetype)) return filetype.toLowerCase().replace('jpeg', 'jpg')
  try {
    const path = new URL(url).pathname
    const m = path.match(/\.(jpe?g|png|webp|gif)$/i)
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg')
  } catch {
    /* ignore */
  }
  return 'jpg'
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function searchOpenverse(query, { pageSize = 20, page = 1 } = {}) {
  const url = new URL(OPENVERSE)
  url.searchParams.set('q', query)
  url.searchParams.set('license', 'cc0,pdm,by,by-sa')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('page', String(page))
  url.searchParams.set('category', 'photograph')
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (res.status === 429) {
    const err = new Error(`Openverse rate limited (429) for ${query}`)
    err.code = 'RATE_LIMIT'
    throw err
  }
  if (!res.ok) throw new Error(`Openverse ${res.status} for ${query}`)
  const data = await res.json()
  return { results: data.results || [], pageCount: data.page_count || 1, resultCount: data.result_count || 0 }
}

export async function downloadFile(url, destPath) {
  const { createWriteStream } = await import('fs')
  const { pipeline } = await import('stream/promises')
  const { Readable } = await import('stream')
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Download ${res.status} ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

export function illustrationRecord(place, dish, publicUrl, best, { sharedKey = null } = {}) {
  return {
    foodIllustrationKind: 'openverse',
    foodIllustrationUrl: publicUrl,
    foodIllustrationDish: dish,
    foodIllustrationAlt: `Ilustrační fotografie: ${dish} (ne jídlo z podniku ${place.name})`,
    foodIllustrationLicense: best.license,
    foodIllustrationLicenseUrl: best.license_url || '',
    foodIllustrationCreator: best.creator || '',
    foodIllustrationCreatorUrl: best.creator_url || '',
    foodIllustrationSourceUrl: best.foreign_landing_url || '',
    foodIllustrationOpenverseId: best.id,
    foodIllustrationAttribution: best.attribution || '',
    foodIllustrationOriginalUrl: best.url,
    ...(sharedKey ? { foodIllustrationSharedKey: sharedKey } : {}),
  }
}

export function needsAttribution(license) {
  const key = String(license || '').toLowerCase()
  return key === 'by' || key === 'by-sa'
}

export function uniquePlaces(curatedPlaces, osmPlaces) {
  const seen = new Set()
  const places = []
  for (const r of [...curatedPlaces, ...osmPlaces]) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    places.push(r)
  }
  return places
}
