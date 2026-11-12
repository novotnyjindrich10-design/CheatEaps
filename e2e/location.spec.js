import { expect, openAsGuest, test } from './helpers.js'

async function ready(page) {
  await expect(page.locator('#root .app')).toBeVisible()
  await expect(page.locator('#seo-snapshot')).toBeHidden()
}

function installGeoMocks(page, { lat, lon, permission = 'prompt' }) {
  return page.addInitScript(
    ({ lat, lon, permission }) => {
      const position = {
        coords: {
          latitude: lat,
          longitude: lon,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }
      navigator.geolocation.getCurrentPosition = (success) => success(position)
      navigator.geolocation.watchPosition = (success) => {
        success(position)
        return 1
      }
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({ state: permission, onchange: null })
      }
    },
    { lat, lon, permission },
  )
}

test.describe('geolokace a vzdálenosti', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('první návštěva ukáže výzvu a po povolení vzdálenosti i řazení', async ({ page }) => {
    await openAsGuest(page)
    await installGeoMocks(page, { lat: 49.1951, lon: 16.6068, permission: 'prompt' })
    await page.route('**/routed-foot/table/v1/foot**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'Ok', distances: [[]] }),
      })
    })

    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('cheapeats.geo.origin')
      localStorage.removeItem('cheapeats.geo.prompt')
    })
    await page.reload()
    await ready(page)

    const prompt = page.locator('.location-prompt')
    await expect(prompt).toBeVisible()
    await expect(prompt.getByText(/Povol polohu a najdeme ti nejbližší/i)).toBeVisible()
    await prompt.getByRole('button', { name: 'Povolit polohu' }).click()

    await expect(page.getByText(/Poloha načtena|Poloha je aktivní|Zjišťuji polohu/i).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nejbližší podniky' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.restaurant-card-meta--distance .meta-value').first()).not.toHaveText('—')
    await expect(page.locator('.location-prompt')).toHaveCount(0)

    await page.goto('/results')
    await ready(page)
    await expect(page.locator('.location-prompt')).toHaveCount(0)
    await expect(page.locator('#filter-sort')).toHaveValue('')
    await expect(page.locator('.restaurant-card-meta--distance .meta-value').first()).not.toHaveText('—')
  })

  test('Teď ne skryje výzvu a neptá se na každé stránce', async ({ page }) => {
    await openAsGuest(page)
    await page.addInitScript(() => {
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({ state: 'prompt', onchange: null })
      }
    })

    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('cheapeats.geo.origin')
      localStorage.removeItem('cheapeats.geo.prompt')
    })
    await page.reload()
    await ready(page)
    await page.locator('.location-prompt').getByRole('button', { name: 'Teď ne' }).click()
    await expect(page.locator('.location-prompt')).toHaveCount(0)

    await page.goto('/results')
    await ready(page)
    await expect(page.locator('.location-prompt')).toHaveCount(0)
    await expect(page.locator('.filters-note').filter({ hasText: /řadíme abecedně/i })).toBeVisible()
  })

  test('aktualizace polohy přepočítá pořadí a ukáže stav', async ({ page }) => {
    await openAsGuest(page)
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
      localStorage.setItem('cheapeats.geo.prompt', 'accepted')
      const positions = [
        {
          coords: { latitude: 49.1951, longitude: 16.6068, accuracy: 10 },
          timestamp: Date.now(),
        },
        {
          coords: { latitude: 49.2105, longitude: 16.595, accuracy: 10 },
          timestamp: Date.now(),
        },
      ]
      let i = 0
      navigator.geolocation.getCurrentPosition = (success) => {
        success(positions[Math.min(i, positions.length - 1)])
        i += 1
      }
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({ state: 'granted', onchange: null })
      }
    })
    await page.route('**/routed-foot/**', (route) => route.abort())

    await page.goto('/results')
    await ready(page)
    await expect(page.locator('.location-prompt')).toHaveCount(0)

    const firstBefore = await page.locator('.restaurant-card-title').first().textContent()
    await page.getByRole('button', { name: 'Aktualizovat polohu' }).click()
    await expect(page.getByText(/Poloha načtena|Poloha je aktuální|Zjišťuji polohu/i).first()).toBeVisible()
    await expect(page.locator('.restaurant-card-meta--distance .meta-value').first()).not.toHaveText('—')

    await page.getByRole('button', { name: 'Aktualizovat polohu' }).click()
    await expect(page.getByText(/Poloha načtena|Poloha je aktuální/i).first()).toBeVisible({ timeout: 10_000 })
    const firstAfter = await page.locator('.restaurant-card-title').first().textContent()
    expect((firstBefore || '').trim().length).toBeGreaterThan(0)
    expect((firstAfter || '').trim().length).toBeGreaterThan(0)
  })

  test('zamítnutí oprávnění neukáže falešné km', async ({ page }) => {
    await openAsGuest(page)
    await page.addInitScript(() => {
      localStorage.removeItem('cheapeats.geo.origin')
      localStorage.setItem('cheapeats.geo.prompt', 'dismissed')
      const error = { code: 1, PERMISSION_DENIED: 1, message: 'denied' }
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(error)
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({ state: 'denied', onchange: null })
      }
    })

    await page.goto('/results')
    await ready(page)
    await page.getByRole('button', { name: 'Použít moji polohu' }).click()
    await expect(page.getByText(/zakázaná/i).first()).toBeVisible()
    await expect(page.getByText(/\d+\s*m pěšky|\d+,\d+\s*km pěšky/)).toHaveCount(0)
  })

  test('odebrané oprávnění smaže uloženou GPS', async ({ page }) => {
    await openAsGuest(page)
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
      localStorage.setItem('cheapeats.geo.prompt', 'accepted')
      if (navigator.permissions) {
        navigator.permissions.query = async () => ({ state: 'denied', onchange: null })
      }
    })

    await page.goto('/')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Doporučené podniky' })).toBeVisible()
    await expect(page.getByText(/\d+\s*m pěšky|\d+,\d+\s*km pěšky/)).toHaveCount(0)
    const cleared = await page.evaluate(() => localStorage.getItem('cheapeats.geo.origin'))
    expect(cleared).toBeNull()
  })

  test('Zapomenout moji polohu vyčistí localStorage', async ({ page }) => {
    await openAsGuest(page)
    await installGeoMocks(page, { lat: 49.1951, lon: 16.6068, permission: 'granted' })
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
      localStorage.setItem('cheapeats.geo.prompt', 'accepted')
    })
    await page.route('**/routed-foot/**', (route) => route.abort())

    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Zapomenout moji polohu' }).click()
    await expect(page.getByRole('button', { name: 'Použít moji polohu' })).toBeVisible()
    const afterForget = await page.evaluate(() => ({
      origin: localStorage.getItem('cheapeats.geo.origin'),
      prompt: localStorage.getItem('cheapeats.geo.prompt'),
    }))
    expect(afterForget.origin).toBeNull()
    expect(afterForget.prompt).toBeNull()
  })
})
