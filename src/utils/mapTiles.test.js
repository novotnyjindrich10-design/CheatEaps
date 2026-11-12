import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveMapTileConfig } from './mapTiles.js'

describe('mapTiles', () => {
  it('bez env použije OpenFreeMap bez API klíče', () => {
    const cfg = resolveMapTileConfig({})
    assert.equal(cfg.provider, 'openfreemap-positron')
    assert.equal(cfg.mode, 'vector-style')
    assert.match(cfg.styleUrl, /openfreemap\.org\/styles\/positron/)
    assert.match(cfg.attribution, /OpenStreetMap/)
    assert.equal(cfg.url, undefined)
    assert.equal(String(cfg.styleUrl).includes('api_key'), false)
    assert.equal(String(cfg.styleUrl).includes('tile.openstreetmap.org'), false)
  })

  it('s Carto klíčem sestaví Voyager URL s ?key=', () => {
    const cfg = resolveMapTileConfig({ VITE_CARTO_API_KEY: 'test-key-123' })
    assert.equal(cfg.provider, 'carto-voyager')
    assert.equal(cfg.mode, 'raster')
    assert.match(cfg.url, /cartocdn/)
    assert.match(cfg.url, /[?&]key=test-key-123/)
    assert.match(cfg.attribution, /CARTO/)
  })

  it('přijme vlastní šablonu dlaždic', () => {
    const cfg = resolveMapTileConfig({
      VITE_MAP_TILE_URL: 'https://tiles.example/{z}/{x}/{y}.png',
      VITE_MAP_TILE_ATTRIBUTION: 'Example',
    })
    assert.equal(cfg.provider, 'custom')
    assert.equal(cfg.mode, 'raster')
    assert.equal(cfg.url, 'https://tiles.example/{z}/{x}/{y}.png')
    assert.equal(cfg.attribution, 'Example')
  })
})
