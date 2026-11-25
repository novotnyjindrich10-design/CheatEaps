/**
 * Po `vite build` doplní SEO snapshoty do dist/.
 * Používá Vite SSR loader (extensionless importy v katalogu).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { loadEnv } from 'vite'
import { publicSiteOrigin, sitemapOrigin, isSearchPreviewBuild } from '../src/utils/sitemap.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist')

const PUBLIC_PATHS = [
  '/',
  '/results',
  '/pro-podniky',
  '/o-foodgo',
  '/kontakt',
  '/cookies',
  '/reklamni-zvyrazneni',
  '/ochrana-osobnich-udaju',
  '/obchodni-podminky',
  '/nevim-co-jist',
]

async function main() {
  const env = loadEnv('production', root, '')
  const origin = sitemapOrigin(env.PUBLIC_SITE_URL || publicSiteOrigin(env.PUBLIC_SITE_URL))
  const templatePath = path.join(outDir, 'index.html')
  const template = readFileSync(templatePath, 'utf8')

  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  try {
    const { renderPublicPage, renderRestaurantPage } = await server.ssrLoadModule('/src/utils/publicHtml.js')
    const { demoRestaurants } = await server.ssrLoadModule('/src/data/demoRestaurants.js')

    const indexable = !isSearchPreviewBuild(process.env)
    for (const pathname of PUBLIC_PATHS) {
      const html = renderPublicPage(template, pathname, origin, { indexable })
      if (pathname === '/') {
        writeFileSync(templatePath, html)
      } else {
        const dir = path.join(outDir, pathname.replace(/^\//, ''))
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, 'index.html'), html)
      }
    }

    let written = 0
    for (const place of demoRestaurants) {
      if (!place?.id) continue
      const html = renderRestaurantPage(template, place, origin, { indexable })
      const dir = path.join(outDir, 'restaurant', place.id)
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, 'index.html'), html)
      written += 1
    }

    console.info(`[foodgo-prerender] ${PUBLIC_PATHS.length} public pages + ${written} restaurant snapshots → ${origin}`)
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error('[foodgo-prerender] failed:', error)
  process.exitCode = 1
})
