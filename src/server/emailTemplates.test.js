import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  escapeEmailHtml,
  inquiryRestaurantEmail,
  paymentVerifiedEmail,
  promotionActivatedEmail,
  wrapFoodGoEmail,
} from './emailTemplates.js'

describe('emailTemplates', () => {
  it('escapuje HTML injection ve vstupech', () => {
    assert.equal(escapeEmailHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;')
    const letter = inquiryRestaurantEmail({
      reference: 'CE1',
      businessName: '<img src=x onerror=alert(1)>',
      planName: 'Start',
      serviceLabel: '30 dní',
      amountLabel: '99 Kč',
      vatNote: '',
    })
    assert.doesNotMatch(letter.html, /<img src=x/)
    assert.match(letter.html, /&lt;img src=x/)
    assert.match(letter.text, /Poptávka propagace je přijatá/)
    assert.match(letter.html, /FoodGo Brno/)
  })

  it('platba a aktivace neslibují falešnou úhradu bez dat', () => {
    const paid = paymentVerifiedEmail({ reference: 'CE2', businessName: 'Test', amountLabel: '199 Kč' })
    assert.match(paid.text, /ověřenou úhradu/)
    assert.match(paid.text, /nezapíná automaticky/)
    const active = promotionActivatedEmail({
      businessName: 'Test',
      planName: 'Plus',
      startsAt: '1. 1. 2026',
      endsAt: '31. 1. 2026',
    })
    assert.match(active.text, /je zapnutá/)
    const wrap = wrapFoodGoEmail({ title: 'X', bodyLines: ['a', 'b'] })
    assert.match(wrap.html, /max-width:560px/)
  })
})
