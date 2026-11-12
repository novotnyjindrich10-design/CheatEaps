/**
 * Bezpečná klasifikace OSM cuisine / amenity → kategorie FoodGo.
 * Tokeny se berou po středníku (OSM oddělovač), ne jako volný substring
 * (dříve `/tea/` chybně trefilo `steak_house`).
 */

export const TYPE_BY_CATEGORY = {
  pizza: 'Pizza',
  burger: 'Burger',
  asijske: 'Asijské',
  ceske: 'České',
  vegetarianske: 'Bez masa',
  veganske: 'Vegan',
  kebab: 'Kebab',
  cina: 'Čína',
  mexiko: 'Mexiko',
  kava: 'Kavárna',
  fastfood: 'Fast food',
  sladke: 'Sladké',
  zdrave: 'Zdravé',
  neuvedeno: 'Restaurace',
}

/** OSM cuisine hodnoty → kategorie. Pořadí = priorita. */
const CUISINE_RULES = [
  { category: 'pizza', tokens: ['pizza'] },
  { category: 'burger', tokens: ['burger'] },
  { category: 'kebab', tokens: ['kebab', 'doner', 'döner', 'gyros'] },
  { category: 'cina', tokens: ['chinese', 'szechuan', 'sichuan'] },
  {
    category: 'asijske',
    tokens: [
      'vietnamese',
      'thai',
      'japanese',
      'sushi',
      'asian',
      'indian',
      'korean',
      'nepalese',
      'noodle',
      'ramen',
    ],
  },
  { category: 'mexiko', tokens: ['mexican', 'taco', 'burrito'] },
  {
    category: 'sladke',
    tokens: ['ice_cream', 'dessert', 'pastry', 'cake', 'pancake', 'waffle', 'crepe', 'donut'],
  },
  { category: 'zdrave', tokens: ['healthy', 'salad'] },
  // Před kavárnou: steak_house obsahuje podřetězec „tea“.
  { category: 'neuvedeno', tokens: ['steak_house', 'steakhouse', 'steak'] },
  {
    category: 'kava',
    tokens: ['coffee_shop', 'coffee', 'cafe', 'tea', 'teahouse', 'bubble_tea'],
  },
  { category: 'ceske', tokens: ['czech', 'regional', 'local'] },
  { category: 'fastfood', tokens: ['sandwich', 'chicken', 'fried_food', 'fried'] },
]

function foldToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Rozdělení OSM cuisine na tokeny (`a;b` / `a,b` / `a b` jen u víceslovných tagů s `_`). */
export function cuisineTokens(cuisine) {
  return String(cuisine || '')
    .split(/[;,]/)
    .map(foldToken)
    .filter(Boolean)
}

export function classifyFromCuisine(cuisine) {
  const tokens = cuisineTokens(cuisine)
  if (tokens.length === 0) return null

  for (const rule of CUISINE_RULES) {
    for (const token of tokens) {
      if (rule.tokens.includes(token)) {
        const category = rule.category
        return { category, type: TYPE_BY_CATEGORY[category] || 'Restaurace' }
      }
    }
  }
  return null
}

export function classifyFromAmenity(amenity) {
  const a = foldToken(amenity)
  if (a === 'ice_cream') return { category: 'sladke', type: 'Sladké' }
  if (a === 'cafe') return { category: 'kava', type: 'Kavárna' }
  if (a === 'fast_food' || a === 'food_court') return { category: 'fastfood', type: 'Fast food' }
  if (a === 'canteen') return { category: 'neuvedeno', type: 'Jídelna' }
  if (a === 'restaurant') return { category: 'neuvedeno', type: 'Restaurace' }
  return { category: 'neuvedeno', type: 'Neuvedeno' }
}

/** Nejdřív cuisine, pak amenity. */
export function classifyOsmTags({ cuisine, amenity } = {}) {
  return classifyFromCuisine(cuisine) || classifyFromAmenity(amenity)
}

/** Detekce známé kolize regexů (pro testy a audit). */
export function legacyTeaMatchesSteakHouse(cuisine = 'steak_house') {
  return /coffee|cafe|tea|teahouse|bubble_tea/.test(String(cuisine).toLowerCase())
}

export function safeTeaMatchesSteakHouse(cuisine = 'steak_house') {
  const hit = classifyFromCuisine(cuisine)
  return hit?.category === 'kava'
}
