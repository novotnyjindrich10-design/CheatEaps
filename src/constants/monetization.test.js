import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SPONSORED_LABEL,
  applySponsorships,
  formatSponsorshipRange,
  partitionPlacements,
  showSponsoredLabel,
} from './monetization.js'

const now = Date.parse('2026-06-15T12:00:00.000Z')

function live(placeId, planId = 'plus') {
  return {
    placeId,
    planId,
    verified: true,
    status: 'active',
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('sponzorované výsledky', () => {
  it('štítek je připravený a neověřený příznak reklamu nezapne', () => {
    assert.equal(SPONSORED_LABEL, 'Sponzorováno')
    const places = [
      { id: 'a', name: 'Organický' },
      { id: 'b', name: 'Příznak bez ověření', sponsored: true },
      { id: 'c', name: 'Jen placement', placement: 'sponsored' },
    ]
    const split = partitionPlacements(places, now)
    assert.deepEqual(split.organic.map((place) => place.id), ['a', 'b', 'c'])
    assert.deepEqual(split.sponsored, [])
    assert.equal(split.organic[1].sponsored, undefined)
    assert.equal(showSponsoredLabel(places[1], now), false)
  })

  it('ověřené umístění v platnosti je označené a mimo organická doporučení', () => {
    const places = applySponsorships(
      [
        { id: 'a', name: 'Organický' },
        { id: 'b', name: 'Start', sponsored: true },
        { id: 'c', name: 'Premium' },
      ],
      [live('b', 'start'), live('c', 'premium')],
      now,
    )
    const split = partitionPlacements(places, now)
    assert.deepEqual(split.organic.map((place) => place.id), ['a'])
    assert.deepEqual(split.sponsored.map((place) => place.id), ['c', 'b'])
    assert.equal(showSponsoredLabel(split.sponsored[0], now), true)
    assert.match(formatSponsorshipRange(split.sponsored[0].sponsorship, now), /2026/)
  })

  it('po expiraci i před začátkem zvýraznění zmizí', () => {
    const record = live('b')
    const before = applySponsorships([{ id: 'b', name: 'B' }], [record], Date.parse('2026-05-01T00:00:00.000Z'))
    const after = applySponsorships([{ id: 'b', name: 'B' }], [record], Date.parse('2026-07-01T00:00:00.000Z'))
    assert.equal(showSponsoredLabel(before[0], Date.parse('2026-05-01T00:00:00.000Z')), false)
    assert.equal(showSponsoredLabel(after[0], Date.parse('2026-07-01T00:00:00.000Z')), false)
    assert.deepEqual(partitionPlacements(after, Date.parse('2026-07-01T00:00:00.000Z')).organic.map((place) => place.id), ['b'])
  })

  it('prázdný vstup nerozbije seznam', () => {
    assert.deepEqual(partitionPlacements(null), { organic: [], sponsored: [], withheld: [] })
    assert.deepEqual(applySponsorships(null, null), [])
  })
})
