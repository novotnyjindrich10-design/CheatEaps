import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveMapTileConfig } from './mapTiles.js'

describe('mapTiles', () => {
  it('bez env použije Carto Voyager s atribucí', () => {
    const cfg = resolveMapTileConfig({})
    assert.equal(cfg.provider, 'carto-voyager')
    assert.match(cfg.url, /cartocdn/)
    assert.match(cfg.attribution, /OpenStreetMap/)
    assert.equal(cfg.url.includes('tile.openstreetmap.org'), false)
  })

  it('přijme vlastní šablonu dlaždic', () => {
    const cfg = resolveMapTileConfig({
      VITE_MAP_TILE_URL: 'https://tiles.example/{z}/{x}/{y}.png',
      VITE_MAP_TILE_ATTRIBUTION: 'Example',
    })
    assert.equal(cfg.provider, 'custom')
    assert.equal(cfg.url, 'https://tiles.example/{z}/{x}/{y}.png')
    assert.equal(cfg.attribution, 'Example')
  })
})
