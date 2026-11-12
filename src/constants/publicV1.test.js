import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HOME_CATEGORIES, STRIP_CATEGORIES } from './filters.js'
import { PUBLIC_V1, publicCategories } from './publicV1.js'

describe('public v1 scope', () => {
  it('vypíná členské slevy a placenou propagaci ve veřejné verzi', () => {
    assert.equal(PUBLIC_V1.memberDealsUi, false)
    assert.equal(PUBLIC_V1.paidPromotionUi, false)
    assert.equal(PUBLIC_V1.supportInSitemap, false)
    assert.equal(PUBLIC_V1.freeBusinessApplication, true)
  })

  it('CategoryStrip neukazuje dlaždici Slevy', () => {
    assert.equal(HOME_CATEGORIES.some((c) => c.value === 'slevy'), false)
    assert.equal(STRIP_CATEGORIES.some((c) => c.value === 'slevy'), false)
    assert.equal(
      publicCategories([{ value: 'slevy', dealsFilter: true }, { value: 'pizza' }]).map((c) => c.value).join(','),
      'pizza',
    )
  })
})
