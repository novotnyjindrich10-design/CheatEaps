import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVE_APPLICATION_PLAN,
  assessBusinessApplication,
  canStartPlan,
  lockedPlans,
  normalizeKey,
  polishDescription,
  publicApplicationView,
  suggestDescriptionDraft,
  uniquePlaceId,
} from './businessApplication.js'

describe('žádost o podnik', () => {
  it('nechá aktivní jen START a zamkne PLUS/PREMIUM', () => {
    assert.equal(canStartPlan('start'), true)
    assert.equal(canStartPlan('plus'), false)
    assert.equal(lockedPlans().premium.locked, true)
  })

  it('přijme platné údaje START a ořízne popis na 400 znaků', () => {
    const long = `${'Skvělé burgery v centru Brna. '.repeat(30)}`
    const result = assessBusinessApplication({
      planId: 'start',
      businessName: 'KFC Svoboďák 45',
      address: 'náměstí Svobody 45, Brno',
      category: 'fastfood',
      cuisineFocus: 'Fast food',
      description: long,
      ownerEmail: 'majitel@example.cz',
      website: 'https://example.cz',
    })
    assert.equal(result.ok, true)
    assert.ok(result.value.description.length <= 400)
    assert.match(result.value.verificationNote, /nepotvrdila|neověřila/i)
  })

  it('odmítne PLUS/PREMIUM a neplatný e-mail', () => {
    const plus = assessBusinessApplication({
      planId: 'plus',
      businessName: 'Bistro',
      address: 'Česká 1, Brno',
      category: 'ceske',
      cuisineFocus: 'Česká kuchyně',
      description: 'Tradiční česká kuchyně v centru města Brno.',
      ownerEmail: 'neplatny',
    })
    assert.equal(plus.ok, false)
    assert.ok(plus.errors.planId)
    assert.ok(plus.errors.ownerEmail)
  })

  it('odhalí duplicitu podle názvu a adresy', () => {
    const key = normalizeKey('Test Bistro', 'Česká 1, Brno')
    const result = assessBusinessApplication(
      {
        planId: 'start',
        businessName: 'Test Bistro',
        address: 'Česká 1, Brno',
        category: 'ceske',
        cuisineFocus: 'Česká kuchyně',
        description: 'Tradiční česká kuchyně v centru města Brno.',
        ownerEmail: 'ok@example.cz',
      },
      { existingKeys: new Set([key]), takenIds: new Set() },
    )
    assert.equal(result.ok, false)
    assert.ok(result.errors.duplicate)
  })

  it('nevymýšlí fakta v polishDescription a uniquePlaceId nekoliduje', () => {
    assert.equal(polishDescription('  ahoj   světe  '), 'Ahoj světe.')
    const id = uniquePlaceId('Moje Bistro', 'Brno', new Set(['moje-bistro-brno']))
    assert.notEqual(id, 'moje-bistro-brno')
    const draft = suggestDescriptionDraft({
      businessName: 'KFC Svoboďák 45',
      category: 'fastfood',
      address: 'náměstí Svobody 45',
    })
    assert.match(draft, /KFC/)
    assert.ok(draft.length <= 400)
  })

  it('publicApplicationView nechá e-mail jen v admin pohledu objektu', () => {
    const view = publicApplicationView({
      id: '1',
      status: 'pending',
      plan_id: ACTIVE_APPLICATION_PLAN,
      business_name: 'X',
      address: 'Y',
      locality: 'Brno',
      category: 'fastfood',
      category_label: 'Fast food',
      description: 'Popis podniku s dostatkem znaků tady.',
      owner_email: 'secret@example.cz',
      website: '',
      proposed_place_id: 'x',
      published_place_id: null,
      admin_note: '',
      email_status: 'not_sent',
      email_error: '',
      email_sent_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      reviewed_at: null,
      photo_data: null,
    })
    assert.equal(view.ownerEmail, 'secret@example.cz')
    assert.equal(view.hasPhoto, false)
  })
})
