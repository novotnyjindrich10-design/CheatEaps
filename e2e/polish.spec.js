import { expect, openAsGuest, mockApi, guestApi, test } from './helpers.js'

async function ready(page) {
  await expect(page.locator('#root .app')).toBeVisible()
  await expect(page.locator('#seo-snapshot')).toBeHidden()
}

function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    return {
      client: doc.clientWidth,
      scroll: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    }
  })
}

test.describe('final polish — mapa s mock dlaždicemi', () => {
  test('mapa načte mockované dlaždice, atribuci a filtr kategorie', async ({ page }) => {
    await openAsGuest(page, { allowMapTiles: true })
    await page.goto('/results?view=map&type=pizza')
    await ready(page)
    await expect(page.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.restaurant-map-canvas')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.restaurant-map-count')).toContainText(/bod/)
    await expect(page.locator('.leaflet-control-attribution')).toContainText(/OpenStreetMap/i)
    await expect(page.locator('.leaflet-control-attribution')).toContainText(/CARTO/i)
    await expect(page.locator('.leaflet-tile-pane img').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Seznam' }).click()
    await expect(page).not.toHaveURL(/view=map/)
    await expect(page.locator('.restaurant-list li').first()).toBeVisible()
  })

  test('nedostupné dlaždice neshodí mapový canvas', async ({ page }) => {
    await openAsGuest(page, { allowMapTiles: false })
    await page.goto('/results?view=map&type=pizza')
    await ready(page)
    await expect(page.locator('.restaurant-map-canvas')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.restaurant-map-count')).toContainText(/bod/)
    await expect(page.locator('.leaflet-control-attribution')).toContainText(/OpenStreetMap/i)
  })
})

test.describe('final polish — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await openAsGuest(page)
  })

  test('Nevím, co jíst vybere podnik a otevře detail', async ({ page }) => {
    await page.goto('/nevim-co-jist')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Nevím, co jíst' })).toBeVisible()
    await page.getByRole('button', { name: 'Překvap mě' }).click()
    await expect(page.locator('.restaurant-card').first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Otevřít detail' }).click()
    await expect(page).toHaveURL(/\/restaurant\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('guest oblíbené se uloží v prohlížeči', async ({ page }) => {
    await page.goto('/restaurant/gyros-taverna-athena-stefanikova-4')
    await ready(page)
    await page.getByRole('button', { name: 'Uložit' }).click()
    await expect(page.getByRole('button', { name: 'V oblíbených' })).toBeVisible()
    await page.goto('/oblibene')
    await ready(page)
    await expect(page.getByRole('heading', { name: /Gyros Taverna Athena/i })).toBeVisible()
  })

  test('hlášení chyby přijme validní formulář', async ({ page }) => {
    await mockApi(
      page,
      guestApi((request) => {
        if (request.path === '/api/place-reports' && request.method === 'POST') {
          return { body: { ok: true, stored: true, received: true, id: 'e2e-report' } }
        }
        if (request.path === '/api/place-stats/event') {
          return { body: { ok: true, stored: true, persistent: true } }
        }
        return null
      }),
    )
    await page.goto('/restaurant/dhaba-beas-panska')
    await ready(page)
    await page.locator('.place-report select').selectOption('address')
    await page.locator('.place-report textarea').fill('Špatné číslo popisné na štítku.')
    await page.getByRole('button', { name: 'Odeslat hlášení' }).click()
    await expect(page.getByText(/Hlášení.*uložili ke kontrole/i)).toBeVisible()
  })

  test('detail Athena má ilustraci kebab a otevírací dobu', async ({ page }) => {
    await page.goto('/restaurant/gyros-taverna-athena-stefanikova-4')
    await ready(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Gyros Taverna Athena' })).toBeVisible()
    await expect(page.locator('img[src*="6208833"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Otevírací doba' })).toBeVisible()
    await expect(page.getByText(/Štefánikova/i).first()).toBeVisible()
  })

  test('zamítnutá geolokace na výsledcích nezobrazí falešnou vzdálenost', async ({ page }) => {
    await page.addInitScript(() => {
      const error = { code: 1, PERMISSION_DENIED: 1, message: 'denied' }
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(error)
      navigator.geolocation.watchPosition = (_ok, fail) => {
        fail?.(error)
        return 1
      }
    })
    await page.goto('/results')
    await ready(page)
    await page.getByRole('button', { name: 'Použít moji polohu' }).click()
    await expect(page.getByText(/Poloha je v prohlížeči zakázaná/i).first()).toBeVisible()
    await expect(page.getByText(/\d+\s*m pěšky|\d+,\d+\s*km pěšky/)).toHaveCount(0)
  })
})

test.describe('final polish — mobil 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await openAsGuest(page)
  })

  test('mobilní menu, mapa a overflow', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    const homeOverflow = await noHorizontalOverflow(page)
    expect(homeOverflow.overflow).toBe(false)

    await page.getByRole('button', { name: 'Otevřít menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Mobilní menu' })).toBeVisible()
    await page.getByRole('link', { name: 'Nevím, co jíst' }).last().click()
    await expect(page).toHaveURL(/nevim-co-jist/)

    await openAsGuest(page, { allowMapTiles: true })
    await page.goto('/results?view=map&type=burger')
    await ready(page)
    await expect(page.locator('.restaurant-map-canvas')).toBeVisible({ timeout: 20_000 })
    const mapOverflow = await noHorizontalOverflow(page)
    expect(mapOverflow.overflow).toBe(false)
  })

  test('filtry a detail na úzkém displeji', async ({ page }) => {
    await page.goto('/results?type=pizza')
    await ready(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await noHorizontalOverflow(page)
    expect(overflow.overflow).toBe(false)
    await expect(page.getByRole('link', { name: 'Detail' }).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: 'Detail' }).first().click()
    await expect(page).toHaveURL(/\/restaurant\//)
    await expect(page.getByRole('button', { name: /Uložit|V oblíbených/ })).toBeVisible()
  })
})

test.describe('final polish — velmi úzký 320', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('320 px bez horizontálního scrollu na úvodu a výsledcích', async ({ page }) => {
    await openAsGuest(page)
    for (const path of ['/', '/results', '/nevim-co-jist', '/oblibene']) {
      await page.goto(path)
      await ready(page)
      const state = await noHorizontalOverflow(page)
      expect(state.overflow, path).toBe(false)
    }
  })
})
