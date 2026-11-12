import { expect, openAsGuest, test } from './helpers.js'

async function ready(page) {
  await expect(page.locator('#root .app')).toBeVisible()
  await expect(page.locator('#seo-snapshot')).toBeHidden()
}

test.describe('veřejné stránky, desktop 1280', () => {
  test.beforeEach(async ({ page }) => {
    await openAsGuest(page)
  })

  test('úvod, výsledky a detail nenačítají cizí písmo', async ({ page }) => {
    const external = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return
      external.push(`${url.hostname}${url.pathname}`)
    })
    for (const path of ['/', '/results', '/restaurant/dhaba-beas-panska']) {
      await page.goto(path)
      await ready(page)
    }
    expect(external.filter((item) => /fonts\.google|gstatic|fonts\.gstatic/.test(item))).toEqual([])
    expect(external).toEqual([])
  })

  test('úvod má hledání a po hydrataci schová statický blok', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await ready(page)
    await expect(page).toHaveTitle(/FoodGo Brno.*Brně|FoodGo Brno/)
    await expect(page.getByRole('heading', { level: 1, name: 'Najdi jídlo v Brně' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Hledat restauraci v Brně' })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /127\.0\.0\.1:5173\/$/)
    await expect(page.getByRole('link', { name: 'Přeskočit na obsah' })).toHaveAttribute('href', '#main-content')
    expect(errors).toEqual([])
  })

  test('hledání pizza neotevře Gelateria Piazza', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.getByRole('combobox', { name: 'Hledat restauraci v Brně' }).fill('pizza')
    await page.getByRole('button', { name: 'Hledat' }).click()
    await expect(page).toHaveURL(/\/results\?.*q=pizza/)
    await expect(page.getByRole('heading', { name: /Piazza/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Prova Bistro/ }).first()).toBeVisible()
  })

  test('kategorie Pizza a rozpočet do 150 Kč', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.locator('a[href="/results?type=pizza"]:not([data-clone])').first().click()
    await expect(page).toHaveURL(/type=pizza/)
    await expect(page.locator('button.category-card--pizza[aria-pressed="true"]')).toBeVisible()
    await page.goto('/results?budget=150')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/budget=150/)
  })

  test('přímá adresa detailu a neznámá adresa', async ({ page }) => {
    await page.goto('/restaurant/dhaba-beas-panska')
    await ready(page)
    await expect(page).toHaveTitle(/Dhaba Beas Panská/)
    await expect(page.getByRole('heading', { level: 1, name: 'Dhaba Beas Panská' })).toBeVisible()
    await expect(page.getByText('Panská 12').first()).toBeVisible()
    await page.goto('/tahle-adresa-neexistuje')
    await expect(page.getByRole('heading', { name: 'Stránka nenalezena' })).toBeVisible()
  })

  test('viditelné obrázky na úvodu nejsou rozbité', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.waitForTimeout(500)
    const broken = await page.locator('img').evaluateAll((images) =>
      images
        .filter((image) => image.complete && image.naturalWidth === 0 && image.currentSrc)
        .map((image) => image.currentSrc),
    )
    expect(broken).toEqual([])
  })

  test('slevy bez přihlášení přesměrují na přihlášení', async ({ page }) => {
    await page.goto('/results?deals=1')
    await ready(page)
    await expect(page).toHaveURL(/\/prihlaseni\?next=/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible()
    await expect(page.getByText(/ověřených ISIC nabídek/i)).toBeVisible()
  })

  test('odměny bez tabulek ukážou Připravujeme', async ({ page }) => {
    await page.goto('/odmeny')
    await expect(page.getByRole('heading', { name: 'Slevy a odměny' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Připravujeme.' })).toBeVisible()
  })

  test('nedostupné API neshodí katalog a slevy neotevře', async ({ page }) => {
    await page.unroute('**/api/**')
    await page.route('**/api/**', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Najdi jídlo v Brně' })).toBeVisible()
    await page.goto('/results?deals=1')
    await expect(page).toHaveURL(/\/prihlaseni/)
    await expect(page.getByText('Stav účtu se nepodařilo ověřit.')).toBeVisible()
    await page.goto('/odmeny')
    await expect(page.getByText('Odměny se nepodařilo načíst.')).toBeVisible()
  })

  test('geolokace s mockovanými souřadnicemi', async ({ page }) => {
    await page.addInitScript(() => {
      const position = {
        coords: { latitude: 49.19522, longitude: 16.60796, accuracy: 15 },
        timestamp: Date.now(),
      }
      navigator.geolocation.getCurrentPosition = (success) => success(position)
      navigator.geolocation.watchPosition = (success) => {
        success(position)
        return 1
      }
    })
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Použít moji polohu' }).click()
    await expect(page.getByText(/Poloha je aktivní|Poloha aktualizována/)).toBeVisible()
  })

  test('zamítnutá geolokace ukáže zákaz', async ({ page }) => {
    await page.addInitScript(() => {
      const error = { code: 1, PERMISSION_DENIED: 1, message: 'denied' }
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(error)
      navigator.geolocation.watchPosition = (_ok, fail) => {
        fail?.(error)
        return 1
      }
    })
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Použít moji polohu' }).click()
    await expect(page.getByText(/Poloha je v prohlížeči zakázaná/i).first()).toBeVisible()
  })
})

test.describe('mobil 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('hamburger otevře menu a přímý detail zůstane čitelný', async ({ page }) => {
    await openAsGuest(page)
    await page.goto('/')
    await ready(page)
    await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Otevřít menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Mobilní menu' })).toBeVisible()
    await page.getByRole('link', { name: 'Najít podnik' }).last().click()
    await expect(page).toHaveURL(/\/results/)
    await page.goto('/restaurant/dhaba-beas-panska')
    await expect(page.getByRole('heading', { level: 1, name: 'Dhaba Beas Panská' })).toBeVisible()
  })
})
