/**
 * Pilot: 20 podniků. Volné zdroje bez placeného API.
 * Neukládá Google Images jako použitelnou fotografii.
 */
import { writeFileSync, readFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { officialWebsites } from '../src/data/officialWebsites.js'
import { placePhotos } from '../src/data/placePhotos.js'

const PILOT_IDS = [
  'dhaba-beas-panska',
  'forkys-vankovka',
  'rebio-velky-spalicek',
  'bistro-franz',
  'lokal-u-caipla',
  'stopkova-plzenska-pivnice',
  'la-strada-brno',
  'prova-bistro-pizza',
  'mamas-burger',
  'uvozna-burger',
  'kurdsky-kebab-cejl',
  'lokofu',
  'oh-pho',
  'ilegal-restaurant',
  'skog-urban-hub',
  'cukrarna-vetrnik-lidicka',
  'bageterie-boulevard-vankovka',
  'antalya-doner-kebap-palavske-namesti-3c',
  '7days-videnska-132-100',
  'monogram-espresso-bar',
]

const UA = 'CheapEatsBrno/1.0 (student project; photo license research; not for bulk download)'
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
  'google.com',
  'gstatic.com',
  'ggpht.com',
]

const FOOD_RE =
  /pizza|burger|ramen|pho|taco|burrito|kebab|gyros|falafel|cake|desert|dessert|salad|bowl|sushi|dumpling|wrap|bageta|baguette|sandwich|steak|gulas|svickov|jidlo|jídlo|food|meal|dish|menu|poke|latte|pastry|zakus|dort|livan|pancake|knedl|riffle|hranol|fries|noodle|curry|thali|naan|hummus|quesadill|seitan|tofu|gelato|zmrzlin|kava|káva|coffee|croissant|laskonk/i
const LOGO_RE = /logo|favicon|logotype|oglogo|og-logo|sprite|icon[-_]|wordmark/i
const INTERIOR_RE =
  /interior|interier|interiér|prostor|salonek|facade|fasad|budova|exterier|garden|zahrad|local-|venue|prostory|pobocka-foto|storefront/i

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function blockedHost(host) {
  return BLOCKED.some((b) => host === b || host.endsWith(`.${b}`) || host.includes(b))
}

function relatedHost(pageHost, imageHost) {
  if (!pageHost || !imageHost) return false
  if (pageHost === imageHost) return true
  if (imageHost.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${imageHost}`)) return true
  const cdn = ['cloudinary.com', 'imgix.net', 'shopify.com', 'myshoptet.com', 'wp.com', 'googleusercontent.com']
  return cdn.some((c) => imageHost === c || imageHost.endsWith(`.${c}`))
}

function absUrl(raw, base) {
  try {
    return new URL(raw, base).href
  } catch {
    return ''
  }
}

async function fetchText(url, timeout = 9000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
      redirect: 'follow',
    })
    if (!res.ok) return { ok: false, status: res.status, text: '' }
    return { ok: true, status: res.status, text: await res.text() }
  } catch (err) {
    return { ok: false, status: 0, text: '', error: String(err.message || err) }
  } finally {
    clearTimeout(t)
  }
}

function guessPages(site) {
  if (!site) return []
  let origin
  try {
    origin = new URL(site).origin
  } catch {
    return [site]
  }
  const extra = ['/menu', '/nabidka', '/nabídka', '/jidelnicek', '/jídelníček', '/galerie', '/gallery']
  const urls = [site]
  for (const path of extra) {
    const next = `${origin}${path}`
    if (!urls.includes(next)) urls.push(next)
  }
  return urls.slice(0, 4)
}

function extractImages(html, pageUrl) {
  const found = []
  const push = (raw, alt = '', kind = 'img') => {
    const url = absUrl(String(raw || '').trim(), pageUrl)
    if (!url.startsWith('https://')) return
    found.push({ url, alt: String(alt || ''), kind, pageUrl })
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    const data = tag.match(/\b(?:data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1]
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] || ''
    if (src) push(src, alt, 'img')
    if (data) push(data, alt, 'lazy')
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1]
    if (srcset) {
      const first = srcset.split(',')[0]?.trim().split(/\s+/)[0]
      if (first) push(first, alt, 'srcset')
    }
  }
  for (const re of [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]) {
    const m = html.match(re)
    if (m?.[1]) push(m[1], 'og:image', 'og')
  }
  return found
}

function classifyOfficial(url, alt, pageHost) {
  const blob = `${url} ${alt}`.toLowerCase()
  if (LOGO_RE.test(blob) || /\.(svg|ico)(\?|$)/.test(url.toLowerCase())) return 'logo'
  if (!relatedHost(pageHost, hostOf(url))) return 'offsite'
  if (blockedHost(hostOf(url))) return 'blocked'
  if (FOOD_RE.test(blob)) return 'likely_food'
  if (INTERIOR_RE.test(blob)) return 'likely_interior'
  return 'unclassified'
}

function scoreOfficial(kind) {
  if (kind === 'likely_food') return 80
  if (kind === 'unclassified') return 40
  if (kind === 'likely_interior') return 15
  return 0
}

async function searchWikimedia(query) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&list=search&format=json&origin=*&srnamespace=6&srlimit=5&srsearch=' +
    encodeURIComponent(query)
  const { ok, text } = await fetchText(url, 10000)
  if (!ok) return { error: text, hits: [] }
  try {
    const data = JSON.parse(text)
    const titles = (data.query?.search || []).map((s) => s.title)
    if (!titles.length) return { hits: [] }
    const infoUrl =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata|size&titles=' +
      encodeURIComponent(titles.join('|'))
    const info = await fetchText(infoUrl, 10000)
    if (!info.ok) return { hits: [] }
    const pages = JSON.parse(info.text).query?.pages || {}
    return {
      hits: Object.values(pages)
        .map((p) => {
          const ii = p.imageinfo?.[0]
          const meta = ii?.extmetadata || {}
          return {
            title: p.title,
            url: ii?.url,
            license: meta.LicenseShortName?.value || meta.License?.value || '',
            artist: meta.Artist?.value?.replace(/<[^>]+>/g, '') || '',
            credit: meta.Credit?.value?.replace(/<[^>]+>/g, '') || '',
            description: meta.ImageDescription?.value?.replace(/<[^>]+>/g, '') || '',
            width: ii?.width,
            height: ii?.height,
          }
        })
        .filter((h) => h.url),
    }
  } catch (err) {
    return { error: String(err.message || err), hits: [] }
  }
}

async function searchOpenverse(query) {
  const url =
    'https://api.openverse.org/v1/images/?page_size=5&license_type=commercial&q=' +
    encodeURIComponent(query)
  const { ok, status, text } = await fetchText(url, 10000)
  if (!ok) return { error: `HTTP ${status}`, hits: [] }
  try {
    const data = JSON.parse(text)
    return {
      hits: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        thumbnail: r.thumbnail,
        license: r.license,
        licenseUrl: r.license_url,
        creator: r.creator,
        foreignLandingUrl: r.foreign_landing_url,
        source: r.source,
      })),
    }
  } catch (err) {
    return { error: String(err.message || err), hits: [] }
  }
}

function osmDumpImages(name) {
  const dump = readFileSync(new URL('../osm-brno-food.json', import.meta.url), 'utf8')
  const needle = `"name": "${name.replace(/"/g, '')}"`
  const idx = dump.indexOf(needle)
  if (idx < 0) return []
  const slice = dump.slice(Math.max(0, idx - 800), idx + 1200)
  const image = slice.match(/"image"\s*:\s*"(https?:[^"]+)"/)?.[1]
  const commons = slice.match(/"wikimedia_commons"\s*:\s*"([^"]+)"/)?.[1]
  const out = []
  if (image) out.push({ kind: 'osm_image', url: image })
  if (commons) out.push({ kind: 'osm_wikimedia', file: commons })
  return out
}

const byId = new Map([...curatedPlaces, ...osmPlaces].map((p) => [p.id, p]))
const errors = []
const rows = []

for (const id of PILOT_IDS) {
  const place = byId.get(id)
  if (!place) {
    errors.push(`Chybí podnik ${id}`)
    continue
  }
  const site = officialWebsites[id]?.officialWebsite || ''
  const pageHost = hostOf(site)
  const existingOg = placePhotos[id] || null
  const candidates = []
  const notes = []

  if (site) {
    const pages = guessPages(site)
    for (const page of pages) {
      const res = await fetchText(page)
      if (!res.ok) {
        notes.push(`web ${page} → ${res.status || res.error}`)
        continue
      }
      const imgs = extractImages(res.text, page)
      for (const img of imgs) {
        const kind = classifyOfficial(img.url, img.alt, pageHost)
        const score = scoreOfficial(kind)
        if (score <= 0) continue
        candidates.push({
          url: img.url,
          sourceUrl: img.pageUrl,
          sourceType: 'official_website',
          imageKindGuess: kind,
          alt: img.alt,
          license: 'restaurant-copyright',
          licenseNote:
            'Fotografie z webu podniku. Autorské právo zůstává restauraci; nález na webu není CC licence.',
          score,
        })
      }
    }
  } else {
    notes.push('bez oficiálního webu')
  }

  const osmImgs = osmDumpImages(place.name)
  for (const item of osmImgs) {
    if (item.url) {
      candidates.push({
        url: item.url,
        sourceUrl: 'OpenStreetMap tag image',
        sourceType: 'osm_image',
        imageKindGuess: classifyOfficial(item.url, '', hostOf(item.url)),
        license: 'unknown-osm',
        licenseNote: 'OSM tag image= odkazuje na cizí URL; licence se musí ověřit u zdroje.',
        score: 35,
      })
    }
    if (item.file) notes.push(`OSM wikimedia_commons=${item.file}`)
  }

  const wikiQ = `${place.name} Brno`
  const wiki = await searchWikimedia(wikiQ)
  if (wiki.error) notes.push(`wikimedia: ${wiki.error}`)
  for (const hit of wiki.hits || []) {
    const blob = `${hit.title} ${hit.description}`
    const venueHit = new RegExp(place.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(
      blob,
    )
    candidates.push({
      url: hit.url,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(hit.title)}`,
      sourceType: 'wikimedia_commons',
      imageKindGuess: FOOD_RE.test(blob) ? 'likely_food' : INTERIOR_RE.test(blob) ? 'likely_interior' : 'unclassified',
      license: hit.license,
      licenseNote: `Wikimedia: ${hit.license || 'neznámá'}. Autor: ${hit.artist || 'neuveden'}.`,
      creator: hit.artist,
      title: hit.title,
      venueNameInMetadata: venueHit,
      score: venueHit ? 70 : 20,
    })
  }

  await new Promise((r) => setTimeout(r, 250))
  const ov = await searchOpenverse(`${place.name} Brno`)
  if (ov.error) notes.push(`openverse: ${ov.error}`)
  for (const hit of ov.hits || []) {
    const blob = `${hit.title} ${hit.creator} ${hit.foreignLandingUrl}`
    const venueHit = new RegExp(place.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(
      blob,
    )
    candidates.push({
      url: hit.url,
      sourceUrl: hit.foreignLandingUrl || hit.thumbnail,
      sourceType: 'openverse',
      imageKindGuess: FOOD_RE.test(blob) ? 'likely_food' : 'unclassified',
      license: hit.license,
      licenseUrl: hit.licenseUrl,
      licenseNote: `Openverse licence ${hit.license}. Nutné uvést autora.`,
      creator: hit.creator,
      title: hit.title,
      venueNameInMetadata: venueHit,
      score: venueHit ? 65 : 10,
    })
  }

  const uniq = []
  const seen = new Set()
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    uniq.push(c)
  }

  rows.push({
    id,
    name: place.name,
    address: place.address,
    category: place.category,
    officialWebsite: site || null,
    previousOgImage: existingOg?.heroImageUrl || null,
    notes,
    candidateCount: uniq.length,
    candidates: uniq.slice(0, 8),
  })
  console.log(`${id}: ${uniq.length} candidates`)
}

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  method: {
    paidApi: false,
    sources: ['official_website_html', 'osm_image_tag', 'wikimedia_commons_api', 'openverse_api'],
    excluded: ['Google Images (není licence)', 'Wolt/Foodora', 'Unsplash jako jídlo podniku'],
  },
  places: rows,
  errors,
}

writeFileSync(
  new URL('../reports/food-photo-pilot.raw.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
)
console.log('wrote reports/food-photo-pilot.raw.json', rows.length)
