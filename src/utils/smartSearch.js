import { FOOD_CATEGORIES, getCategoryMeta } from '../constants/filters.js'
import { publicDealSearchText } from '../data/restaurantDeals.js'
import {
  categoryMatchTier,
  getRestaurantCategory,
  getSecondaryCategories,
} from './restaurantTags.js'

const OSM_CUISINE_WORDS = {
  sushi: 'sushi',
  ramen: 'ramen',
  pho: 'pho',
  noodle: 'nudle',
  pizza: 'pizza',
  burger: 'burger',
  kebab: 'kebab',
  indian: 'indicka',
  chinese: 'cinska',
  vietnamese: 'vietnamska',
  thai: 'thajska',
  japanese: 'japonska',
  mexican: 'mexicka',
  taco: 'taco',
  burrito: 'burrito',
  coffee: 'kava',
  cafe: 'kava',
  vegetarian: 'vegetarianska',
  vegan: 'veganska',
}

function streetLine(address) {
  return String(address || '').split(',')[0]?.trim() || ''
}

function documentedCuisine(restaurant) {
  return String(restaurant?.osmCuisine || '')
    .split(/[;,/]+/)
    .map((part) => {
      const key = part.trim().toLowerCase()
      return OSM_CUISINE_WORDS[key] || key
    })
    .filter(Boolean)
    .join(' ')
}

/** Hledání bez háčků a čárek, se sloučenými mezerami. */
export function foldSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Synonyma typu kuchyně. Konkrétní jídlo (sushi, taco, espresso) sem nepatří. */
export const CATEGORY_SEARCH_ALIASES = {
  pizza: ['pizza', 'pizzy', 'pizze', 'pizzerie', 'pizzeria', 'pizzas'],
  burger: ['burger', 'burgery', 'hamburger', 'hamburgery', 'burgers', 'hamburgers'],
  kebab: ['kebab', 'kebap', 'kebaby', 'kebabs'],
  asijske: ['asie', 'asijske', 'asijska', 'asijsky', 'asian', 'asia'],
  cina: ['cina', 'cinska', 'cinske', 'cinsky', 'chinese', 'china'],
  mexiko: ['mexiko', 'mexicka', 'mexicke', 'mexicky', 'mexican', 'mexico', 'taco', 'tacos', 'burrito', 'burritos'],
  kava: ['kava', 'kavarna', 'kavarny', 'coffee', 'cafe'],
  sladke: ['sladke', 'cukrarna', 'dessert', 'desserts', 'cake', 'cakes', 'sweet'],
  ceske: ['ceske', 'ceska', 'cesky', 'czech'],
  vegetarianske: ['vegetarianske', 'vegetarian', 'vegetarianska'],
  veganske: ['veganske', 'vegan'],
  zdrave: ['zdrave', 'zdrava', 'zdravy', 'healthy'],
  fastfood: ['fastfood', 'fast-food'],
}

/**
 * Konkrétní produkty / služby. Samy o sobě nedělají kategorii,
 * ale zvyšují relevanci u ověřených `verifiedProducts`.
 */
export const PRODUCT_SEARCH_ALIASES = {
  espresso: ['espresso'],
  brunch: ['brunch', 'brunche'],
  snidane: ['snidane', 'snidaně', 'breakfast'],
  pho: ['pho'],
  ramen: ['ramen'],
  poke: ['poke', 'poké'],
  sushi: ['sushi'],
  bowl: ['bowl', 'bowls'],
  salad: ['salat', 'salad'],
  juice: ['dzus', 'juice', 'fresh'],
  burger: ['burger', 'burgery', 'hamburger'],
  pizza: ['pizza'],
  wrap: ['wrap', 'wrapy'],
  kava: ['kava', 'kavarna'],
}

function productTokenAliases(token) {
  const needle = foldSearchText(token)
  const hits = []
  for (const [product, aliases] of Object.entries(PRODUCT_SEARCH_ALIASES)) {
    if (product === needle || aliases.some((alias) => foldSearchText(alias) === needle)) {
      hits.push(product)
    }
  }
  return hits
}

const SKIP_TOKENS = new Set([
  'brno',
  'v',
  've',
  'na',
  'u',
  'a',
  'the',
  'restaurace',
  'restaurant',
  'podnik',
  'jidlo',
  'jidla',
  'kuchyne',
  'kuchyn',
  'kc',
  'korun',
  'czk',
])

const CHEAP_WORDS = new Set(['levna', 'levne', 'levny', 'levnejsi', 'nejlevnejsi'])
const VEGAN_WORDS = new Set(['vegan', 'veganske', 'veganska', 'vegansky'])
const VEG_WORDS = new Set(['vegetarian', 'vegetarianske', 'vegetarianska', 'vegetariansky', 'bezmasa'])
const LUNCH_WORDS = new Set(['obed', 'obedy', 'obedove', 'poledni'])

const CHEAP_BUDGET = '120'

export function withinOneEdit(a, b) {
  if (a === b) return true
  const left = String(a)
  const right = String(b)
  if (Math.abs(left.length - right.length) > 1) return false
  if (left.length > right.length) return withinOneEdit(right, left)
  let i = 0
  let j = 0
  let edits = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length === right.length) i += 1
    j += 1
  }
  if (j < right.length || i < left.length) edits += 1
  return edits <= 1
}

function searchWords(text) {
  return foldSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/**
 * exact = celé slovo, nebo krátký prefix pro našeptávač („pi“ → pizza).
 * Delší dotaz nesmí trefit cizí slovo zevnitř (pizza → piazza, king → steaking).
 * fuzzy = nejvýš jeden překlep ve slově dlouhém alespoň 4 znaky.
 */
export function tokenHits(token, text) {
  const needle = foldSearchText(token)
  const words = searchWords(text)
  if (!needle || words.length === 0) return ''
  if (words.some((word) => word === needle)) return 'exact'
  if (needle.length >= 2 && needle.length <= 3 && words.some((word) => word.startsWith(needle))) {
    return 'exact'
  }
  if (needle.length < 4) return ''
  for (const word of words) {
    if (Math.abs(word.length - needle.length) > 1) continue
    if (withinOneEdit(needle, word)) return 'fuzzy'
  }
  return ''
}

function exactCategory(token) {
  for (const [value, aliases] of Object.entries(CATEGORY_SEARCH_ALIASES)) {
    if (value === token || aliases.includes(token)) return value
  }
  return ''
}

function categoryForToken(token) {
  const direct = exactCategory(token)
  if (direct) return direct
  // Jednotné/množné jen když kmen je přesné synonymum (burgers → burger, kebaby → kebab).
  if (token.length >= 5 && (token.endsWith('s') || token.endsWith('y'))) {
    const stem = exactCategory(token.slice(0, -1))
    if (stem) return stem
  }
  if (token.length < 4) return ''
  let found = ''
  for (const [value, aliases] of Object.entries(CATEGORY_SEARCH_ALIASES)) {
    for (const alias of aliases) {
      if (!withinOneEdit(token, alias)) continue
      if (found && found !== value) return ''
      found = value
    }
  }
  return found
}

export function interpretSearchQuery(query) {
  let folded = foldSearchText(query)
  const vegetarianPhrase = /\bbez masa\b/.test(folded)
  folded = folded.replace(/\bbez masa\b/g, ' ')
  folded = folded.replace(/(\d)\s*(kc|korun|czk)\b/g, '$1')
  folded = folded.replace(/\b(do|pod|max)(\d{2,4})\b/g, '$1 $2')

  let maxBudget = ''
  let budgetSource = ''
  folded = folded.replace(/(?:^|\s)(?:do|pod|max)\s*(\d{2,4})(?=\s|$)/g, (full, num) => {
    const amount = Number(num)
    if (amount >= 40 && amount <= 2000) {
      maxBudget = String(amount)
      budgetSource = 'limit'
    }
    return ' '
  })

  const rest = []
  let cuisineType = ''
  let consumedCategoryToken = ''
  let veganOnly = false
  let vegetarianOnly = vegetarianPhrase
  let lunchOnly = false

  for (const token of folded.split(' ').filter(Boolean)) {
    if (SKIP_TOKENS.has(token)) continue
    if (CHEAP_WORDS.has(token)) {
      if (!maxBudget) {
        maxBudget = CHEAP_BUDGET
        budgetSource = 'cheap'
      }
      continue
    }
    if (VEGAN_WORDS.has(token)) {
      veganOnly = true
      continue
    }
    if (VEG_WORDS.has(token)) {
      vegetarianOnly = true
      continue
    }
    if (LUNCH_WORDS.has(token)) {
      lunchOnly = true
      continue
    }
    const category = categoryForToken(token)
    if (category && !cuisineType) {
      cuisineType = category
      consumedCategoryToken = token
      continue
    }
    rest.push(token)
  }

  if (veganOnly) vegetarianOnly = false

  return {
    text: rest.join(' '),
    cuisineType,
    consumedCategoryToken,
    maxBudget,
    budgetSource,
    veganOnly,
    vegetarianOnly,
    lunchOnly,
  }
}

export function describeSearchIntent(query) {
  const intent = interpretSearchQuery(query)
  const notes = []
  if (intent.cuisineType) {
    notes.push(getCategoryMeta(intent.cuisineType)?.label || intent.cuisineType)
  }
  if (intent.maxBudget) {
    notes.push(
      intent.budgetSource === 'cheap'
        ? `ověřená cena do ${intent.maxBudget} Kč (levné)`
        : `ověřená cena do ${intent.maxBudget} Kč`,
    )
  }
  if (intent.veganOnly) notes.push('veganské možnosti')
  if (intent.vegetarianOnly) notes.push('podniky bez masa')
  if (intent.lunchOnly) notes.push('zmínka o poledním menu v OSM datech (ne denní jídelníček)')
  return notes
}

export function searchWithoutIntent(query, key) {
  const intent = interpretSearchQuery(query)
  if (key === 'budget') {
    intent.maxBudget = ''
    intent.budgetSource = ''
  } else if (key === 'cuisine') {
    intent.cuisineType = ''
    intent.consumedCategoryToken = ''
  } else if (key === 'vegan') intent.veganOnly = false
  else if (key === 'vegetarian') intent.vegetarianOnly = false
  else if (key === 'lunch') intent.lunchOnly = false

  const parts = []
  if (intent.cuisineType) parts.push(intent.consumedCategoryToken || intent.cuisineType)
  if (intent.veganOnly) parts.push('vegan')
  if (intent.vegetarianOnly) parts.push('vegetarian')
  if (intent.lunchOnly) parts.push('obed')
  if (intent.maxBudget && intent.budgetSource === 'cheap') parts.push('levny')
  else if (intent.maxBudget) parts.push(`do ${intent.maxBudget}`)
  if (intent.text) parts.push(intent.text)
  return parts.join(' ').trim()
}

function curatedLead(restaurant) {
  const text = String(restaurant?.description || '').trim()
  if (!text || text.startsWith('Záznam z OpenStreetMap')) return ''
  return text
}

export function documentedSearchBlob(restaurant) {
  const products = Array.isArray(restaurant?.verifiedProducts) ? restaurant.verifiedProducts : []
  return foldSearchText(
    [
      restaurant?.name,
      restaurant?.address,
      restaurant?.type,
      restaurant?.priceItem,
      documentedCuisine(restaurant),
      curatedLead(restaurant),
      publicDealSearchText(restaurant?.id),
      ...products,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

export function categorySearchBlob(restaurant) {
  const cats = [getRestaurantCategory(restaurant), ...getSecondaryCategories(restaurant)].filter(Boolean)
  const parts = []
  for (const cat of cats) {
    const meta = getCategoryMeta(cat)
    const aliases = CATEGORY_SEARCH_ALIASES[cat] || []
    parts.push(meta?.label, cat, ...aliases)
  }
  return foldSearchText(parts.filter(Boolean).join(' '))
}

function verifiedProductHit(restaurant, token) {
  const products = Array.isArray(restaurant?.verifiedProducts) ? restaurant.verifiedProducts : []
  if (products.length === 0) return ''
  const wanted = new Set(productTokenAliases(token))
  if (wanted.size === 0) wanted.add(foldSearchText(token))
  const blob = foldSearchText(products.join(' '))
  for (const product of wanted) {
    const hit = tokenHits(product, blob)
    if (hit) return hit
  }
  return ''
}

/**
 * null = neshoda. Jinak skóre relevance, vyšší je lepší.
 * Kategorie: primary (+10) > secondary (+5) > ověřený produkt/token v datech (+2–3).
 * Náhodná zmínka v popisu nestačí na kategorii; slabé textové shody mají nižší skóre.
 */
export function matchRestaurantQuery(restaurant, intent) {
  let score = 0
  if (intent.cuisineType) {
    const tier = categoryMatchTier(restaurant, intent.cuisineType)
    if (tier === 'primary') score += 10
    else if (tier === 'secondary') score += 5
    else {
      // Bez ověřené kategorie: jen silný token v názvu / doloženém produktu, ne volný popis.
      const nameHit = intent.consumedCategoryToken
        ? tokenHits(intent.consumedCategoryToken, restaurant?.name)
        : ''
      const productHit = intent.consumedCategoryToken
        ? verifiedProductHit(restaurant, intent.consumedCategoryToken)
        : ''
      if (nameHit === 'exact') score += 3
      else if (productHit === 'exact') score += 2
      else return null
    }
    if (
      intent.consumedCategoryToken &&
      tokenHits(intent.consumedCategoryToken, restaurant?.name) === 'exact'
    ) {
      score += 8
    }
  }

  for (const token of intent.text.split(' ').filter(Boolean)) {
    const name = tokenHits(token, restaurant?.name)
    const address = tokenHits(token, restaurant?.address)
    const category = tokenHits(token, categorySearchBlob(restaurant))
    const product = verifiedProductHit(restaurant, token)
    const documented = tokenHits(token, documentedSearchBlob(restaurant))
    const productLike = productTokenAliases(token).length > 0
    // Konkrétní produkt (espresso, pho, brunch…): nestačí náhodná zmínka v popisu.
    if (productLike) {
      if (!name && !product && !(category === 'exact')) return null
    } else if (!name && !address && !category && !product && !documented) {
      return null
    }
    if (name === 'exact') score += 8
    else if (name === 'fuzzy') score += 4
    if (address === 'exact') score += 4
    else if (address === 'fuzzy') score += 2
    if (category === 'exact') score += 5
    else if (category === 'fuzzy') score += 2
    if (product === 'exact') score += 6
    else if (product === 'fuzzy') score += 3
    // Volný popis jen jako slabý doplněk u neproduktových tokenů.
    if (!productLike && !name && !category && !product && documented === 'exact') score += 2
    else if (!productLike && !name && !category && !product && documented === 'fuzzy') score += 1
  }

  return score
}

function localityParts(address) {
  return String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      const folded = foldSearchText(part)
      if (!folded || folded === 'brno' || folded === 'brno mesto') return false
      if (/^\d{3}\s?\d{2}/.test(part)) return false
      return folded.length >= 3
    })
}

export function buildSearchSuggestions(restaurants, query, limit = 8) {
  const needle = foldSearchText(query)
  if (needle.length < 2) return []
  const suggestions = []
  const seen = new Set()
  const push = (item) => {
    const key = `${item.kind}:${item.id || item.label}`
    if (seen.has(key) || suggestions.length >= limit) return
    seen.add(key)
    suggestions.push(item)
  }

  for (const category of FOOD_CATEGORIES) {
    const blob = foldSearchText(
      [category.label, category.value, ...(CATEGORY_SEARCH_ALIASES[category.value] || [])].join(' '),
    )
    if (!tokenHits(needle, blob)) continue
    push({
      kind: 'category',
      id: category.value,
      label: category.label,
      hint: 'Kategorie',
    })
  }

  const named = []
  for (const restaurant of restaurants || []) {
    const hit = tokenHits(needle, restaurant?.name)
    if (!hit || !restaurant?.id) continue
    named.push({ restaurant, rank: hit === 'exact' ? 0 : 1 })
  }
  named.sort(
    (a, b) => a.rank - b.rank || String(a.restaurant.name).localeCompare(String(b.restaurant.name), 'cs'),
  )
  for (const { restaurant } of named.slice(0, 4)) {
    push({
      kind: 'restaurant',
      id: restaurant.id,
      label: restaurant.name,
      hint: streetLine(restaurant.address) || 'Podnik',
    })
  }

  const dishes = new Map()
  for (const restaurant of restaurants || []) {
    const products = Array.isArray(restaurant?.verifiedProducts) ? restaurant.verifiedProducts : []
    for (const product of products) {
      const label = String(product || '').trim()
      if (!label || tokenHits(needle, label) !== 'exact') continue
      const key = foldSearchText(label)
      if (!dishes.has(key)) dishes.set(key, label)
    }
  }
  for (const label of dishes.values()) {
    push({
      kind: 'dish',
      id: foldSearchText(label),
      label,
      hint: 'Ověřené jídlo',
      query: label,
    })
    if (suggestions.length >= limit) break
  }

  const places = new Map()
  for (const restaurant of restaurants || []) {
    for (const part of localityParts(restaurant.address)) {
      const folded = foldSearchText(part)
      if (!folded.includes(needle) && !tokenHits(needle, folded)) continue
      if (!places.has(folded)) places.set(folded, part)
    }
  }
  for (const part of places.values()) {
    push({ kind: 'locality', id: foldSearchText(part), label: part, hint: 'Lokalita', query: part })
    if (suggestions.length >= limit) break
  }

  return suggestions.slice(0, limit)
}

/** Doporučení při nule výsledků: jen silná shoda kategorie, ne podobná slova navíc. */
export function emptyResultSuggestions(query) {
  const intent = interpretSearchQuery(query)
  const items = []
  const pushCategory = (value, reason) => {
    if (!value || items.some((item) => item.id === value)) return
    const meta = getCategoryMeta(value)
    if (!meta) return
    items.push({
      id: meta.value,
      label: meta.label,
      href: `/results?type=${encodeURIComponent(meta.value)}`,
      reason,
    })
  }
  if (intent.cuisineType) pushCategory(intent.cuisineType, 'Kategorie odpovídá hledání')
  if (intent.text) {
    for (const category of FOOD_CATEGORIES) {
      const blob = foldSearchText(
        [category.label, category.value, ...(CATEGORY_SEARCH_ALIASES[category.value] || [])].join(' '),
      )
      if (tokenHits(intent.text, blob) === 'exact') pushCategory(category.value, 'Kategorie odpovídá hledání')
    }
  }
  return items.slice(0, 3)
}
