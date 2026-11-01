import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dietOfferTag, getRestaurantTags } from './restaurantTags.js'

describe('štítky nabídky', () => {
  it('burger s vegetariánskou položkou není označen jako vegetariánská restaurace', () => {
    const tag = dietOfferTag({
      category: 'burger',
      vegetarianFriendly: true,
      veganFriendly: false,
    })
    assert.equal(tag.label, 'Vegetariánská jídla')
    assert.equal(tag.key, 'veg')
  })

  it('zaměření podniku má silnější štítek než samotná nabídka', () => {
    assert.equal(
      dietOfferTag({ category: 'veganske', veganFriendly: true, vegetarianFriendly: true }).label,
      'Veganské',
    )
    assert.equal(
      dietOfferTag({ category: 'zdrave', veganFriendly: true, vegetarianFriendly: true }).label,
      'Veganská jídla',
    )
    assert.equal(
      dietOfferTag({ category: 'vegetarianske', vegetarianFriendly: true }).label,
      'Bez masa',
    )
  })

  it('u veganské nabídky se vegetariánský štítek nepřidá', () => {
    const tags = getRestaurantTags({
      category: 'burger',
      veganFriendly: true,
      vegetarianFriendly: true,
    })
    assert.deepEqual(
      tags.map((tag) => tag.key),
      ['vegan'],
    )
  })
})
