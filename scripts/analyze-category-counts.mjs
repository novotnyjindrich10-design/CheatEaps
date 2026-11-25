import { writeFileSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { categoryOverrides } from '../src/data/categoryOverrides.js'
import { isCatalogExcluded } from '../src/data/catalogExclusions.js'
import { FOOD_CATEGORIES } from '../src/constants/filters.js'
import { osmFacts } from '../src/data/osmFacts.js'
import { officialWebsites } from '../src/data/officialWebsites.js'

const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!entry?.id || isCatalogExcluded(entry.id)) continue
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

const places = [...byId.values()].map((entry) => {
  const override = categoryOverrides[entry.id]
  const facts = osmFacts[entry.id] || {}
  const site = officialWebsites[entry.id] || {}
  return {
    ...entry,
    ...facts,
    ...site,
    category: override?.category || entry.category || 'neuvedeno',
    secondaryCategories: override?.secondaryCategories || [],
  }
})

const counts = Object.fromEntries([...FOOD_CATEGORIES.map((c) => c.value), 'neuvedeno'].map((k) => [k, 0]))
for (const place of places) {
  const key = counts[place.category] != null ? place.category : 'neuvedeno'
  counts[key] += 1
}

const hints = [
  { cat: 'kava', re: /\b(kavarn|cafe|coffee|espresso|brunch|snidan|cappuccino)\b/i },
  { cat: 'zdrave', re: /\b(zdrav|healthy|salad|bowl|poke|fitness|fresh|smoothie)\b/i },
  { cat: 'vegetarianske', re: /\b(vegetar|bez\s*masa|plant[- ]?based)\b/i },
  { cat: 'veganske', re: /\bvegan\b/i },
  { cat: 'pizza', re: /\bpizza|pizzer/i },
  { cat: 'burger', re: /\bburger|hamburger\b/i },
  { cat: 'sladke', re: /\b(cukrar|dessert|dort|zakus|gelato|zmrzlin|pekarn|bakery|patisserie)\b/i },
  { cat: 'asijske', re: /\b(sushi|pho|ramen|asian|vietnam|thai|japan|korea|asij|noodle)\b/i },
  { cat: 'cina', re: /\b(cinsk|chinese|china|dim\s*sum)\b/i },
  { cat: 'mexiko', re: /\b(mexi|taco|burrito)\b/i },
  { cat: 'kebab', re: /\b(kebab|shawarma|gyros|doner)\b/i },
]

const candidates = []
for (const place of places) {
  const blob = [place.name, place.type, place.description, place.osmCuisine, place.priceItem]
    .filter(Boolean)
    .join(' | ')
  for (const { cat, re } of hints) {
    if (place.category === cat) continue
    if ((place.secondaryCategories || []).includes(cat)) continue
    if (!re.test(blob)) continue
    candidates.push({
      id: place.id,
      name: place.name,
      primary: place.category,
      maybe: cat,
      website: place.officialWebsite || place.website || '',
      osmCuisine: place.osmCuisine || '',
      blob: blob.slice(0, 180),
    })
  }
}

const sparse = Object.entries(counts)
  .filter(([k]) => k !== 'neuvedeno')
  .sort((a, b) => a[1] - b[1])

const report = {
  total: places.length,
  counts,
  sparse,
  candidateCount: candidates.length,
  candidatesByMaybe: Object.fromEntries(
    hints.map(({ cat }) => [cat, candidates.filter((c) => c.maybe === cat).length]),
  ),
  sample: candidates.slice(0, 80),
}

writeFileSync('reports/category-counts-before.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ total: report.total, counts, sparse, candidateCount: candidates.length, byMaybe: report.candidatesByMaybe }, null, 2))
