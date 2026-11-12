import { GUEST, USER, expect, guestApi, mockApi, test } from './helpers.js'

test.describe('auth jen proti mockovanému API', () => {
  test('registrace, přihlášení, návrat na slevy, oblíbené, recenze a odhlášení', async ({ page }) => {
    let session = { ...GUEST }
    const calls = []
    await mockApi(page, async (request) => {
      calls.push(`${request.method} ${request.path}`)
      if (request.path === '/api/auth/session') return { body: { ...session } }
      if (request.path === '/api/auth/signup') {
        return {
          body: {
            ok: true,
            authenticated: false,
            needsConfirmation: true,
            message: 'Potvrď e-mail a pak se přihlas.',
          },
        }
      }
      if (request.path === '/api/auth/login') {
        session = { ...USER }
        return { body: { ok: true, authenticated: true, email: USER.email } }
      }
      if (request.path === '/api/auth/logout') {
        session = { ...GUEST }
        return { body: { ok: true, authenticated: false } }
      }
      if (request.path === '/api/auth/recover') {
        return { body: { ok: true, sent: true, message: 'Pokud účet existuje, poslali jsme odkaz.' } }
      }
      if (request.path === '/api/favorites') {
        return { body: { ok: true, ids: ['dhaba-beas-panska'] } }
      }
      if (request.path === '/api/reviews' && request.method === 'POST') {
        return {
          body: {
            ok: true,
            saved: true,
            message: 'Recenze čeká na schválení.',
            summary: { count: 0, average: null, label: 'Zatím bez hodnocení' },
            reviews: [],
          },
        }
      }
      return guestApi()(request)
    })

    await page.goto('/registrace')
    await expect(page.getByRole('heading', { name: 'Registrace' })).toBeVisible()
    await page.getByLabel('E-mail').fill('tester@example.com')
    await page.getByLabel('Heslo').fill('heslo-test-123')
    await page.getByRole('button', { name: 'Vytvořit účet' }).click()
    await expect(page.getByText('Potvrď e-mail a pak se přihlas.')).toBeVisible()

    await page.goto('/prihlaseni?next=%2Foblibene')
    await page.getByLabel('E-mail').fill('tester@example.com')
    await page.getByLabel('Heslo').fill('heslo-test-123')
    await page.getByRole('button', { name: 'Přihlásit se' }).click()
    await expect(page).toHaveURL(/\/oblibene/)
    await expect(page.getByText('tester@example.com').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dhaba Beas Panská' })).toBeVisible({ timeout: 20_000 })

    // Session po hard reloadu (stejný mock session stav v Node).
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('tester@example.com').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Dhaba Beas Panská' })).toBeVisible({ timeout: 20_000 })

    await page.goto('/restaurant/dhaba-beas-panska', { waitUntil: 'domcontentloaded' })
    await page.getByRole('radio', { name: '4 z 5' }).click()
    await page.getByLabel('Text recenze').fill('Mockovaná recenze, nikam se neukládá.')
    await page.getByRole('button', { name: 'Uložit recenzi' }).click()
    await expect(page.getByText('Recenze čeká na schválení.')).toBeVisible()

    await page.getByRole('button', { name: 'Odhlásit' }).first().click()
    await expect(page.getByRole('link', { name: 'Přihlášení' }).first()).toBeVisible()
    expect(calls.some((call) => call.startsWith('POST /api/auth/logout'))).toBe(true)
  })

  test('obnova hesla a nové heslo zůstanou na mocku', async ({ page }) => {
    await mockApi(
      page,
      guestApi(async (request) => {
        if (request.path === '/api/auth/recover') {
          return { body: { ok: true, sent: true, message: 'Pokud účet existuje, poslali jsme odkaz.' } }
        }
        if (request.path === '/api/auth/prepare-recovery') return { body: { ok: true, ready: true } }
        if (request.path === '/api/auth/update-password') {
          return { body: { ok: true, passwordUpdated: true } }
        }
        return null
      }),
    )

    await page.goto('/prihlaseni?obnova=1')
    await expect(page.getByRole('heading', { name: 'Zapomenuté heslo' })).toBeVisible()
    await page.getByLabel('E-mail').fill('tester@example.com')
    await page.getByRole('button', { name: 'Poslat odkaz' }).click()
    await expect(page.getByText('Pokud účet existuje, poslali jsme odkaz.')).toBeVisible()

    await page.goto('/nove-heslo#access_token=mock-access&refresh_token=mock-refresh&type=recovery')
    await expect(page.getByLabel('Nové heslo')).toBeVisible()
    await page.getByLabel('Nové heslo').fill('nove-heslo-123')
    await page.getByLabel('Heslo znovu').fill('nove-heslo-123')
    await page.getByRole('button', { name: 'Uložit heslo' }).click()
    await expect(page.getByText('Heslo je změněné.')).toBeVisible()
  })
})
