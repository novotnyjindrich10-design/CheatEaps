/**
 * og:image / twitter:image z oficiálních webů. Neukládá Unsplash ani katalogy.
 */
import { writeFileSync } from 'fs'
import { officialWebsites } from '../src/data/officialWebsites.js'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'

const BLOCKED = [
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'shutterstock.com',
  'gettyimages',
  'wolt.com',
  'foodora',
  'tripadvisor',
  'facebook.com',
  'fbcdn.net',
  'instagram.com',
]

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function relatedHost(pageHost, imageHost) {
  if (!pageHost || !imageHost) return false
  if (pageHost === imageHost) return true
  if (imageHost.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${imageHost}`)) return true
  const cdn = ['cloudinary.com', 'imgix.net', 'shopify.com', 'myshoptet.com', 'googleusercontent.com']
  return cdn.some((c) => imageHost === c || imageHost.endsWith(`.${c}`))
}

function blockedHost(host) {
  return BLOCKED.some((b) => host === b || host.endsWith(`.${b}`) || host.includes(b))
}

function looksLikeLogo(url) {
  const u = url.toLowerCase()
  if (!u.startsWith('https://')) return true
  if (/\.(svg|ico)(\?|$)/.test(u)) return true
  return /logo|favicon|logotype|oglogo|og-logo|sprite/.test(u)
}

function absUrl(raw, base) {
  try {
    return new URL(raw, base).href
  } catch {
    return ''
  }
}

function pickMeta(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return absUrl(m[1].trim(), base)
  }
  return ''
}

async function fetchImageCandidate(site) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(site, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CheapEatsBrno/1.0 (student project; photo attribution)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const image = pickMeta(html, site)
    if (!image.startsWith('http')) return null
    const imgHost = hostOf(image)
    const pageHost = hostOf(site)
    if (blockedHost(imgHost)) return null
    if (!relatedHost(pageHost, imgHost)) return null
    if (looksLikeLogo(image)) return null
    return image
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

const names = new Map([...curatedPlaces, ...osmPlaces].map((p) => [p.id, p.name]))
const entries = Object.entries(officialWebsites)
const overlay = {}
const pageCache = new Map()
let found = 0
let failed = 0

async function cachedImage(site) {
  if (!pageCache.has(site)) pageCache.set(site, fetchImageCandidate(site))
  return pageCache.get(site)
}

for (let i = 0; i < entries.length; i += 8) {
  const batch = entries.slice(i, i + 8)
  const results = await Promise.all(
    batch.map(async ([id, row]) => {
      const url = await cachedImage(row.officialWebsite)
      return { id, url, source: row.officialWebsite }
    }),
  )
  for (const row of results) {
    if (!row.url) {
      failed += 1
      continue
    }
    found += 1
    overlay[row.id] = {
      heroImageKind: 'official',
      heroImageUrl: row.url,
      heroImageSource: row.source,
      heroImageAlt: `Jídlo z oficiálního webu – ${names.get(row.id) || row.id}`,
    }
  }
  console.log(`photos ${Math.min(i + 8, entries.length)}/${entries.length} found ${found}`)
}

writeFileSync(
  new URL('../src/data/placePhotos.js', import.meta.url),
  `/** Oficiální fotografie jídel. Regeneruj: npm run data:official-photos */
export const placePhotos = ${JSON.stringify(overlay, null, 2)}\n`,
  'utf8',
)
writeFileSync(
  new URL('../reports/official-photos.json', import.meta.url),
  JSON.stringify(
    { scanned: entries.length, officialPhotos: found, withoutPhoto: failed + (775 - entries.length) },
    null,
    2,
  ),
  'utf8',
)
console.log({ scanned: entries.length, officialPhotos: found, failed })
