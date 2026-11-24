import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildInvoiceDraft, buildOrdersCsv } from './invoiceDraft.js'
import { OPERATOR, operatorIsComplete, presentPrice } from './operator.js'

describe('provozovatel a DPH', () => {
  it('nemá vymyšlené jméno, IČO, DIČ ani e-mail', () => {
    assert.equal(operatorIsComplete(), false)
    assert.equal(OPERATOR.legalName, '')
    assert.equal(OPERATOR.ico, '')
    assert.equal(OPERATOR.dic, '')
    assert.equal(OPERATOR.email, '')
    assert.equal(OPERATOR.vatStatus, 'unconfirmed')
  })

  it('u nepotvrzeného DPH neoznačí ceníkovou částku za konečnou', () => {
    const price = presentPrice(199)
    assert.equal(price.catalogAmount, 199)
    assert.equal(price.finalAmount, null)
    assert.equal(price.vatStatus, 'unconfirmed')
    assert.match(price.vatNote, /není potvrzený/)
  })

  it('spočítá konečnou částku jen pro potvrzený režim a neúplného plátce nechá nepotvrzeného', () => {
    const nonPayer = presentPrice(199, { ...OPERATOR, vatStatus: 'non-payer', vatRatePercent: 21 })
    assert.equal(nonPayer.finalAmount, 199)
    assert.equal(nonPayer.vatAmount, 0)

    const included = presentPrice(199, {
      ...OPERATOR,
      vatStatus: 'payer',
      vatRatePercent: 21,
      catalogPriceIncludesVat: true,
    })
    assert.equal(included.finalAmount, 199)
    assert.match(included.vatNote, /včetně DPH 21 %/)

    const excluded = presentPrice(199, {
      ...OPERATOR,
      vatStatus: 'payer',
      vatRatePercent: 21,
      catalogPriceIncludesVat: false,
    })
    assert.equal(excluded.vatAmount, 42)
    assert.equal(excluded.finalAmount, 241)

    const incomplete = presentPrice(199, {
      ...OPERATOR,
      vatStatus: 'payer',
      vatRatePercent: null,
      catalogPriceIncludesVat: false,
    })
    assert.equal(incomplete.finalAmount, null)
    assert.equal(incomplete.vatStatus, 'unconfirmed')

    const draft = buildInvoiceDraft({
      amount: 199,
      companyName: 'Testovací firma',
      businessName: 'Testovací bistro',
      planName: 'Plus',
      serviceLabel: '30 dní',
      reference: 'CE-TEST',
    })
    assert.equal(draft.validDocument, false)
    assert.equal(draft.finalAmount, null)
    assert.match(draft.text, /není účetní ani daňový doklad/)
    assert.match(draft.text, /nejsou doplněné/)

    const csv = buildOrdersCsv([
      {
        reference: 'CE1',
        status: 'active',
        paymentStatus: 'paid',
        paymentSource: 'gateway-test',
        planId: 'plus',
        amount: 199,
        currency: 'CZK',
        companyName: 'Firma',
        email: 'a@b.cz',
      },
    ])
    assert.match(csv, /reference,status,paymentStatus/)
    assert.match(csv, /gateway-test/)
    assert.match(csv, /,yes\n/)
  })
})
