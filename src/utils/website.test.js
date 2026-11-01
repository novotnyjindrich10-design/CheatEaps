import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { httpUrl, isOfficialWebsite } from './website.js'

describe('oficiální web', () => {
  it('pustí běžný web a zahodí sociální sítě i rozbitý odkaz', () => {
    assert.equal(isOfficialWebsite('https://example.com/menu'), true)
    assert.equal(isOfficialWebsite('https://www.facebook.com/palazzorestaurant/'), false)
    assert.equal(
      isOfficialWebsite(
        'http://https%3A%2F%2Fwww.facebook.com%2Fpalazzorestaurant%2F&usg=AOvVaw3yBQYudER_eHv7rZYdfAsZ',
      ),
      false,
    )
    assert.equal(isOfficialWebsite('not a url'), false)
  })

  it('do odkazu pustí jen http a https bez hesla v adrese', () => {
    assert.equal(httpUrl('https://example.com/menu'), 'https://example.com/menu')
    assert.equal(httpUrl('javascript:alert(1)'), '')
    assert.equal(httpUrl('https://user:secret@example.com/menu'), '')
    assert.equal(httpUrl('/restaurant/1'), '')
    assert.equal(httpUrl(''), '')
  })
})
