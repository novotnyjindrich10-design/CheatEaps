import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import {
  DEALS_EMPTY_MESSAGE,
  allDealRows,
  countPublicDealRestaurants,
  countPublicDeals,
  dealBadgeLabels,
  dealBadgesForRestaurant,
  dealHighlightLabel,
  dealOfferIds,
  dealValidityNote,
  isDealListable,
  publicDeals,
  publicDealsForRestaurant,
  restaurantHasPublicDeal,
  testOnlyDealRows,
} from '../data/restaurantDeals.js'
import { DEAL_PRIVATE } from '../server/dealPrivate.js'
import { copyText } from './copyText.js'
import {
  DEALS_RESULTS_PATH,
  authGateCopy,
  isDealDetailPath,
  isDealsReturnPath,
  loginPath,
  postLoginTarget,
} from './authReturn.js'
import { buildCategoryHref, isDealsCategory } from '../constants/filters.js'

const CODES = ['TWIST2ISIC', 'QURRITOISIC', 'CHEESEISIC']
const NOW = new Date('2026-11-04T12:00:00+01:00')

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
      assert.ok(row.sourceUrl?.startsWith('https://'), row.offerId)
      assert.ok(DEAL_PRIVATE[row.offerId]?.sourceUrl?.startsWith('https://'))
      assert.equal(dealOfferIds().includes(row.offerId), true)
      assert.ok(Array.isArray(row.conditions))
    }
    assert.deepEqual(new Set(dealOfferIds()), new Set(Object.keys(DEAL_PRIVATE)))
  })

  it('testovací nabídky nejsou v produkčním katalogu', () => {
    for (const row of rows) {
      assert.equal(row.offerId.startsWith('__test__'), false)
      assert.equal(row.restaurantId.startsWith('__test__'), false)
    }
    assert.ok(testOnlyDealRows().every((row) => row.offerId.startsWith('__test__')))
  })

  it('veřejný katalog neobsahuje kódy', () => {
    const source = fs.readFileSync(new URL('../data/restaurantDeals.js', import.meta.url), 'utf8')
    for (const code of CODES) assert.equal(source.includes(code), false)
    for (const deal of publicDeals(NOW)) {
      assert.equal(JSON.stringify(deal).includes('TWIST'), false)
    }
  })

  it('veřejně se zobrazí jen ověřené nabídky v platnosti', () => {
    const live = publicDeals(NOW)
    assert.ok(live.length > 0)
    assert.ok(live.every((deal) => deal.verification === 'verified'))
    assert.ok(live.every((deal) => deal.sourceUrl.startsWith('https://')))
    assert.equal(
      live.some((deal) => deal.offerId === 'bageterie-isic-app'),
      false,
      'Bageterie bez doložené ceny nesmí být aktivní',
    )
    assert.ok(countPublicDeals(NOW) >= 10)
    assert.ok(countPublicDealRestaurants(NOW) >= 5)
  })

  it('štítek procenta chce doložený základ; jinak akční cena nebo Sleva', () => {
    assert.deepEqual(
      dealBadgeLabels({
        discountPercent: 10,
        percentBase: 'celý účet za jídlo a nápoje',
        studentOnly: true,
      }),
      ['−10 %', 'Studentská sleva'],
    )
    assert.equal(
      dealBadgeLabels({ discountPercent: 20, percentBase: '', benefitType: 'percent' }).includes('−20 %'),
      false,
    )
    assert.equal(dealBadgeLabels({ benefitType: 'bogo' }).includes('1+1 zdarma'), true)
    assert.equal(dealHighlightLabel({ salePrice: 149, discountPercent: null, percentBase: '' }), '149 Kč')
    assert.equal(dealHighlightLabel({ discountPercent: 15, percentBase: 'účet' }), 'Sleva')
    const kfc = dealBadgesForRestaurant('kfc-masarykova-39', NOW)
    assert.deepEqual(kfc.map((badge) => badge.label), ['Sleva'])
    assert.equal(kfc[0].count, 3)
  })

  it('restaurantHasPublicDeal používá index a zvládne opakované filtry', () => {
    // První volání sestaví denní index (expand nabídek). Měříme až opakované lookup.
    assert.equal(restaurantHasPublicDeal('kfc-masarykova-39', NOW), true)
    const start = Date.now()
    for (let i = 0; i < 5000; i += 1) {
      restaurantHasPublicDeal('kfc-masarykova-39', NOW)
      restaurantHasPublicDeal('neexistujici-podnik', NOW)
    }
    assert.ok(Date.now() - start < 200, 'index slev musí být rychlý i při tisících lookupů')
    assert.equal(restaurantHasPublicDeal('neexistujici-podnik', NOW), false)
  })

  it('KFC a UGO mají správné pobočky, Starbucks má 1+1 do konce data', () => {
    assert.deepEqual(
      publicDealsForRestaurant('ugo-cimburkova-4', NOW).map((deal) => deal.offerId),
      ['ugo-isic-fresh'],
    )
    assert.equal(publicDealsForRestaurant('ugo-netroufalky-770-14', NOW).length, 4)
    assert.ok(
      publicDealsForRestaurant('starbucks-namesti-svobody-5', NOW).some(
        (deal) => deal.offerId === 'starbucks-isic-venti-bogo',
      ),
    )
    assert.equal(dealBadgesForRestaurant('subway-ve-vankovce-1', NOW).length, 0)
    assert.equal(dealBadgesForRestaurant('u-mamlasu-namesti-svobody-74-10', NOW).length, 0)
  })

  it('rozliší aktivní, budoucí, vypršelou a neověřenou nabídku (testovací data)', () => {
    const [active, future, expired, unverified] = testOnlyDealRows()
    assert.equal(isDealListable(active, NOW), true)
    assert.equal(isDealListable(future, NOW), false)
    assert.equal(isDealListable(expired, NOW), false)
    assert.equal(isDealListable(unverified, NOW), false)
    assert.equal(isDealListable({ ...active, active: false }, NOW), false)
    assert.equal(isDealListable({ ...active, sourceUrl: '' }, NOW), false)
  })

  it('Starbucks BOGO vyprší po datu ze zdroje', () => {
    const bogo = rows.find((deal) => deal.offerId === 'starbucks-isic-venti-bogo')
    assert.equal(isDealListable(bogo, new Date('2026-11-17T12:00:00+01:00')), true)
    assert.equal(isDealListable(bogo, new Date('2026-11-18T12:00:00+01:00')), false)
    assert.match(dealValidityNote(bogo), /^$|Platí/)
    assert.equal(dealValidityNote(bogo), '')
  })

  it('u stálých nabídek bez data konce ze zdroje je poznámka o kontrole', () => {
    const kfc = publicDeals(NOW).find((deal) => deal.offerId === 'kfc-isic-twister')
    assert.match(dealValidityNote(kfc), /Znovu ověříme/)
  })

  it('kategorie Slevy vede na filtr ověřených slev', () => {
    assert.equal(isDealsCategory('slevy'), true)
    assert.equal(buildCategoryHref('slevy'), '/results?deals=1')
    assert.match(DEALS_EMPTY_MESSAGE, /ověřené slevy/)
  })

  it('přihlášení ke slevám vrací na deals=1 a vysvětluje, že je prohlížení zdarma', () => {
    assert.equal(isDealsReturnPath(DEALS_RESULTS_PATH), true)
    assert.equal(isDealsReturnPath('/results?type=pizza'), false)
    assert.equal(isDealDetailPath('/nabidka/kfc-isic-twister--kfc-masarykova-39'), true)
    const path = loginPath(DEALS_RESULTS_PATH)
    assert.equal(path.startsWith('/prihlaseni?next='), true)
    assert.equal(postLoginTarget(path.slice(path.indexOf('?') + 1)), DEALS_RESULTS_PATH)
    const copy = authGateCopy(DEALS_RESULTS_PATH)
    assert.match(copy.headline, /Přihlas se a objev dostupné slevy/)
    assert.match(copy.lead, /zdarma/)
    assert.match(copy.note, /nenahrazuje/)
  })

  it('prázdný stav po vypršení všech nabídek', () => {
    assert.equal(publicDeals(new Date('2030-01-01T12:00:00+01:00')).length, 0)
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
