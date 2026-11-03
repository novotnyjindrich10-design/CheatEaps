const STATIC_PATHS = [
  '/',
  '/results',
  '/odmeny',
  '/oblibene',
  '/pro-podniky',
  '/podpor-me',
  '/ochrana-osobnich-udaju',
  '/obchodni-podminky',
]

export function publicSiteOrigin(value) {
  const origin = String(value || '').trim().replace(/\/$/, '')
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) return ''
  return origin
}

export function sitemapUrls(origin, ids) {
  const base = publicSiteOrigin(origin)
  if (!base) return []
  const urls = STATIC_PATHS.map((path) => (path === '/' ? `${base}/` : `${base}${path}`))
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
