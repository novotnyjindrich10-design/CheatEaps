import { expect, test as base } from '@playwright/test'

export const GUEST = { ok: true, configured: true, authenticated: false, email: '' }
export const USER = { ok: true, configured: true, authenticated: true, email: 'tester@example.com' }

const EMPTY_REVIEWS = {
  ok: true,
  summary: { count: 0, average: null, label: 'Zatím bez hodnocení' },
  reviews: [],
}

export const test = base.extend({
  page: async ({ page }, expose) => {
    const leaks = []
    page.on('request', (request) => {
      if (/supabase\.co|resend\.com/i.test(request.url())) leaks.push(request.url())
    })
    await expose(page)
    expect(leaks, 'test nesmí volat produkční Supabase ani e-mail').toEqual([])
  },
})

export { expect }

function isLocal(url) {
  return url.includes('127.0.0.1') || url.includes('localhost')
}

function isApiUrl(url) {
  try {
    const path = new URL(url).pathname
    return path === '/api' || path.startsWith('/api/')
  } catch {
    return false
  }
}

/** 1×1 PNG — mock mapových dlaždic bez CDN. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Minimální MapLibre styl — E2E nemusí stahovat planet tiles. */
const MOCK_MAP_STYLE = JSON.stringify({
  version: 8,
  name: 'FoodGo E2E mock',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eef2' } }],
})

function isMapTileUrl(url) {
  return /basemaps\.cartocdn\.com|cartocdn\.com\/.*\/\d+\/\d+\/\d+|tile\.openstreetmap\.org|tiles\.openfreemap\.org|openfreemap\.org/i.test(
    url,
  )
}

export async function blockOutside(page, { allowMapTiles = false } = {}) {
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (isLocal(url)) return route.fallback()
    if (allowMapTiles && isMapTileUrl(url)) {
      if (/styles\//i.test(url) || url.endsWith('.json')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: MOCK_MAP_STYLE,
          headers: { 'access-control-allow-origin': '*' },
        })
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
    }
    return route.abort()
  })
}

export async function mockApi(page, decide, options = {}) {
  // Nejdřív obecný blocker, pak API handler (LIFO — API má přednost).
  await blockOutside(page, options)
  // Celá obrazovka GPS modalu by zablokovala běžné E2E. Location spec si výzvu zapne sám.
  if (options.locationPrompt !== true) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cheapeats.geo.prompt', 'dismissed')
      } catch {
        /* ignore */
      }
    })
  }
  await page.route(
    (url) => isLocal(url.href) && isApiUrl(url.href),
    async (route) => {
      const url = new URL(route.request().url())
      let payload = null
      try {
        payload = route.request().postDataJSON()
      } catch {
        payload = null
      }
      const result = await decide({
        path: url.pathname.replace(/\/$/, '') || '/',
        method: route.request().method(),
        url,
        body: payload,
      })
      const status = result?.status ?? 200
      const body = result?.body ?? { ok: false }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    },
  )
}

export function guestApi(extra = () => null) {
  return async (request) => {
    const custom = await extra(request)
    if (custom) return custom
    if (request.path === '/api/auth/session') return { body: { ...GUEST } }
    if (request.path === '/api/published-places') return { body: { ok: true, places: [] } }
    if (request.path === '/api/admin/me') return { body: { ok: true, admin: false } }
    if (request.path === '/api/reviews') return { body: EMPTY_REVIEWS }
    if (request.path === '/api/loyalty/rewards') {
      return { status: 503, body: { ok: false, error: 'not-ready' } }
    }
    if (request.path === '/api/place-reports') {
      if (request.method === 'POST') {
        return { body: { ok: true, stored: true, received: true, id: 'mock-report' } }
      }
      return { status: 403, body: { ok: false, message: 'Forbidden' } }
    }
    if (request.path === '/api/place-stats/event') {
      return { body: { ok: true, stored: true, persistent: true } }
    }
    if (request.path === '/api/place-stats') return { status: 404, body: { ok: false } }
    return { status: 404, body: { ok: false } }
  }
}

export async function openAsGuest(page, options = {}) {
  await mockApi(page, guestApi(), options)
}
