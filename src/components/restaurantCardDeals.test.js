import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import { isDealCardVariant } from '../utils/dealCardVariant.js'

describe('slevový UI jen v režimu deals=1', () => {
  it('běžná karta nemá slevový vzhled', () => {
    assert.equal(isDealCardVariant('default'), false)
    assert.equal(isDealCardVariant(undefined), false)
    assert.equal(isDealCardVariant('deal'), true)
  })

  it('RestaurantCard nepoužívá slevové štítky mimo variant deal', () => {
    const source = fs.readFileSync(new URL('./RestaurantCard.jsx', import.meta.url), 'utf8')
    assert.equal(source.includes('dealBadgesForRestaurant'), false)
    assert.equal(source.includes('deal-badge'), false)
    assert.equal(source.includes('restaurant-card-deals'), false)
    assert.match(source, /isDealCardVariant\(variant\)/)
    assert.match(source, /Zobrazit nabídku/)
  })

  it('běžný detail podniku neukazuje slevové nabídky', () => {
    const source = fs.readFileSync(new URL('../pages/RestaurantDetail.jsx', import.meta.url), 'utf8')
    assert.equal(source.includes('publicDealsForRestaurant'), false)
    assert.equal(source.includes('Aktuální slevy'), false)
    assert.equal(source.includes('deal-list'), false)
    assert.equal(source.includes('#nabidky'), false)
  })

  it('Results zapíná deal karty jen při dealsOnly', () => {
    const source = fs.readFileSync(new URL('../pages/Results.jsx', import.meta.url), 'utf8')
    assert.match(source, /variant=\{filters\.dealsOnly \? 'deal' : 'default'\}/)
  })
})
