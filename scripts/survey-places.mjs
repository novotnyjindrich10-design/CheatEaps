import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'

const seen = new Set()
const places = []
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  places.push(r)
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const withWeb = places.filter((p) => p.website)
const hosts = {}
const names = {}
for (const p of places) {
  names[p.name] = (names[p.name] || 0) + 1
  if (!p.website) continue
  const h = host(p.website)
  if (!hosts[h]) hosts[h] = []
  hosts[h].push(p.id)
}

const multiHost = Object.entries(hosts)
  .filter(([, ids]) => ids.length > 1)
  .sort((a, b) => b[1].length - a[1].length)
const chains = Object.entries(names)
  .filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1])

const skipHost = /facebook|instagram|twitter|tiktok|maps\.google|youtube/
const fetchable = withWeb.filter((p) => !skipHost.test(p.website) && !verifiedPrices[p.id])

console.log(
  JSON.stringify(
    {
      total: places.length,
      priced: Object.keys(verifiedPrices).length,
      withWebsite: withWeb.length,
      fetchableOfficialLooking: fetchable.length,
      noWebsite: places.length - withWeb.length,
      multiHost: multiHost.slice(0, 40).map(([h, ids]) => [h, ids.length]),
      chains: chains.slice(0, 40).map(([n, c]) => [n, c]),
    },
    null,
    2,
  ),
)
