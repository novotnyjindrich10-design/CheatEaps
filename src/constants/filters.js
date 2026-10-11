/**
 * Možnosti filtrů, kategorií a řazení.
 * Pořadí je odhad poptávky: v projektu nejsou statistiky používání kategorií.
 * Napřed běžné volby, potom ostatní.
 */
export const FOOD_CATEGORIES = [
  { value: 'pizza', label: 'Pizza', emoji: '🍕', home: true },
  { value: 'burger', label: 'Burger', emoji: '🍔', home: true },
  { value: 'asijske', label: 'Asie', emoji: '🍜', home: true },
  { value: 'ceske', label: 'Česká kuchyně', emoji: '🍲', home: true },
  { value: 'vegetarianske', label: 'Bez masa', emoji: '🥗', home: true },
  { value: 'veganske', label: 'Vegan', emoji: '🌱', home: true },
  { value: 'kebab', label: 'Kebab', emoji: '🌯', home: true },
  { value: 'cina', label: 'Čína', emoji: '🥡', home: true },
  { value: 'mexiko', label: 'Mexiko', emoji: '🌮', home: true },
  { value: 'kava', label: 'Kavárny', emoji: '☕', home: true },
  { value: 'fastfood', label: 'Fast food', emoji: '🍟', home: false },
  { value: 'sladke', label: 'Sladké', emoji: '🧁', home: true },
  { value: 'zdrave', label: 'Zdravé', emoji: '🥑', home: true },
]

export const HOME_CATEGORIES = FOOD_CATEGORIES.filter((c) => c.home)

/** Kategorie, když OSM tagy nestačí. Není v dlaždicích na úvodní stránce. */
export const UNKNOWN_CATEGORY = 'neuvedeno'

export const ALLOWED_PLACE_CATEGORIES = [
  ...FOOD_CATEGORIES.map((c) => c.value),
  UNKNOWN_CATEGORY,
]

/** Odkaz z hlavní stránky / karet kategorií na `type` (včetně Bez masa a Vegan). */
export function buildCategoryHref(value) {
  if (!value) return '/results'
  return `/results?type=${encodeURIComponent(value)}`
}

/** Změní jen kategorii podniku. Dietní filtry, rozpočet a hledání nechá beze změny. */
export function applyCategorySelection(filters, value) {
  return { ...filters, cuisineType: value }
}

export function getActiveCategoryKey(filters) {
  return filters.cuisineType || ''
}

export function getCategoryMeta(value) {
  return FOOD_CATEGORIES.find((c) => c.value === value) ?? null
}

/** Starší URL parametry (kantýna, polévky) mapujeme na nové kategorie. */
export const LEGACY_CATEGORY_MAP = {
  kantyna: 'ceske',
  polévky: 'ceske',
}

export const BUDGET_OPTIONS = [
  { value: '', label: 'Libovolný rozpočet' },
  { value: '80', label: 'Do 80 Kč' },
  { value: '120', label: 'Do 120 Kč' },
  { value: '150', label: 'Do 150 Kč' },
  { value: '200', label: 'Do 200 Kč' },
  { value: '250', label: 'Do 250 Kč' },
  { value: '350', label: 'Do 350 Kč' },
]

export const QUICK_BUDGETS = [80, 120, 150, 200, 250, 350]

export const CUISINE_OPTIONS = [
  { value: '', label: 'Všechny typy' },
  ...FOOD_CATEGORIES.map(({ value, label, emoji }) => ({
    value,
    label: `${emoji} ${label}`,
  })),
]

export const DISTANCE_OPTIONS = [
  { value: '', label: 'Libovolná vzdálenost' },
  { value: '1', label: 'Do 1 km' },
  { value: '2', label: 'Do 2 km' },
  { value: '3', label: 'Do 3 km' },
  { value: '5', label: 'Do 5 km' },
]

export const SORT_OPTIONS = [
  { value: 'rating', label: 'Nejlépe hodnocené' },
  { value: 'price-asc', label: 'Nejlevnější' },
  { value: 'price-desc', label: 'Nejdražší' },
  { value: 'distance', label: 'Nejblíž ke mně' },
]

export const PRICE_CATEGORY_LABELS = {
  budget: 'Levné',
  standard: 'Střední',
  premium: 'Pro větší hlad',
}

export function normalizeCategoryParam(value) {
  if (!value) return ''
  return LEGACY_CATEGORY_MAP[value] ?? value
}
