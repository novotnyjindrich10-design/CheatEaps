import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { authActionHttp, dealDetailHttp } from './memberHttp.js'
import { authConfig, resetAuthLimits } from './supabaseAuth.js'

const ENV = { SUPABASE_URL: 'https://projekt.supabase.co', SUPABASE_ANON_KEY: 'anon-test-key' }

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function userFetch(url) {
  const href = String(url)
  if (href.endsWith('/auth/v1/user')) return jsonResponse({ id: 'user-1', email: 'a@student.cz' })
  return jsonResponse({}, 404)
}

beforeEach(() => {
  resetAuthLimits()
})

describe('adresa Supabase', () => {
  it('z odkazu na REST udělá kořen projektu', () => {
    const config = authConfig({
      SUPABASE_URL: 'https://projekt.supabase.co/rest/v1/',
      SUPABASE_ANON_KEY: 'klic',
    })
    assert.equal(config.url, 'https://projekt.supabase.co')
    assert.equal(config.configured, true)
  })
})

describe('přihlášení', () => {
  it('bez konfigurace účet nezaloží a kód nepošle', async () => {
    const response = await authActionHttp(
      'login',
      new Request('http://127.0.0.1/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@student.cz', password: 'hesloheslo' }),
      }),
      { env: {}, fetchImpl: () => { throw new Error('síť se nesmí volat') } },
    )
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.error, 'auth-not-configured')
    assert.equal(body.authenticated, false)
    const deal = await dealDetailHttp(new Request('http://127.0.0.1/api/deal-detail?id=kfc-isic-twister--kfc-masarykova-39'), {
      env: {},
    })
    const locked = await deal.json()
    assert.equal(deal.status, 503)
    assert.equal(JSON.stringify(locked).includes('TWIST2ISIC'), false)
  })

  it('po přihlášení uloží relaci do httpOnly cookie a vrátí se bez hesla v odpovědi', async () => {
    const response = await authActionHttp(
      'login',
      new Request('http://127.0.0.1/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'A@Student.cz', password: 'hesloheslo' }),
      }),
      {
        env: ENV,
        fetchImpl: (url) => {
          assert.match(String(url), /grant_type=password/)
          return jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 })
        },
      },
    )
    const body = await response.json()
    assert.equal(body.authenticated, true)
    assert.equal(body.email, 'a@student.cz')
    assert.equal(JSON.stringify(body).includes('hesloheslo'), false)
    assert.equal(JSON.stringify(body).includes('anon-test-key'), false)
    const cookie = response.headers.getSetCookie().join(';')
    assert.match(cookie, /ce_access=/)
    assert.match(cookie, /HttpOnly/)
  })

  it('registrace bez relace požádá o potvrzení e-mailu', async () => {
    const response = await authActionHttp(
      'signup',
      new Request('http://127.0.0.1/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@student.cz', password: 'hesloheslo' }),
      }),
      { env: ENV, fetchImpl: () => jsonResponse({ id: 'user-1', email: 'a@student.cz' }) },
    )
    const body = await response.json()
    assert.equal(body.needsConfirmation, true)
    assert.equal(body.authenticated, false)
    assert.equal(response.headers.getSetCookie().length, 0)
  })
})

describe('detail nabídky', () => {
  const dealUrl = 'http://127.0.0.1/api/deal-detail?id=kfc-isic-twister--kfc-masarykova-39'

  it('nepřihlášený uživatel kód nedostane', async () => {
    const response = await dealDetailHttp(new Request(dealUrl), {
      env: ENV,
      fetchImpl: () => jsonResponse({ message: 'no' }, 401),
    })
    const body = await response.json()
    assert.equal(response.status, 401)
    assert.equal(body.error, 'auth-required')
    assert.equal(JSON.stringify(body).includes('TWIST2ISIC'), false)
  })

  it('přihlášený uživatel dostane kód jen u aktivní nabídky', async () => {
    const response = await dealDetailHttp(new Request(dealUrl, { headers: { cookie: 'ce_access=good' } }), {
      env: ENV,
      fetchImpl: userFetch,
    })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.code, 'TWIST2ISIC')
    assert.equal(body.restaurantId, 'kfc-masarykova-39')
    assert.equal(body.validityFullyVerified, false)
  })

  it('prošlou nabídku nevrátí jako aktivní', async () => {
    const response = await dealDetailHttp(
      new Request('http://127.0.0.1/api/deal-detail?id=starbucks-isic-venti-bogo--starbucks-namesti-svobody-5', {
        headers: { cookie: 'ce_access=good' },
      }),
      { env: ENV, fetchImpl: userFetch, now: new Date('2026-11-18T12:00:00+01:00') },
    )
    const body = await response.json()
    assert.equal(response.status, 410)
    assert.equal(body.error, 'deal-expired')
    assert.equal(Object.hasOwn(body, 'code'), false)
  })
})

describe('obnova hesla', () => {
  function recoverRequest(origin) {
    const headers = { 'content-type': 'application/json' }
    if (origin) headers.origin = origin
    return new Request('http://127.0.0.1/api/auth/recover', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'A@Student.cz' }),
    })
  }

  it('bez konfigurace e-mail neoznačí za odeslaný', async () => {
    const response = await authActionHttp('recover', recoverRequest('http://127.0.0.1:5173'), {
      env: {},
      authClient: () => {
        throw new Error('Supabase se nesmí volat')
      },
    })
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.error, 'auth-not-configured')
    assert.notEqual(body.sent, true)
  })

  it('chybu Supabase ukáže a úspěch nepředstírá', async () => {
    const response = await authActionHttp('recover', recoverRequest('http://127.0.0.1:5173'), {
      env: ENV,
      authClient: () => ({
        auth: {
          resetPasswordForEmail: async () => ({ error: { message: 'redirect url not allowed', status: 400 } }),
        },
      }),
    })
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.equal(body.sent, false)
    assert.equal(body.error, 'redirect-not-allowed')
    assert.equal(String(body.message).includes('poslali jsme'), false)
  })

  it('pošle resetPasswordForEmail na /nove-heslo a cizí origin odmítne', async () => {
    const calls = []
    const authClient = () => ({
      auth: {
        resetPasswordForEmail: async (email, options) => {
          calls.push({ email, options })
          return { error: null }
        },
      },
    })
    const response = await authActionHttp('recover', recoverRequest('http://127.0.0.1:5173'), {
      env: ENV,
      authClient,
    })
    const body = await response.json()
    assert.equal(body.sent, true)
    assert.equal(body.redirectTo, 'http://127.0.0.1:5173/nove-heslo')
    assert.deepEqual(calls, [
      {
        email: 'a@student.cz',
        options: { redirectTo: 'http://127.0.0.1:5173/nove-heslo' },
      },
    ])
    const blocked = await authActionHttp('recover', recoverRequest('https://evil.test'), { env: ENV, authClient })
    const blockedBody = await blocked.json()
    assert.equal(blockedBody.sent, false)
    assert.equal(calls.length, 1)
  })

  it('bez Origin sestaví redirect z Referer nebo Host a neoznačí HTTP chybu za odeslání', async () => {
    const calls = []
    const authClient = () => ({
      auth: {
        resetPasswordForEmail: async (email, options) => {
          calls.push({ email, options })
          return { error: null }
        },
      },
    })
    const viaReferer = await authActionHttp(
      'recover',
      new Request('http://127.0.0.1/api/auth/recover', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          referer: 'http://localhost:5173/prihlaseni?obnova=1',
        },
        body: JSON.stringify({ email: 'a@student.cz' }),
      }),
      { env: ENV, authClient },
    )
    assert.equal((await viaReferer.json()).sent, true)
    assert.equal(calls[0].options.redirectTo, 'http://localhost:5173/nove-heslo')

    const viaHost = await authActionHttp(
      'recover',
      new Request('http://127.0.0.1/api/auth/recover', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: '127.0.0.1:5173',
        },
        body: JSON.stringify({ email: 'a@student.cz' }),
      }),
      { env: ENV, authClient },
    )
    assert.equal((await viaHost.json()).sent, true)
    assert.equal(calls[1].options.redirectTo, 'http://127.0.0.1:5173/nove-heslo')

    const failed = await authActionHttp('recover', recoverRequest('http://127.0.0.1:5173'), {
      env: ENV,
      fetchImpl: async (url) => {
        assert.match(String(url), /\/auth\/v1\/recover\?redirect_to=/)
        assert.match(String(url), /nove-heslo/)
        return new Response(JSON.stringify({ msg: 'redirect url not allowed', error_code: 'validation_failed' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    const failedBody = await failed.json()
    assert.equal(failed.status, 400)
    assert.equal(failedBody.sent, false)
    assert.equal(failedBody.error, 'redirect-not-allowed')
    assert.equal(String(failedBody.message).includes('poslali jsme'), false)
  })

  it('bez relace z odkazu heslo neuloží', async () => {
    const response = await authActionHttp(
      'update-password',
      new Request('http://127.0.0.1/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'noveheslo' }),
      }),
      { env: ENV, authClient: () => { throw new Error('bez tokenu se nevolá') } },
    )
    const body = await response.json()
    assert.equal(response.status, 401)
    assert.equal(body.passwordUpdated, false)
  })

  it('vypršelý odkaz neoznačí za uložené heslo', async () => {
    const response = await authActionHttp(
      'update-password',
      new Request('http://127.0.0.1/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'noveheslo', accessToken: 'stary', refreshToken: 'stary-refresh' }),
      }),
      {
        env: ENV,
        authClient: () => ({
          auth: {
            setSession: async () => ({ error: { message: 'invalid grant', status: 401 } }),
            updateUser: async () => {
              throw new Error('updateUser se po chybě session nevolá')
            },
          },
        }),
      },
    )
    const body = await response.json()
    assert.equal(body.passwordUpdated, false)
    assert.equal(body.error, 'link-expired')
    assert.match(body.message, /vypršel|použitý/)
  })

  it('prepare-recovery ověří tokeny a updateUser pak bere session z cookie', async () => {
    let setCount = 0
    let saved = ''
    const authClient = () => ({
      auth: {
        setSession: async ({ access_token, refresh_token }) => {
          setCount += 1
          assert.equal(access_token, 'access-recovery')
          assert.equal(refresh_token, 'refresh-recovery')
          return {
            data: {
              session: { access_token, refresh_token, expires_in: 3600 },
              user: { email: 'a@student.cz' },
            },
            error: null,
          }
        },
        updateUser: async ({ password }) => {
          saved = password
          return { data: { user: { email: 'a@student.cz' }, session: null }, error: null }
        },
        verifyOtp: async () => {
          throw new Error('verifyOtp se u tokenů nevolá')
        },
      },
    })
    const prepared = await authActionHttp(
      'prepare-recovery',
      new Request('http://127.0.0.1/api/auth/prepare-recovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken: 'access-recovery', refreshToken: 'refresh-recovery' }),
      }),
      { env: ENV, authClient },
    )
    const preparedBody = await prepared.json()
    assert.equal(preparedBody.ready, true)
    assert.equal(JSON.stringify(preparedBody).includes('access-recovery'), false)
    const cookie = prepared.headers.getSetCookie().join(';')
    assert.match(cookie, /ce_access=/)
    assert.match(cookie, /ce_refresh=/)

    const updated = await authActionHttp(
      'update-password',
      new Request('http://127.0.0.1/api/auth/update-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ password: 'noveheslo' }),
      }),
      { env: ENV, authClient },
    )
    const body = await updated.json()
    assert.equal(body.passwordUpdated, true)
    assert.equal(saved, 'noveheslo')
    assert.ok(setCount >= 2)
  })

  it('token_hash z e-mailu ověří přes verifyOtp a PKCE bez verifieru odmítne', async () => {
    const prepared = await authActionHttp(
      'prepare-recovery',
      new Request('http://127.0.0.1/api/auth/prepare-recovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokenHash: 'hash-1', type: 'recovery' }),
      }),
      {
        env: ENV,
        authClient: () => ({
          auth: {
            verifyOtp: async ({ token_hash, type }) => {
              assert.equal(token_hash, 'hash-1')
              assert.equal(type, 'recovery')
              return {
                data: {
                  session: { access_token: 'a1', refresh_token: 'r1', expires_in: 60 },
                  user: { email: 'a@student.cz' },
                },
                error: null,
              }
            },
          },
        }),
      },
    )
    assert.equal((await prepared.json()).ready, true)

    const pkce = await authActionHttp(
      'prepare-recovery',
      new Request('http://127.0.0.1/api/auth/prepare-recovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code' }),
      }),
      {
        env: ENV,
        authClient: () => {
          throw new Error('bez verifieru se SDK nevolá')
        },
        fetchImpl: () => {
          throw new Error('bez verifieru se síť nevolá')
        },
      },
    )
    const pkceBody = await pkce.json()
    assert.equal(pkce.status, 401)
    assert.equal(pkceBody.ready, false)
    assert.equal(pkceBody.error, 'link-expired')
  })

  it('updateUser uloží heslo a do odpovědi token nevrátí', async () => {
    let saved = ''
    const response = await authActionHttp(
      'update-password',
      new Request('http://127.0.0.1/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'noveheslo', accessToken: 'access-recovery', refreshToken: 'refresh-recovery' }),
      }),
      {
        env: ENV,
        authClient: () => ({
          auth: {
            setSession: async () => ({ data: { session: { access_token: 'access-recovery', refresh_token: 'refresh-recovery' } }, error: null }),
            updateUser: async ({ password }) => {
              saved = password
              return { data: { user: { email: 'a@student.cz' }, session: null }, error: null }
            },
          },
        }),
      },
    )
    const body = await response.json()
    assert.equal(body.passwordUpdated, true)
    assert.equal(saved, 'noveheslo')
    assert.equal(JSON.stringify(body).includes('access-recovery'), false)
    assert.match(response.headers.getSetCookie().join(';'), /ce_access=/)
  })
})
