import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import {
  allDealRows,
  dealBadgeLabels,
  dealBadgesForRestaurant,
  dealOfferIds,
  dealValidityNote,
  isDealListable,
  publicDeals,
  publicDealsForRestaurant,
} from '../data/restaurantDeals.js'
import { DEAL_PRIVATE } from '../server/dealPrivate.js'
import { copyText } from './copyText.js'
import { loginPath, postLoginTarget } from './authReturn.js'

const CODES = ['TWIST2ISIC', 'QURRITOISIC', 'CHEESEISIC']

function idsIn(file, pattern) {
  const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  return new Set([...text.matchAll(pattern)].map((match) => match[1]))
}

describe('katalog slev', () => {
  const rows = allDealRows()
  const placeIds = new Set([
    ...idsIn('../data/osmPlaces.js', /"id": "([^"]+)"/g),
    ...idsIn('../data/curatedPlaces.js', /id: '([^']+)'/g),
  ])

  it('každá nabídka míří na existující pobočku a má soukromý postup', () => {
    const ids = new Set()
    for (const row of rows) {
      assert.equal(placeIds.has(row.restaurantId), true, row.restaurantId)
      assert.equal(ids.has(row.id), false)
      ids.add(row.id)
      assert.ok(DEAL_PRIVATE[row.offerId]?.sourceUrl?.startsWith('https://'))
      assert.equal(dealOfferIds().includes(row.offerId), true)
    }
    assert.deepEqual(new Set(dealOfferIds()), new Set(Object.keys(DEAL_PRIVATE)))
  })

  it('veřejný katalog neobsahuje kódy', () => {
    const source = fs.readFileSync(new URL('../data/restaurantDeals.js', import.meta.url), 'utf8')
    for (const code of CODES) assert.equal(source.includes(code), false)
    for (const deal of publicDeals()) {
      assert.equal(JSON.stringify(deal).includes('TWIST'), false)
    }
  })

  it('štítek procenta chce doložený základ a ostatní typy mají vlastní text', () => {
    assert.deepEqual(
      dealBadgeLabels({ discountPercent: 10, percentBase: 'celý účet za jídlo a nápoje', studentOnly: true }),
      ['−10 %', 'Studentská sleva'],
    )
    assert.equal(
      dealBadgeLabels({ discountPercent: 20, percentBase: '', benefitType: 'percent' }).includes('−20 %'),
      false,
    )
    assert.equal(dealBadgeLabels({ benefitType: 'bogo' }).includes('1+1 zdarma'), true)
    assert.equal(dealBadgeLabels({ requiresLoyaltyApp: true }).includes('Věrnostní výhoda'), true)
  })

  it('KFC má studentský štítek, freshbar UGO nemá salát a Starbucks má 1+1', () => {
    const kfc = dealBadgesForRestaurant('kfc-masarykova-39')
    assert.deepEqual(kfc.map((badge) => badge.label), ['Studentská sleva'])
    assert.equal(kfc[0].count, 3)
    assert.deepEqual(
      publicDealsForRestaurant('ugo-cimburkova-4').map((deal) => deal.offerId),
      ['ugo-isic-fresh'],
    )
    assert.equal(publicDealsForRestaurant('ugo-netroufalky-770-14').length, 4)
    assert.ok(
      dealBadgesForRestaurant('starbucks-namesti-svobody-5', new Date('2026-10-29T12:00:00+01:00')).some(
        (badge) => badge.label === '1+1 zdarma',
      ),
    )
    assert.equal(dealBadgesForRestaurant('subway-ve-vankovce-1').length, 0)
    assert.equal(dealBadgesForRestaurant('u-mamlasu-namesti-svobody-74-10').length, 0)
  })

  it('rozliší uvedenou, plně ověřenou a prošlou nabídku', () => {
    const listed = publicDeals().find((deal) => deal.offerId === 'kfc-isic-twister')
    assert.equal(listed.verification, 'listed')
    assert.match(dealValidityNote(listed), /není garantovaná/)
    const verified = {
      active: true,
      verification: 'verified',
      validFrom: '2026-10-01',
      validUntil: '2026-11-17',
    }
    assert.equal(dealValidityNote(verified), '')
    assert.equal(isDealListable({ active: true, verification: 'unverified' }), false)
    assert.equal(isDealListable({ active: false, verification: 'listed' }), false)
    const bogo = rows.find((deal) => deal.offerId === 'starbucks-isic-venti-bogo')
    assert.equal(isDealListable(bogo, new Date('2026-11-17T12:00:00+01:00')), true)
    assert.equal(isDealListable(bogo, new Date('2026-11-18T12:00:00+01:00')), false)
  })
})

describe('návrat po přihlášení a kopírování', () => {
  it('vrátí uživatele na konkrétní nabídku a odmítne cizí adresu', () => {
    const next = '/nabidka/kfc-isic-twister--kfc-masarykova-39'
    assert.equal(postLoginTarget(`next=${encodeURIComponent(next)}`), next)
    assert.equal(loginPath(next).startsWith('/prihlaseni?next='), true)
    assert.equal(postLoginTarget('next=https://evil.test/nabidka'), '/results')
    assert.equal(postLoginTarget('next=//evil.test'), '/results')
  })

  it('zkopíruje jen neprázdný kód', async () => {
    let stored = ''
    const clipboard = {
      writeText(value) {
        stored = value
        return Promise.resolve()
      },
    }
    assert.deepEqual(await copyText('TWIST2ISIC', clipboard), { ok: true })
    assert.equal(stored, 'TWIST2ISIC')
    assert.deepEqual(await copyText('  ', clipboard), { ok: false, reason: 'empty' })
    assert.deepEqual(
      await copyText('KOD', { writeText() { return Promise.reject(new Error('denied')) } }),
      { ok: false, reason: 'failed' },
    )
  })
})
