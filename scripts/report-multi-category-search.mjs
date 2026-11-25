import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { categoryOverrides } from '../src/data/categoryOverrides.js'
import { secondaryCategoryByPlaceId, listSecondaryAssignments } from '../src/data/secondaryCategories.js'
import { isCatalogExcluded } from '../src/data/catalogExclusions.js'
import { FOOD_CATEGORIES } from '../src/constants/filters.js'
import { filterAndSortRestaurants } from '../src/utils/filterRestaurants.js'
import { getRestaurantCategory } from '../src/utils/restaurantTags.js'

const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!entry?.id || isCatalogExcluded(entry.id)) continue
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

const restaurants = [...byId.values()].map((entry) => {
  const override = categoryOverrides[entry.id]
  const secondaryInfo = secondaryCategoryByPlaceId[entry.id]
  const category = override?.category || entry.category || 'neuvedeno'
  return {
    ...entry,
    category,
    cuisineType: category,
    type: override?.type || entry.type,
    description: override?.description || entry.description,
    secondaryCategories: (secondaryInfo?.secondary || []).filter((value) => value && value !== category),
    verifiedProducts: secondaryInfo?.products || [],
  }
})

function countPrimary() {
  const counts = Object.fromEntries([...FOOD_CATEGORIES.map((c) => c.value), 'neuvedeno'].map((k) => [k, 0]))
  for (const place of restaurants) {
    const key = getRestaurantCategory(place) || 'neuvedeno'
    counts[counts[key] != null ? key : 'neuvedeno'] += 1
  }
  return counts
}

function countReachable() {
  const reachable = Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.value, 0]))
  for (const cat of FOOD_CATEGORIES.map((c) => c.value)) {
    reachable[cat] = filterAndSortRestaurants(restaurants, {
      cuisineType: cat,
      sortBy: 'relevance',
    }).length
  }
  return reachable
}

const queries = [
  'káva',
  'kavárna',
  'espresso',
  'pizza',
  'burger',
  'asie',
  'sushi',
  'pho',
  'zdravé',
  'snídaně',
  'brunch',
  'veganské',
  'vegetariánské',
]

const searchSamples = {}
for (const q of queries) {
  const hits = filterAndSortRestaurants(restaurants, { search: q, sortBy: 'relevance' }).slice(0, 15)
  searchSamples[q] = hits.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    secondary: place.secondaryCategories || [],
    products: place.verifiedProducts || [],
  }))
}

const assignments = listSecondaryAssignments()
const primaryCounts = countPrimary()
const reachable = countReachable()
const before = existsSync('reports/category-counts-before.json')
  ? JSON.parse(readFileSync('reports/category-counts-before.json', 'utf8'))
  : null

const report = {
  generatedAt: new Date().toISOString(),
  primaryCountsBefore: before?.counts || null,
  primaryCountsAfter: primaryCounts,
  reachableViaFilter: reachable,
  newAssignments: assignments.length,
  secondaryCategoryLinks: assignments.reduce((n, row) => n + (row.secondary?.length || 0), 0),
  productLinks: assignments.reduce((n, row) => n + (row.products?.length || 0), 0),
  assignments,
  searchSamples,
}

writeFileSync('reports/multi-category-search-report.json', JSON.stringify(report, null, 2))

const md = `# Multi-category search report

Generated: ${report.generatedAt}

## Primary category counts

Primární kategorie se sekundárními přiřazeními **nemění**.

| Category | Before | After |
| --- | ---: | ---: |
${Object.keys(primaryCounts)
  .map((k) => `| ${k} | ${before?.counts?.[k] ?? '—'} | ${primaryCounts[k]} |`)
  .join('\n')}

## Reachable via category filter (primary + verified secondary)

| Category | Reachable |
| --- | ---: |
${Object.entries(reachable)
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join('\n')}

## New verified assignments

- Places touched: **${assignments.length}**
- Secondary category links: **${report.secondaryCategoryLinks}**
- Verified product links: **${report.productLinks}**

## Top search samples

${queries
  .map((q) => {
    const rows = searchSamples[q]
      .slice(0, 8)
      .map(
        (row, i) =>
          `${i + 1}. ${row.name} (${row.category}${row.secondary.length ? ` + ${row.secondary.join(',')}` : ''})`,
      )
      .join('\n')
    return `### „${q}“\n${rows || '_žádné_'}`
  })
  .join('\n\n')}
`

writeFileSync('reports/multi-category-search-report.md', md)
console.log(
  JSON.stringify(
    {
      primaryCounts,
      reachable,
      assignments: assignments.length,
      secondaryLinks: report.secondaryCategoryLinks,
      productLinks: report.productLinks,
    },
    null,
    2,
  ),
)
