import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CANONICAL_ORIGIN } from '../constants/site.js'
import { publicSiteOrigin, sitemapOrigin, sitemapUrls, sitemapXml } from './sitemap.js'

describe('sitemap', () => {
  it('prázdnou nebo ne-https adresu nahradí produkční kanonickou', () => {
    assert.equal(publicSiteOrigin('http://localhost:5173'), '')
    assert.equal(sitemapOrigin(''), CANONICAL_ORIGIN)
    assert.equal(sitemapOrigin('http://127.0.0.1:5173'), CANONICAL_ORIGIN)
    assert.equal(sitemapUrls('', ['a'])[0], `${CANONICAL_ORIGIN}/`)
  })

  it('dává statické stránky a detail podniku jen jednou', () => {
    const urls = sitemapUrls('https://example.cz/', ['a b', 'a b', ''])
    assert.equal(urls[0], 'https://example.cz/')
    assert.ok(urls.includes('https://example.cz/results'))
    assert.equal(urls.filter((url) => url.includes('/restaurant/')).length, 1)
    assert.match(urls.at(-1), /restaurant\/a%20b$/)
    const xml = sitemapXml(urls)
    assert.match(xml, /<loc>https:\/\/example\.cz\/<\/loc>/)
    assert.equal(xml.includes('/admin'), false)
    assert.equal(xml.includes('/prihlaseni'), false)
    assert.equal(xml.includes('/odmeny'), false)
    assert.equal(xml.includes('/oblibene'), false)
    assert.equal(xml.includes('/api'), false)
    assert.equal(xml.includes('/porovnani'), false)
    assert.equal(xml.includes('/nabidka'), false)
    assert.equal(xml.includes('/podpor-me'), false)
  })
})
