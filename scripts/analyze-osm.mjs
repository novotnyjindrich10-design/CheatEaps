import { readFileSync } from 'fs'

const data = JSON.parse(readFileSync(new URL('../osm-brno-food.json', import.meta.url), 'utf8'))
const cuisineCount = {}
let skippedCity = 0
let skippedClosed = 0
let ok = 0

for (const el of data.elements || []) {
  const t = el.tags || {}
  if (!t.name || !t['addr:street'] || !t['addr:housenumber']) continue
  if (t.disused === 'yes' || t.abandoned === 'yes' || t['disused:amenity'] || t.opening_hours === 'closed') {
    skippedClosed++
    continue
  }
  const city = (t['addr:city'] || '').trim()
  if (city && !/brno/i.test(city)) {
    skippedCity++
    continue
  }
  ok++
  const c = t.cuisine || '(none)'
  cuisineCount[c] = (cuisineCount[c] || 0) + 1
}

console.log({ ok, skippedCity, skippedClosed })
console.log(
  Object.entries(cuisineCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40),
)
