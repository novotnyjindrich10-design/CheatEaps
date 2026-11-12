import { PUBLIC_V1 } from '../constants/publicV1.js'
import { CANONICAL_ORIGIN } from '../constants/site.js'

const BASE_SITEMAP_PATHS = [
  '/',
  '/results',
  '/nevim-co-jist',
  '/pro-podniky',
  '/ochrana-osobnich-udaju',
  '/obchodni-podminky',
]

export const SITEMAP_PATHS = PUBLIC_V1.supportInSitemap
  ? [...BASE_SITEMAP_PATHS.slice(0, 4), '/podpor-me', ...BASE_SITEMAP_PATHS.slice(4)]
  : BASE_SITEMAP_PATHS

export function publicSiteOrigin(value) {
  const origin = String(value || '').trim().replace(/\/$/, '')
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) return ''
  return origin
}

/** Prázdné nebo ne-https PUBLIC_SITE_URL nesmí do sitemap dostat localhost. */
export function sitemapOrigin(value) {
  return publicSiteOrigin(value) || CANONICAL_ORIGIN
}

export function sitemapUrls(origin, ids) {
  const base = sitemapOrigin(origin)
  const urls = SITEMAP_PATHS.map((path) => (path === '/' ? `${base}/` : `${base}${path}`))
  const seen = new Set()
  for (const id of ids) {
    const safe = String(id || '').trim()
    if (!safe || seen.has(safe)) continue
    seen.add(safe)
    urls.push(`${base}/restaurant/${encodeURIComponent(safe)}`)
  }
  return urls
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function sitemapXml(urls) {
  const body = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
