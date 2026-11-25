import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CANONICAL_ORIGIN } from '../constants/site.js'
import { SITEMAP_PATHS } from './sitemap.js'
import {
  PRIVATE_PRERENDER_PATHS,
  renderPrivatePage,
  renderPublicPage,
  renderRestaurantPage,
  restaurantPageModel,
} from './publicHtml.js'

const TEMPLATE = `<!doctype html>
<html lang="cs">
  <head>
    <meta name="description" content="původní" />
    <meta property="og:title" content="původní" />
    <meta property="og:description" content="původní" />
    <meta property="og:type" content="website" />
    <title>původní</title>
    <script type="application/ld+json">{"@type":"WebSite"}</script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

describe('veřejné HTML', () => {
  it('detail podniku má název, adresu, odhad ceny a kanonickou adresu', () => {
    const place = {
      id: 'test-podnik',
      name: 'Test & Syn',
      address: 'Hlavní 1',
      city: 'Brno',
      category: 'pizza',
      description: 'Pec na dřevo.',
      priceKind: 'estimate',
      price: 120,
      priceMax: 180,
      priceConfidence: 'low',
    }
    const model = restaurantPageModel(place)
    assert.equal(model.canonical, `${CANONICAL_ORIGIN}/restaurant/test-podnik`)
    assert.match(model.priceLine, /Odhad ceny/)
    assert.doesNotMatch(model.priceLine, /Ověřená cena/)
    const html = renderRestaurantPage(TEMPLATE, place)
    assert.match(html, /<title>Test &amp; Syn \| FoodGo Brno<\/title>/)
    assert.match(html, /<h1>Test &amp; Syn<\/h1>/)
    assert.match(html, /Hlavní 1, Brno/)
    assert.match(html, /rel="canonical" href="https:\/\/cheat-eaps\.vercel\.app\/restaurant\/test-podnik"/)
    assert.match(html, /FoodEstablishment/)
    assert.equal(html.includes('aggregateRating'), false)
    assert.equal(html.includes('openingHours'), false)
  })

  it('vypnutá indexace schová snapshot z vyhledávání', () => {
    const html = renderPublicPage(TEMPLATE, '/pro-podniky', CANONICAL_ORIGIN, { indexable: false })
    assert.match(html, /noindex, nofollow/)
    assert.match(html, /Buďte vidět, když lidé hledají/)
    assert.equal(html.includes('application/ld+json'), false)
  })

  it('úvod má kanonickou adresu a soukromé stránky nemají obsah katalogu', () => {
    const home = renderPublicPage(TEMPLATE, '/')
    assert.match(home, /Najdi jídlo v Brně/)
    assert.match(home, /rel="canonical" href="https:\/\/cheat-eaps\.vercel\.app\/"/)
    const login = renderPrivatePage(TEMPLATE, '/prihlaseni')
    assert.match(login, /noindex, nofollow/)
    assert.equal(login.includes('rel="canonical"'), false)
    assert.equal(login.includes('seo-snapshot'), false)
    assert.equal(login.includes('FoodEstablishment'), false)
    assert.equal(login.includes('application/ld+json'), false)
  })

  it('sitemap a prerender se neshodují na soukromých cestách', () => {
    for (const path of PRIVATE_PRERENDER_PATHS) {
      assert.equal(SITEMAP_PATHS.includes(path), false)
    }
    assert.equal(SITEMAP_PATHS.includes('/'), true)
    assert.equal(SITEMAP_PATHS.includes('/results'), true)
  })

  it('prerender kategorie používá type= a detail má same-origin og:image', () => {
    const home = renderPublicPage(TEMPLATE, '/')
    assert.match(home, /\/results\?type=pizza/)
    assert.equal(home.includes('/results?category='), false)
    assert.match(home, /property="og:image"/)

    const place = {
      id: 'test-foto',
      name: 'Foto Test',
      address: 'Hlavní 2',
      city: 'Brno',
      category: 'pizza',
      foodIllustrationKind: 'pixabay',
      foodIllustrationUrl: '/food-illustrations/pixabay/1.jpg',
      foodIllustrationLicense: 'pixabay',
    }
    const html = renderRestaurantPage(TEMPLATE, place)
    assert.match(
      html,
      /property="og:image" content="https:\/\/cheat-eaps\.vercel\.app\/food-illustrations\/pixabay\/1\.jpg"/,
    )
  })

})
