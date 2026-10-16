import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BUSINESS_PLANS,
  ORDER_GAPS,
  findBusinessPlan,
  formatKc,
  quotePlan,
  resolvePeriod,
  reviewOrder,
  submitBusinessOrder,
  yearlyPrice,
  yearlySavings,
} from './businessPlans.js'

const base = {
  businessName: 'Bistro Test',
  contactName: 'Anna Nová',
  email: 'anna@example.com',
  planId: 'premium',
  periodId: 'rocne',
  website: '',
  description: '',
  socials: '',
  extra: '',
  photos: [],
}

describe('ceník pro podniky', () => {
  it('drží měsíční ceny a roční cenu jako deset plateb', () => {
    assert.deepEqual(
      BUSINESS_PLANS.map((plan) => [plan.id, plan.monthlyPrice, yearlyPrice(plan.monthlyPrice), plan.recommended]),
      [
        ['start', 99, 990, false],
        ['plus', 199, 1990, true],
        ['premium', 399, 3990, false],
      ],
    )
    assert.equal(yearlySavings(99), 198)
    assert.equal(yearlySavings(199), 398)
    assert.equal(yearlySavings(399), 798)
    assert.equal(formatKc(1990), '1 990 Kč')
    assert.equal(formatKc(3990), '3 990 Kč')
  })

  it('má měsíční platbu jako výchozí', () => {
    assert.equal(resolvePeriod(null), 'mesicne')
    assert.equal(resolvePeriod(''), 'mesicne')
    assert.equal(resolvePeriod('rocni'), 'mesicne')
    assert.equal(resolvePeriod('rocne'), 'rocne')
    const monthly = quotePlan(findBusinessPlan('plus'), null)
    assert.equal(monthly.amount, 199)
    assert.equal(monthly.savings, 0)
    assert.equal(monthly.amountLabel, 'za měsíc')
  })

  it('u roční platby ukáže cenu období a úsporu', () => {
    const quote = quotePlan(findBusinessPlan('premium'), 'rocne')
    assert.equal(quote.periodName, 'Roční platba')
    assert.equal(quote.amount, 3990)
    assert.equal(quote.savings, 798)
    assert.equal(quote.amountLabel, 'za rok')
  })

  it('složí souhrn objednávky a neoznačí ji za odeslanou ani zaplacenou', () => {
    const review = reviewOrder({
      ...base,
      website: 'bistro.cz',
      socials: 'https://instagram.com/bistro\n',
      description: 'Krátký popis',
      photos: [{ name: 'vydej.jpg', type: 'image/jpeg', size: 2048 }],
    })
    assert.equal(review.ok, true)
    assert.match(review.summary.text, /Premium/)
    assert.match(review.summary.text, /Roční platba/)
    assert.match(review.summary.text, /3 990 Kč za rok/)
    assert.match(review.summary.text, /798 Kč/)
    assert.match(review.summary.text, /https:\/\/bistro.cz/)
    assert.match(review.summary.text, /vydej.jpg/)
    assert.match(review.summary.text, /1–3 dnů/)
    assert.match(review.summary.text, /zdarma/)
    assert.match(review.summary.text, /399 Kč měsíčně/)
    assert.equal(review.summary.text.includes('odesláno'), false)
    assert.equal(review.summary.text.includes('zaplaceno'), false)
    assert.equal(review.summary.gaps, ORDER_GAPS)
    assert.match(ORDER_GAPS.join(' '), /Obchodní podmínky/)
    assert.match(ORDER_GAPS.join(' '), /osobních údajů/)
  })

  it('vyžaduje kontakt a odmítne špatný web, typ souboru i moc fotografií', () => {
    const empty = reviewOrder({ ...base, businessName: ' ', email: 'anna', periodId: 'tydne' })
    assert.equal(empty.ok, false)
    assert.equal(empty.firstField, 'businessName')
    assert.match(empty.errors.email, /e-mail/)
    assert.match(empty.errors.periodId, /měsíční nebo roční/)

    const badWeb = reviewOrder({ ...base, periodId: 'mesicne', website: 'javascript:alert(1)' })
    assert.match(badWeb.errors.website, /Webová adresa/)

    const badPhoto = reviewOrder({
      ...base,
      periodId: 'mesicne',
      photos: [{ name: 'menu.pdf', type: 'application/pdf', size: 1000 }],
    })
    assert.match(badPhoto.errors.photos, /JPG, PNG nebo WebP/)

    const huge = reviewOrder({
      ...base,
      periodId: 'mesicne',
      photos: [{ name: 'sal.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 }],
    })
    assert.match(huge.errors.photos, /5 MB/)

    const tooMany = reviewOrder({
      ...base,
      planId: 'start',
      periodId: 'mesicne',
      photos: [
        { name: 'a.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'b.png', type: 'image/png', size: 1000 },
      ],
    })
    assert.match(tooMany.errors.photos, /nejvýš 1/)
  })

  it('objednávku neodešle ani nestrhne platbu', () => {
    const review = reviewOrder({ ...base, periodId: 'mesicne' })
    const result = submitBusinessOrder(review.summary)
    assert.equal(result.sent, false)
    assert.equal(result.paid, false)
    assert.equal(result.gaps.length > 0, true)
  })
})
