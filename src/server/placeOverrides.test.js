import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createMemoryPlaceOverrideStore,
  placeOverridesHttp,
  PLACE_OVERRIDES_SQL,
} from './placeOverrides.js'

function req(path, init = {}) {
  return new Request(`https://foodgo.local${path}`, init)
}

describe('placeOverrides HTTP', () => {
  it('SQL vyžaduje admin zápis a veřejné čtení bez poznámky ve view', () => {
    assert.match(PLACE_OVERRIDES_SQL, /place_overrides_public/)
    assert.match(PLACE_OVERRIDES_SQL, /is_cheapeats_admin/)
    assert.doesNotMatch(PLACE_OVERRIDES_SQL, /grant insert on table public\.place_overrides to anon/)
  })

  it('veřejný GET vrací přepisy, zápis jen admin', async () => {
    const emptyPublic = await placeOverridesHttp(req('/api/place-overrides'), {
      store: {
        kind: 'stub',
        async listPublic() {
          return { ok: false, error: 'not-ready', status: 503 }
        },
      },
    })
    assert.equal(emptyPublic.status, 200)
    const emptyBody = await emptyPublic.json()
    assert.deepEqual(emptyBody.overrides, [])
    assert.equal(emptyBody.configured, false)

    const store = createMemoryPlaceOverrideStore()
    await store.upsert({
      placeId: 'dhaba-beas-panska',
      hidden: true,
      name: null,
      address: null,
      category: null,
      adminNote: 'interní',
    })

    const listed = await placeOverridesHttp(req('/api/place-overrides'), { store })
    assert.equal(listed.status, 200)
    const publicBody = await listed.json()
    assert.equal(publicBody.overrides.length, 1)
    assert.equal(publicBody.overrides[0].hidden, true)
    assert.equal(publicBody.overrides[0].adminNote, undefined)

    const forbidden = await placeOverridesHttp(
      req('/api/admin/place-overrides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ placeId: 'dhaba-beas-panska', hidden: false }),
      }),
      { store, isAdmin: async () => false, placeExists: () => true },
    )
    assert.equal(forbidden.status, 403)

    const saved = await placeOverridesHttp(
      req('/api/admin/place-overrides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          placeId: 'dhaba-beas-panska',
          hidden: false,
          name: 'Dhaba Beas',
        }),
      }),
      { store, isAdmin: async () => true, placeExists: () => true },
    )
    assert.equal(saved.status, 200)
    const body = await saved.json()
    assert.equal(body.override.name, 'Dhaba Beas')
  })
})
