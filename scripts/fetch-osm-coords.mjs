/**
 * Souřadnice z oficiálního OSM API k ID z osm-brno-food.json.
 * Není to placené Places API. Nevymýšlí lat/lon.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'

const dumpPath = new URL('../osm-brno-food.json', import.meta.url)
if (!existsSync(dumpPath)) {
  console.error('Chybí osm-brno-food.json')
  process.exit(1)
}

const dump = JSON.parse(readFileSync(dumpPath, 'utf8'))
const headers = { 'User-Agent': 'CheapEatsBrno/1.0 (student project; OSM API)' }

async function getJson(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const nodes = dump.elements.filter((el) => el.type === 'node')
const ways = dump.elements.filter((el) => el.type === 'way')
const nodeTags = new Map(nodes.map((n) => [n.id, n.tags || {}]))
const byId = new Map()

const nodeIds = nodes.map((n) => n.id)
const batchSize = 80
for (let i = 0; i < nodeIds.length; i += batchSize) {
  const batch = nodeIds.slice(i, i + batchSize)
  const url = `https://api.openstreetmap.org/api/0.6/nodes.json?nodes=${batch.join(',')}`
  const data = await getJson(url)
  for (const el of data.elements || []) {
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
      const tags = nodeTags.get(el.id) || el.tags || {}
      byId.set(`node:${el.id}`, {
        type: 'node',
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        tags,
      })
    }
  }
  console.log('nodes', Math.min(i + batchSize, nodeIds.length), '/', nodeIds.length)
  await sleep(150)
}

for (const way of ways) {
  try {
    const data = await getJson(`https://api.openstreetmap.org/api/0.6/way/${way.id}/full.json`)
    const pts = (data.elements || []).filter(
      (el) => el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number',
    )
    if (!pts.length) continue
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
    const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length
    byId.set(`way:${way.id}`, {
      type: 'way',
      id: way.id,
      lat,
      lon,
      tags: way.tags || {},
    })
  } catch (err) {
    console.log('way skip', way.id, String(err.message || err))
  }
  await sleep(150)
}

const elements = [...byId.values()]
writeFileSync(
  new URL('../osm-brno-coords.json', import.meta.url),
  JSON.stringify({ generator: 'osm-api-0.6', elements }, null, 2),
  'utf8',
)
console.log({ saved: elements.length, nodes: nodeIds.length, ways: ways.length })
