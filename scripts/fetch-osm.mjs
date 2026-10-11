import { writeFileSync } from 'fs'

const query = `[out:json][timeout:60];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|canteen|ice_cream)$"](49.137,16.428,49.294,16.728);
);
out tags;
`

const endpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

let lastError = ''
for (const url of endpoints) {
  try {
    console.log('trying', url)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CheapEatsBrno/1.0 (student project; OSM Overpass)',
      },
      body: new URLSearchParams({ data: query }),
    })
    const text = await res.text()
    console.log('status', res.status, 'bytes', text.length, 'start', text.slice(0, 80).replaceAll('\n', ' '))
    if (res.ok && text.trim().startsWith('{')) {
      writeFileSync(new URL('../osm-brno-food.json', import.meta.url), text, 'utf8')
      process.exit(0)
    }
    lastError = text.slice(0, 200)
  } catch (err) {
    lastError = String(err)
    console.log('fail', lastError)
  }
}

console.error('All Overpass endpoints failed', lastError)
process.exit(1)
