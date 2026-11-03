import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { duplicateIdsToSuppress, suppressCatalogDuplicates } from './catalogDuplicates.js'

describe('duplicity katalogu', () => {
  it('nechá curated a skryje OSM kopii', () => {
    const places = [
      { id: 'bistro-franz', curated: true, name: 'Bistro FRANZ' },
      { id: 'bistro-franz-veveri-461-14', name: 'Bistro Franz' },
      { id: 'other', name: 'Other' },
    ]
    const hide = duplicateIdsToSuppress(places)
    assert.equal(hide.has('bistro-franz-veveri-461-14'), true)
    assert.equal(hide.has('bistro-franz'), false)
    assert.deepEqual(
      suppressCatalogDuplicates(places).map((p) => p.id),
      ['bistro-franz', 'other'],
    )
  })

  it('bez páru nic neskrývá', () => {
    const places = [{ id: 'solo', name: 'Solo' }]
    assert.equal(duplicateIdsToSuppress(places).size, 0)
    assert.equal(suppressCatalogDuplicates(places).length, 1)
  })
})
