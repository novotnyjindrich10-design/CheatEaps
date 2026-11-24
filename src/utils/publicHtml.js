import { CANONICAL_ORIGIN } from '../constants/site.js'
import { FOOD_CATEGORIES } from '../constants/filters.js'
import { formatPlacePrice } from './price.js'
import { metaForPath } from './pageMeta.js'
import { officialWebsiteOf } from './website.js'
import { shareImageUrl } from './placePhoto.js'

export const PRIVATE_PRERENDER_PATHS = [
  '/prihlaseni',
  '/registrace',
  '/nove-heslo',
  '/oblibene',
  '/odmeny',
  '/porovnani',
  '/admin/zadosti',
  '/admin/propagace',
  '/admin/odmeny',
]

const PUBLIC_COPY = {
  '/': {
    heading: 'Najdi jídlo v Brně',
    paragraphs: [
      'Katalog restaurací, kaváren a rychlého občerstvení v Brně. Hledej podle kategorie, ověřené ceny a vzdálenosti.',
    ],
  },
  '/results': {
    heading: 'Najít podnik v Brně',
    paragraphs: [
      'Filtruj podle peněz, chuti a vzdálenosti. Každý veřejný podnik má vlastní stránku.',
    ],
  },
  '/pro-podniky': {
    heading: 'Propagujte svůj podnik',
    paragraphs: [
      'Dostaň svou restauraci mezi lidi, kteří hledají, kde se dobře najíst.',
      'Balíčky propagace Start, Plus a Premium. Online platba není zapojená, jde poslat nezávaznou poptávku.',
    ],
  },
  '/podpor-me': {
    heading: 'Podpoř mě',
    paragraphs: [
      'Ahoj! Jsem tvůrce FoodGo Brno.',
      'FoodGo je studentský projekt: katalog, ve kterém v Brně najdeš podnik podle chuti, ceny a vzdálenosti.',
    ],
  },
  '/ochrana-osobnich-udaju': {
    heading: 'Zásady ochrany osobních údajů',
    paragraphs: [
      'Tohle není platný právní text. Je to kostra stránky. Než se na ni odkáže jako na informace o zpracování údajů, musí provozovatel doplnit označené části a nechat si text zkontrolovat.',
    ],
  },
  '/obchodni-podminky': {
    heading: 'Obchodní podmínky',
    paragraphs: [
      'Tohle nejsou platné obchodní podmínky. Je to kostra stránky. Než podle nich někdo jedná, musí provozovatel doplnit označené části a nechat si text zkontrolovat.',
    ],
  },
  '/o-foodgo': {
    heading: 'O FoodGo',
    paragraphs: [
      'FoodGo Brno je katalog podniků s jídlem. Hledáš podle chuti, rozpočtu a vzdálenosti.',
    ],
  },
  '/kontakt': {
    heading: 'Kontakt',
    paragraphs: ['Napiš na e-mail značky. Údaje provozovatele doplníme po ověření živnosti.'],
  },
  '/cookies': {
    heading: 'Informace o cookies a úložišti',
    paragraphs: [
      'FoodGo nepoužívá reklamní ani analytické cookies třetích stran. Některá data zůstávají jen v prohlížeči.',
    ],
  },
  '/reklamni-zvyrazneni': {
    heading: 'Reklamní zvýraznění',
    paragraphs: [
      'Placené umístění je označené textem Sponzorováno. Neovlivňuje hodnocení ani cenu podniku.',
    ],
  },
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

export function restaurantPageModel(place, origin = CANONICAL_ORIGIN) {
  const name = String(place?.name || 'Podnik').trim() || 'Podnik'
  const locality = String(place?.city || 'Brno').trim() || 'Brno'
  const address = [place?.address, locality].filter(Boolean).join(', ')
  const category = FOOD_CATEGORIES.find((item) => item.value === place?.category)
  const categoryLabel = category?.label || ''
  const price = formatPlacePrice(place)
  const priceLine = `${price.statusLabel}: ${price.primary}. ${price.caption}`
  const about = clip(place?.description, 320)
  const description = clip(
    [name, address, categoryLabel, about, priceLine].filter(Boolean).join(' '),
    220,
  )
  const id = String(place?.id || '').trim()
  const path = `/restaurant/${encodeURIComponent(id)}`
  return {
    id,
    name,
    address,
    locality,
    streetAddress: String(place?.address || '').trim(),
    categoryLabel,
    about,
    priceLine,
    description,
    path,
    canonical: `${origin}${path}`,
    title: `${name} | FoodGo Brno`,
    website: officialWebsiteOf(place),
  }
}

function categoryLinks() {
  return FOOD_CATEGORIES.filter((item) => item.home)
    .map(
      (item) =>
        `<li><a href="/results?type=${escapeHtml(item.value)}">${escapeHtml(item.label)}</a></li>`,
    )
    .join('')
}

export function publicSnapshot(pathname) {
  const page = PUBLIC_COPY[pathname]
  if (!page) return ''
  const extra =
    pathname === '/' || pathname === '/results' ? `<ul>${categoryLinks()}</ul>` : ''
  const paragraphs = page.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')
  return `<main><h1>${escapeHtml(page.heading)}</h1>${paragraphs}${extra}</main>`
}

export function restaurantSnapshot(model) {
  const about = model.about ? `<p>${escapeHtml(model.about)}</p>` : ''
  const category = model.categoryLabel ? `<p>${escapeHtml(model.categoryLabel)}</p>` : ''
  const website = model.website
    ? `<p><a href="${escapeHtml(model.website)}">Oficiální web</a></p>`
    : ''
  return `<main><h1>${escapeHtml(model.name)}</h1><p>${escapeHtml(model.address)}</p>${category}${about}<p>${escapeHtml(model.priceLine)}</p>${website}</main>`
}

function websiteJsonLd(origin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'FoodGo Brno',
    url: `${origin}/`,
    inLanguage: 'cs',
    description:
      'Katalog restaurací, kaváren a rychlého občerstvení v Brně. Hledej podle kategorie, ověřené ceny a vzdálenosti.',
  }
}

function restaurantJsonLd(model) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: model.name,
    url: model.canonical,
    address: {
      '@type': 'PostalAddress',
      streetAddress: model.streetAddress || model.address,
      addressLocality: model.locality,
      addressCountry: 'CZ',
    },
  }
  if (model.categoryLabel) data.servesCuisine = model.categoryLabel
  if (model.website) data.sameAs = model.website
  return data
}

function replaceTitle(html, title) {
  if (/<title>[\s\S]*?<\/title>/.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  }
  return html.replace('</head>', `    <title>${escapeHtml(title)}</title>\n  </head>`)
}

function replaceMeta(html, attr, key, content) {
  const pattern = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="[^"]*"\\s*/?>`,
    'i',
  )
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function replaceJsonLd(html, data) {
  const block = data
    ? `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n    </script>`
    : ''
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(html)) {
    return html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, block)
  }
  if (!block) return html
  return html.replace('</head>', `    ${block}\n  </head>`)
}

export function renderHtmlDocument(template, page) {
  let html = String(template || '')
  html = replaceTitle(html, page.title)
  html = replaceMeta(html, 'name', 'description', page.description)
  html = replaceMeta(html, 'property', 'og:title', page.title)
  html = replaceMeta(html, 'property', 'og:description', page.description)
  html = replaceMeta(html, 'property', 'og:type', 'website')
  html = html.replace(/\s*<link rel="canonical"[^>]*>/g, '')
  html = html.replace(/\s*<meta name="robots"[^>]*>/g, '')
  html = html.replace(/\s*<meta property="og:url"[^>]*>/g, '')
  const head = []
  if (page.robots) head.push(`<meta name="robots" content="${escapeHtml(page.robots)}" />`)
  if (page.canonical) {
    head.push(`<link rel="canonical" href="${escapeHtml(page.canonical)}" />`)
    head.push(`<meta property="og:url" content="${escapeHtml(page.canonical)}" />`)
  }
  if (page.image) {
    head.push(`<meta property="og:image" content="${escapeHtml(page.image)}" />`)
    head.push(`<meta name="twitter:card" content="summary_large_image" />`)
    head.push(`<meta name="twitter:image" content="${escapeHtml(page.image)}" />`)
  }
  if (head.length) html = html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`)
  html = replaceJsonLd(html, page.jsonLd || null)
  html = html.replace(/\s*<div id="seo-snapshot">[\s\S]*?<\/div>\s*(?=<div id="root")/, '\n    ')
  if (page.snapshotHtml) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="seo-snapshot">${page.snapshotHtml}</div>\n    <div id="root"></div>`,
    )
  }
  return html
}

export function renderPublicPage(template, pathname, origin = CANONICAL_ORIGIN) {
  const meta = metaForPath(pathname)
  const canonical = `${origin}${pathname === '/' ? '/' : pathname}`
  return renderHtmlDocument(template, {
    title: meta.title,
    description: meta.description,
    canonical,
    robots: 'index,follow',
    image: `${origin}/logo-mark.png`,
    snapshotHtml: publicSnapshot(pathname),
    jsonLd: websiteJsonLd(origin),
  })
}

export function renderRestaurantPage(template, place, origin = CANONICAL_ORIGIN) {
  const model = restaurantPageModel(place, origin)
  return renderHtmlDocument(template, {
    title: model.title,
    description: model.description,
    canonical: model.canonical,
    robots: 'index,follow',
    image: shareImageUrl(place, origin),
    snapshotHtml: restaurantSnapshot(model),
    jsonLd: restaurantJsonLd(model),
  })
}

export function renderPrivatePage(template, pathname) {
  const meta = metaForPath(pathname)
  return renderHtmlDocument(template, {
    title: meta.title,
    description: meta.description,
    canonical: '',
    robots: 'noindex, nofollow',
    snapshotHtml: '',
    jsonLd: null,
  })
}
