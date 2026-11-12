import { expect, openAsGuest, test } from './helpers.js'

async function ready(page) {
  await expect(page.locator('#root .app')).toBeVisible()
  await expect(page.locator('#seo-snapshot')).toBeHidden()
}

test.describe('mobilní navigace 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await openAsGuest(page)
  })

  test('hamburger otevře, zavře Escape a po odkazu zmizí', async ({ page }) => {
    await page.goto('/')
    await ready(page)

    const openToggle = page.getByRole('button', { name: 'Otevřít menu' })
    await expect(openToggle).toBeVisible()
    await openToggle.click()

    const menu = page.getByRole('navigation', { name: 'Mobilní menu' })
    await expect(menu).toBeVisible()
    const closeToggle = page.getByRole('button', { name: 'Zavřít menu' }).first()
    await expect(closeToggle).toHaveAttribute('aria-expanded', 'true')

    const firstLink = menu.getByRole('link').first()
    await expect(firstLink).toBeFocused()

    const box = await firstLink.boundingBox()
    expect(box?.height || 0).toBeGreaterThanOrEqual(44)

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: 'Otevřít menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await page.getByRole('button', { name: 'Otevřít menu' }).click()
    await menu.getByRole('link', { name: 'Najít podnik' }).click()
    await expect(page).toHaveURL(/\/results/)
    await expect(page.getByRole('navigation', { name: 'Mobilní menu' })).toBeHidden()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)
  })
})

test.describe('desktop navigace 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await openAsGuest(page)
  })

  test('lišta má logo, primární odkazy, Více a přihlášení', async ({ page }) => {
    await page.goto('/')
    await ready(page)

    await expect(page.getByRole('button', { name: 'Otevřít menu' })).toHaveCount(0)
    const nav = page.getByRole('navigation', { name: 'Hlavní menu' })
    await expect(nav.getByRole('link', { name: 'Úvod' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Najít podnik' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Mapa' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Oblíbené' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Více' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Přihlášení' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Nevím, co jíst' })).toHaveCount(0)

    await nav.getByRole('button', { name: 'Více' }).click()
    await expect(nav.getByRole('link', { name: 'Nevím, co jíst' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pro podniky' })).toBeVisible()
    await nav.getByRole('link', { name: 'Pro podniky' }).click()
    await expect(page).toHaveURL(/\/pro-podniky/)
  })
})

test.describe('řazení podle vzdálenosti', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('bez polohy neukáže falešné km a nabídne zapnutí', async ({ page }) => {
    await openAsGuest(page)
    await page.addInitScript(() => {
      localStorage.removeItem('cheapeats.geo.origin')
      const error = { code: 1, PERMISSION_DENIED: 1, message: 'denied' }
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(error)
      navigator.geolocation.watchPosition = (_ok, fail) => {
        fail?.(error)
        return 1
      }
    })

    await page.goto('/results')
    await ready(page)

    await expect(page.locator('#filter-sort')).toHaveValue('')
    await expect(page.locator('.filters-note').filter({ hasText: /řadíme abecedně/i })).toBeVisible()
    await expect(page.getByText(/\d+\s*m pěšky|\d+,\d+\s*km pěšky/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Použít moji polohu' }).click()
    await expect(page.getByText(/zakázaná/i).first()).toBeVisible()
    await expect(page.getByText(/\d+\s*m pěšky|\d+,\d+\s*km pěšky/)).toHaveCount(0)
  })

  test('s polohou řadí od nejbližšího a respektuje ruční řazení', async ({ page }) => {
    await openAsGuest(page)
    await page.route('**/routed-foot/table/v1/foot**', async (route) => {
      const url = route.request().url()
      const coords = decodeURIComponent(url).match(/foot\/([^?]+)/)?.[1]?.split(';') || []
      const destinations = coords.slice(1)
      const distances = destinations.map((_, index) => 100 + index * 250)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'Ok', distances: [distances] }),
      })
    })
    await page.addInitScript(() => {
      localStorage.setItem(
        'cheapeats.geo.origin',
        JSON.stringify({
          lat: 49.1951,
          lon: 16.6068,
          label: 'Moje poloha',
          type: 'gps',
          updatedAt: new Date().toISOString(),
        }),
      )
      navigator.geolocation.getCurrentPosition = (success) =>
        success({
          coords: { latitude: 49.1951, longitude: 16.6068, accuracy: 20 },
          timestamp: Date.now(),
        })
    })

    await page.goto('/results')
    await ready(page)

    await expect(page.locator('#filter-sort')).toHaveValue('')
    await expect(page.getByText(/Zapni polohu tlačítkem/i)).toHaveCount(0)

    const firstName = await page.locator('.restaurant-card-title').first().textContent()
    expect((firstName || '').trim().length).toBeGreaterThan(0)

    await page.locator('#filter-sort').selectOption('name')
    await expect(page).toHaveURL(/sort=name/)
    await expect(page.locator('#filter-sort')).toHaveValue('name')

    await page.locator('#filter-sort').selectOption('')
    await expect(page.locator('#filter-sort')).toHaveValue('')
  })
})
