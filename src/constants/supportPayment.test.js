import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SUPPORT_PAYMENT,
  SUPPORT_PRESET_KC,
  buildSupportPaymentUrl,
  canStartSupportPayment,
  formatSupportKc,
  parseSupportAmount,
} from './supportPayment.js'

const ready = {
  paymentUrl: 'https://platby.example/podpora',
  amountQueryParam: 'amount',
  amountUnit: 'kc',
  recipientVerified: true,
  serviceTermsVerified: true,
  guardianConsentVerified: true,
}

describe('částka dobrovolné podpory', () => {
  it('nabízí rychlé částky 30, 50 a 100 Kč', () => {
    assert.deepEqual(SUPPORT_PRESET_KC, [30, 50, 100])
  })

  it('přečte kladnou částku v korunách i s čárkou, tečkou a mezerami', () => {
    assert.equal(parseSupportAmount('30'), 3000)
    assert.equal(parseSupportAmount('50 Kč'), 5000)
    assert.equal(parseSupportAmount('100,5'), 10050)
    assert.equal(parseSupportAmount('1 000,50'), 100050)
    assert.equal(parseSupportAmount('0,50'), 50)
    assert.equal(parseSupportAmount(30), 3000)
  })

  it('odmítne nulu, záporné hodnoty, NaN, nekonečno i nečíselný text', () => {
    const rejected = [
      '',
      '0',
      '0,00',
      '-5',
      '+5',
      'NaN',
      'Infinity',
      '1e2',
      'abc',
      '30 Kč navíc',
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      -1,
    ]
    for (const value of rejected) {
      assert.equal(parseSupportAmount(value), null, String(value))
    }
  })

  it('odmítne víc než dvě desetinná místa', () => {
    assert.equal(parseSupportAmount('10,255'), null)
    assert.equal(parseSupportAmount(1 / 3), null)
  })

  it('formátuje částku česky', () => {
    assert.equal(formatSupportKc(3000), '30 Kč')
    assert.equal(formatSupportKc(3050), '30,50 Kč')
    assert.equal(formatSupportKc(100050), `${new Intl.NumberFormat('cs-CZ').format(1000)},50 Kč`)
    assert.equal(formatSupportKc(0), '')
  })
})

describe('platební adresa podpory', () => {
  it('výchozí konfigurace platbu nespustí a nemá vymyšlenou adresu', () => {
    assert.equal(SUPPORT_PAYMENT.paymentUrl, '')
    assert.equal(SUPPORT_PAYMENT.recipientVerified, false)
    assert.equal(SUPPORT_PAYMENT.serviceTermsVerified, false)
    assert.equal(SUPPORT_PAYMENT.guardianConsentVerified, false)
    assert.equal(canStartSupportPayment(), false)
    assert.equal(buildSupportPaymentUrl(5000), null)
  })

  it('předá kanonickou částku, jen když jsou ověřené všechny podmínky', () => {
    const href = buildSupportPaymentUrl(parseSupportAmount('1 000,50 Kč'), ready)
    const url = new URL(href)
    assert.equal(url.origin + url.pathname, 'https://platby.example/podpora')
    assert.equal(url.searchParams.get('amount'), '1000.50')
    assert.equal(canStartSupportPayment(ready), true)
  })

  it('haléře posílá jako celé číslo, když to konfigurace říká', () => {
    const href = buildSupportPaymentUrl(3050, { ...ready, amountUnit: 'halere', amountQueryParam: 'castka' })
    assert.equal(new URL(href).searchParams.get('castka'), '3050')
  })

  it('nespustí platbu bez příjemce, podmínek, souhlasu, https nebo jednotky', () => {
    const cases = [
      { ...ready, recipientVerified: false },
      { ...ready, serviceTermsVerified: false },
      { ...ready, guardianConsentVerified: false },
      { ...ready, paymentUrl: 'http://platby.example/podpora' },
      { ...ready, paymentUrl: 'javascript:alert(1)' },
      { ...ready, paymentUrl: 'https://user:secret@platby.example/podpora' },
      { ...ready, paymentUrl: '' },
      { ...ready, amountQueryParam: '' },
      { ...ready, amountQueryParam: 'amount&next' },
      { ...ready, amountUnit: 'eur' },
    ]
    for (const config of cases) {
      assert.equal(canStartSupportPayment(config), false)
      assert.equal(buildSupportPaymentUrl(5000, config), null)
    }
  })

  it('nepředá nulu, zápornou částku ani text uživatele', () => {
    assert.equal(buildSupportPaymentUrl(0, ready), null)
    assert.equal(buildSupportPaymentUrl(-100, ready), null)
    assert.equal(buildSupportPaymentUrl(Number.NaN, ready), null)
    const href = buildSupportPaymentUrl(parseSupportAmount('50 Kč'), ready)
    assert.equal(new URL(href).searchParams.get('amount'), '50')
    assert.equal(href.includes('Kč'), false)
  })
})
