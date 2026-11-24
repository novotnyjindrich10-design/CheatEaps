import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyPlaceOverrides, normalizePlaceOverride, validatePlaceOverrideInput } from './placeOverrides.js'

describe('placeOverrides', () => {
  it('skryje podnik a přepíše vyplněná pole', () => {
    const places = [
      { id: 'a', name: 'A', address: 'Ulice 1', category: 'pizza' },
      { id: 'b', name: 'B', address: 'Ulice 2', category: 'burger' },
    ]
    const out = applyPlaceOverrides(places, [
      { placeId: 'a', hidden: true },
      { place_id: 'b', name: 'Bistro B', address: '', category: 'ceske' },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].id, 'b')
    assert.equal(out[0].name, 'Bistro B')
    assert.equal(out[0].address, 'Ulice 2')
    assert.equal(out[0].category, 'ceske')
  })

  it('validuje vstup a odmítne špatné ID', () => {
    assert.equal(validatePlaceOverrideInput({ placeId: 'Bad Id' }).ok, false)
    const ok = validatePlaceOverrideInput({
      placeId: 'dhaba-beas-panska',
      hidden: true,
      name: 'Dhaba',
      address: 'Panská 1',
      category: 'asijske',
      adminNote: 'ověřeno',
    })
    assert.equal(ok.ok, true)
    assert.equal(ok.override.hidden, true)
    assert.equal(normalizePlaceOverride({ place_id: 'x', hidden: false })?.placeId, 'x')
  })
})
