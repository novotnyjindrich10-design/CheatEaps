import { FOOD_CATEGORIES, getCategoryMeta } from '../constants/filters.js'
import { publicDealSearchText } from '../data/restaurantDeals.js'
import { getRestaurantCategory } from './restaurantTags.js'

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

/** Synonyma typu kuchyně. Konkrétní jídlo (sushi, taco) sem nepatří. */
export const CATEGORY_SEARCH_ALIASES = {
  pizza: ['pizza', 'pizzerie', 'pizzeria'],
  burger: ['burger', 'burgery', 'hamburger'],
  kebab: ['kebab', 'kebap'],
  asijske: ['asie', 'asijske', 'asijska', 'asijsky'],
  cina: ['cina', 'cinska', 'cinske', 'cinsky'],
  mexiko: ['mexiko', 'mexicka', 'mexicke', 'mexicky'],
  kava: ['kava', 'kavarna', 'kavarny'],
  sladke: ['sladke', 'cukrarna'],
  ceske: ['ceske', 'ceska', 'cesky'],
  vegetarianske: ['vegetarianske'],
  veganske: ['veganske'],
  zdrave: ['zdrave', 'zdrava', 'zdravy'],
  fastfood: ['fastfood'],
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

function categoryForToken(token) {
  for (const [value, aliases] of Object.entries(CATEGORY_SEARCH_ALIASES)) {
    if (value === token || aliases.includes(token)) return value
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
  return foldSearchText(
    [
      restaurant?.name,
      restaurant?.address,
      restaurant?.type,
      restaurant?.priceItem,
      documentedCuisine(restaurant),
      curatedLead(restaurant),
      publicDealSearchText(restaurant?.id),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

export function categorySearchBlob(restaurant) {
  const cat = getRestaurantCategory(restaurant) || ''
  const meta = getCategoryMeta(cat)
  const aliases = CATEGORY_SEARCH_ALIASES[cat] || []
  return foldSearchText([meta?.label, cat, ...aliases].filter(Boolean).join(' '))
}

/** null = neshoda. Jinak skóre relevance, vyšší je lepší. */
export function matchRestaurantQuery(restaurant, intent) {
  let score = 0
  if (intent.cuisineType) {
    if (getRestaurantCategory(restaurant) === intent.cuisineType) score += 6
    else {
      const hit = intent.consumedCategoryToken
        ? tokenHits(intent.consumedCategoryToken, documentedSearchBlob(restaurant))
        : ''
      const aliases = CATEGORY_SEARCH_ALIASES[intent.cuisineType] || []
      const typedExactly =
        intent.consumedCategoryToken === intent.cuisineType || aliases.includes(intent.consumedCategoryToken)
      if (hit === 'exact' || (hit === 'fuzzy' && !typedExactly)) score += 3
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
    const documented = tokenHits(token, documentedSearchBlob(restaurant))
    if (!name && !address && !category && !documented) return null
    if (name === 'exact') score += 8
    else if (name === 'fuzzy') score += 4
    if (address === 'exact') score += 4
    else if (address === 'fuzzy') score += 2
    if (category === 'exact') score += 5
    else if (category === 'fuzzy') score += 2
    if (!name && !category && documented === 'exact') score += 2
    else if (!name && !category && documented === 'fuzzy') score += 1
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
