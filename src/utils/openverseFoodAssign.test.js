import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  auditAssignment,
  dishSpecForPlace,
  needsAttribution,
  scoreResult,
} from '../../scripts/lib/openverseFoodShared.mjs'

describe('dishSpecForPlace', () => {
  it('bere kategorii, když je známá a není specifický tip v názvu', () => {
    const spec = dishSpecForPlace({ id: 'x', name: 'Obecná restaurace', category: 'pizza' })
    assert.equal(spec.key, 'pizza')
    assert.equal(spec.source, 'category')
  })

  it('Chicken Inn / KFC mají fried_chicken i při kategorii fastfood', () => {
    const chicken = dishSpecForPlace({
      id: 'chicken-inn-svobody',
      name: 'Chicken Inn nám. Svobody',
      description: 'Kuřecí rychlé občerstvení ze sítě Burger Inn.',
      category: 'fastfood',
    })
    assert.equal(chicken.key, 'fried_chicken')
    assert.equal(chicken.source, 'name_specific')

    const kfc = dishSpecForPlace({ id: 'kfc-x', name: 'KFC', category: 'fastfood' })
    assert.equal(kfc.key, 'fried_chicken')
  })

  it('sushi v názvu má přednost před obecnou asijskou kategorií', () => {
    const sushi = dishSpecForPlace({
      id: 'sushi-mix',
      name: 'Sushi Mix',
      category: 'asijske',
    })
    assert.equal(sushi.key, 'sushi')
  })

  it('bageterie dostane baguette, ne obecný fastfood', () => {
    const bag = dishSpecForPlace({
      id: 'bageterie-boulevard-masarykova-7',
      name: 'Bageterie Boulevard',
      category: 'fastfood',
    })
    assert.equal(bag.key, 'baguette')
  })

  it('u neuvedeno tipuje z názvu', () => {
    const cafe = dishSpecForPlace({ id: 'b', name: 'Kávová kavárna', category: '' })
    assert.equal(cafe.key, 'kava')
  })

  it('override má přednost', () => {
    const spec = dishSpecForPlace(
      { id: 'dhaba', name: 'Dhaba', category: 'vegetarianske' },
      { dhaba: { key: 'vegetarianske', dish: 'indické', query: 'q', keywords: ['curry'] } },
    )
    assert.equal(spec.source, 'override')
    assert.equal(spec.dish, 'indické')
  })
})

describe('auditAssignment', () => {
  it('odhalí pečivo u Chicken Inn', () => {
    const place = { id: 'chicken-inn-svobody', name: 'Chicken Inn', category: 'fastfood' }
    const bad = auditAssignment(place, 'fastfood', {
      foodIllustrationDish: 'bageta / sendvič',
      title: 'Bread Baguette',
    })
    assert.equal(bad.ok, false)
    assert.ok(bad.reasons.some((r) => /pečivo|bageta|kuřec/i.test(r)))

    const good = auditAssignment(place, 'fried_chicken', {
      foodIllustrationDish: 'smažené kuře / stripsy',
      title: 'Chicken strips and sweet potato fries',
    })
    assert.equal(good.ok, true)
  })
})

describe('diverzita ilustrací (max 3×)', () => {
  it('žádný Openverse ID není přiřazen více než 3×', async () => {
    const { getPlaceFoodIllustration } = await import('../data/placeFoodIllustrations.js')
    const { curatedPlaces } = await import('../data/curatedPlaces.js')
    const { osmPlaces } = await import('../data/osmPlaces.js')
    const { placePhotos } = await import('../data/placePhotos.js')
    const counts = new Map()
    const seen = new Set()
    for (const p of [...curatedPlaces, ...osmPlaces]) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      if (placePhotos[p.id]?.heroImageKind === 'official' && placePhotos[p.id]?.heroImageUrl) continue
      const ill = getPlaceFoodIllustration(p.id)
      if (!ill?.foodIllustrationOpenverseId) continue
      counts.set(ill.foodIllustrationOpenverseId, (counts.get(ill.foodIllustrationOpenverseId) || 0) + 1)
    }
    for (const [id, n] of counts) {
      assert.ok(n <= 3, `${id} used ${n}×`)
    }
  })
})

describe('scoreResult a atribuce', () => {
  it('zahodí nepovolenou licenci a nepřijatelný obsah', () => {
    assert.equal(scoreResult({ license: 'by-nc', title: 'pizza food' }, ['pizza']), -1)
    assert.ok(scoreResult({ license: 'cc0', title: 'Margherita pizza food', width: 900, height: 600 }, ['pizza']) >= 2)
  })

  it('penalizuje pečivo u chicken/fries klíčů', () => {
    const score = scoreResult(
      { license: 'cc0', title: 'Bread Baguette pastry bakery', width: 900, height: 600 },
      ['chicken', 'fried', 'strips'],
    )
    assert.ok(score < 3)
  })

  it('needsAttribution jen u BY / BY-SA', () => {
    assert.equal(needsAttribution('cc0'), false)
    assert.equal(needsAttribution('by'), true)
  })
})
