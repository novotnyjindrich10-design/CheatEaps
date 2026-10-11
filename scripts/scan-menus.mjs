import { mkdirSync, writeFileSync } from 'fs'
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

const SKIP =
  /facebook\.|instagram\.|twitter\.|tiktok\.|youtube\.|maps\.google|wolt\.com|foodora\.|damejidlo|ubereats|linktr\.ee/i

const DRINK =
  /\b(pivo|pívo|beer|víno|vino|prosecco|kofola|cola|sprite|fanta|limonád|káva|kava|espresso|cappuccino|latte|americano|čaj|caj|voda|nealko|míchaný nápoj|shot|gin |rum |whisky|vodka|aperol|spritz|mojito)\b/i
const SIDE =
  /\b(hranolky|dip|omáčka|omacka|pečivo|pecivo|chléb|chleb|bageta 1|kečup|kecup|majonéza|mayo|sůl|sul)\b/i
const FOODISH =
  /\b(pizza|burger|kebab|pho|ramen| nudle|nudle|rýže|ryze|řízek|rizek|guláš|gulas|svíčková|svickova|pasta|spaghetti|quesadilla|burrito|taco|wrap|bowl|salát|salat|sendvič|sandwich|bageta|snídan|snidan|polévka|polevka|steak|křídla|kridla|nugget|smažen|smazen|knedlí|knedli|tofu|curry|kari|sushi|dumpling|knedlíček|knedlicek|káč|kachna|kuře|kure|vepř|vepr|hověz|hovez|menu|polední|poledni|oběd|obed)\b/i

function decode(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
}

function parseItems(text) {
  const items = []
  const re = /([A-Za-zÁ-ž0-9][^|]{2,80}?)\s+(\d{2,4})\s*(?:Kč|Kč|-,-|,-)/gi
  let m
  while ((m = re.exec(text))) {
    const name = m[1].replace(/^[,.\-–\s]+/, '').trim()
    const price = Number(m[2])
    if (!name || name.length < 4 || name.length > 70) continue
    if (price < 49 || price > 650) continue
    items.push({ name, price })
  }
  const re2 = /(\d{2,4})\s*(?:Kč|,-)\s+([A-Za-zÁ-ž][^|]{2,70})/gi
  while ((m = re2.exec(text))) {
    const price = Number(m[1])
    const name = m[2].trim()
    if (price < 49 || price > 650 || name.length < 4) continue
    items.push({ name, price })
  }
  return items
}

function mainsFrom(items) {
  return items.filter((it) => {
    if (DRINK.test(it.name)) return false
    if (SIDE.test(it.name) && it.price < 100) return false
    if (it.price < 89 || it.price > 420) return false
    return FOODISH.test(it.name) || it.price >= 119
  })
}

function pick(mains) {
  if (!mains.length) return null
  const sorted = [...mains].sort((a, b) => a.price - b.price)
  const mid = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0].price
  const max = sorted[sorted.length - 1].price
  if (sorted.length >= 4 && max - min >= 40) {
    return {
      kind: 'range',
      min,
      max,
      item: mid.name.slice(0, 80),
      sample: sorted.length,
    }
  }
  return {
    kind: 'menu',
    price: mid.price,
    item: mid.name.slice(0, 80),
    sample: sorted.length,
  }
}

async function fetchText(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 CheapEatsPriceAudit/1.0 (research; +https://localhost) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(t)
    if (!res.ok) return { status: res.status, text: '' }
    const ctype = res.headers.get('content-type') || ''
    if (!/html|xml|text|json/i.test(ctype) && ctype) return { status: res.status, text: '' }
    const text = await res.text()
    return { status: res.status, text: text.slice(0, 450000) }
  } catch (err) {
    clearTimeout(t)
    return { status: 0, text: '', error: String(err.message || err) }
  }
}

function menuUrls(website) {
  const base = website.replace(/\/$/, '')
  const extra = ['/menu', '/menu/', '/jidelni-listek', '/nabidka', '/jidlo']
  const urls = [website]
  for (const p of extra) {
    try {
      const u = new URL(p, `${base}/`).href
      if (!urls.includes(u)) urls.push(u)
    } catch {
      /* ignore */
    }
  }
  return urls.slice(0, 3)
}

const targets = places.filter((p) => p.website && !SKIP.test(p.website))
const results = []
const concurrency = 8
let i = 0

async function worker() {
  while (i < targets.length) {
    const idx = i
    i += 1
    const p = targets[idx]
    let best = { items: [], url: p.website, status: 0 }
    for (const url of menuUrls(p.website)) {
      const page = await fetchText(url)
      const items = parseItems(decode(page.text || ''))
      if (items.length > best.items.length) best = { items, url, status: page.status, error: page.error }
      if (mainsFrom(items).length >= 3) break
    }
    const mains = mainsFrom(best.items)
    const choice = pick(mains)
    results.push({
      id: p.id,
      name: p.name,
      already: Boolean(verifiedPrices[p.id]),
      website: p.website,
      usedUrl: best.url,
      status: best.status,
      error: best.error || '',
      rawCount: best.items.length,
      mainCount: mains.length,
      choice,
      sample: mains.slice(0, 8),
    })
    if (results.length % 40 === 0) {
      console.error(`scanned ${results.length}/${targets.length}`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

mkdirSync(new URL('../reports', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../reports/menu-scan.json', import.meta.url),
  JSON.stringify(results, null, 2),
)
const withChoice = results.filter((r) => r.choice)
console.log({
  scanned: results.length,
  withChoice: withChoice.length,
  menu: withChoice.filter((r) => r.choice.kind === 'menu').length,
  range: withChoice.filter((r) => r.choice.kind === 'range').length,
  alreadyPricedHits: results.filter((r) => r.already && r.choice).length,
})
