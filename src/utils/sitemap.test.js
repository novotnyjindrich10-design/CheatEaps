import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publicSiteOrigin, sitemapUrls, sitemapXml } from './sitemap.js'

describe('sitemap', () => {
  it('bez veřejné https adresy nic nesestaví', () => {
    assert.equal(publicSiteOrigin('http://localhost:5173'), '')
    assert.deepEqual(sitemapUrls('', ['a']), [])
  })

  it('dává statické stránky a detail podniku jen jednou', () => {
    const urls = sitemapUrls('https://example.cz/', ['a b', 'a b', ''])
    assert.equal(urls[0], 'https://example.cz/')
    assert.ok(urls.includes('https://example.cz/results'))
    assert.equal(urls.filter((url) => url.includes('/restaurant/')).length, 1)
    assert.match(urls.at(-1), /restaurant\/a%20b$/)
    const xml = sitemapXml(urls)
    assert.match(xml, /<loc>https:\/\/example\.cz\/<\/loc>/)
    assert.equal(xml.includes('/admin/'), false)
    assert.equal(xml.includes('/prihlaseni'), false)
  })
})
