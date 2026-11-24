/**
 * Agregované statistiky profilu (bez přesné polohy).
 * Trvalé uložení jen přes Supabase RPC record_place_stat.
 * Bez DB endpoint nepotvrzuje úspěch (503) a UI nesmí slibovat běžící statistiky.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authConfig, resolveUser } from './supabaseAuth.js'
import { supabaseApiHeaders } from './supabaseApiHeaders.js'

const sqlPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../supabase/place-stats.sql')

const recentByIp = new Map()

export const PLACE_STAT_EVENTS = Object.freeze([
  'profile_view',
  'website_click',
  'directions_click',
  'phone_click',
  /** legacy alias → stejný sloupec jako directions_click */
  'route_click',
])

export function resetPlaceStatLimits() {
  recentByIp.clear()
}

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'local'
}

function rateLimited(ip) {
  const now = Date.now()
  const windowMs = 60_000
  const max = 40
  const bucket = recentByIp.get(ip) || []
  const fresh = bucket.filter((ts) => now - ts < windowMs)
  if (fresh.length >= max) {
    recentByIp.set(ip, fresh)
    return true
  }
  fresh.push(now)
  recentByIp.set(ip, fresh)
  return false
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function normalizeEvent(event) {
  const value = String(event || '').trim()
  if (value === 'route_click') return 'directions_click'
  return value
}

function columnForEvent(event) {
  const ev = normalizeEvent(event)
  if (ev === 'profile_view') return 'profileViews'
  if (ev === 'directions_click') return 'routeClicks'
  if (ev === 'website_click') return 'websiteClicks'
  if (ev === 'phone_click') return 'phoneClicks'
  return null
}

export function createMemoryPlaceStatsStore() {
  const byPlace = new Map()
  return {
    kind: 'memory',
    persistent: false,
    async record(restaurantId, event) {
      const col = columnForEvent(event)
      if (!col) return { ok: false, error: 'invalid-event' }
      if (!byPlace.has(restaurantId)) {
        byPlace.set(restaurantId, {
          restaurantId,
          profileViews: 0,
          routeClicks: 0,
          websiteClicks: 0,
          phoneClicks: 0,
        })
      }
      byPlace.get(restaurantId)[col] += 1
      return { ok: true, persistent: false }
    },
    async get(restaurantId) {
      return byPlace.get(restaurantId) || null
    },
  }
}

export function createSupabasePlaceStatsStore({ config, accessToken = '', fetchImpl = fetch }) {
  return {
    kind: 'supabase',
    persistent: true,
    async record(restaurantId, event) {
      const rpcEvent = normalizeEvent(event) === 'directions_click' ? 'directions_click' : normalizeEvent(event)
      const response = await fetchImpl(`${config.url}/rest/v1/rpc/record_place_stat`, {
        method: 'POST',
        headers: {
          ...supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          p_restaurant_id: restaurantId,
          p_event: rpcEvent === 'directions_click' ? 'directions_click' : rpcEvent,
        }),
      })
      const text = await response.text()
      let body = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = { raw: text.slice(0, 200) }
      }
      const msg = String(body?.message || body?.hint || '')
      if (response.status === 404 || /Could not find the function|PGRST202|schema cache/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) {
        return { ok: false, error: 'failed', status: response.status || 502, message: msg }
      }
      if (body === false) return { ok: false, error: 'invalid-event', status: 400 }
      return { ok: true, persistent: true }
    },
    async get(restaurantId) {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_stats_daily?restaurant_id=eq.${encodeURIComponent(restaurantId)}&select=profile_views,route_clicks,website_clicks,phone_clicks`,
        {
          headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
        },
      )
      const body = await response.json().catch(() => [])
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the table|PGRST205/i.test(msg)) {
        return { ok: false, error: 'not-ready' }
      }
      if (!response.ok) return { ok: false, error: 'forbidden', status: response.status }
      const rows = Array.isArray(body) ? body : []
      if (rows.length === 0) {
        return {
          ok: true,
          stats: {
            restaurantId,
            profileViews: 0,
            routeClicks: 0,
            websiteClicks: 0,
            phoneClicks: 0,
          },
        }
      }
      const stats = rows.reduce(
        (acc, row) => ({
          restaurantId,
          profileViews: acc.profileViews + Number(row.profile_views || 0),
          routeClicks: acc.routeClicks + Number(row.route_clicks || 0),
          websiteClicks: acc.websiteClicks + Number(row.website_clicks || 0),
          phoneClicks: acc.phoneClicks + Number(row.phone_clicks || 0),
        }),
        { restaurantId, profileViews: 0, routeClicks: 0, websiteClicks: 0, phoneClicks: 0 },
      )
      return { ok: true, stats }
    },
  }
}

async function profileIsAdmin(config, accessToken, fetchImpl, userId) {
  const response = await fetchImpl(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
    {
      headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
    },
  )
  if (!response.ok) return false
  const body = await response.json().catch(() => [])
  return Boolean(Array.isArray(body) && body[0]?.is_admin === true)
}

function storageUnavailable(message) {
  return json(
    {
      ok: false,
      stored: false,
      persistent: false,
      error: 'storage-unavailable',
      message: message || 'Statistiky teď neukládáme trvale.',
    },
    503,
  )
}

/** @deprecated paměťové API — ponecháno jen pro starší unit helpery; HTTP ho nepoužívá. */
export function recordPlaceStat(restaurantId, event, store = createMemoryPlaceStatsStore()) {
  const col = columnForEvent(event)
  if (!restaurantId || !col) return { ok: false, message: 'Neplatné ID nebo událost.' }
  return store.record(String(restaurantId).trim(), event)
}

export function getPlaceStats(restaurantId, store = null) {
  if (!store || store.kind !== 'memory') return null
  return null
}

export async function placeStatsHttp(request, { placeExists, isAdmin, store, env, fetchImpl } = {}) {
  const url = new URL(request.url)
  const runtimeEnv = env ?? process.env
  const config = authConfig(runtimeEnv)
  const http = fetchImpl || fetch
  const activeStore =
    store
    || (config.configured ? createSupabasePlaceStatsStore({ config, fetchImpl: http }) : null)

  if (url.pathname === '/api/place-stats/event' && request.method === 'POST') {
    if (rateLimited(clientIp(request))) {
      return json({ ok: false, stored: false, message: 'Too many events.' }, 429)
    }
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, stored: false, message: 'Neplatné JSON.' }, 400)
    }
    const restaurantId = String(body.restaurantId || '').trim()
    const event = String(body.event || '').trim()
    if (!columnForEvent(event)) {
      return json({ ok: false, stored: false, message: 'Neplatná událost.' }, 400)
    }
    if (typeof placeExists === 'function' && !placeExists(restaurantId)) {
      return json({ ok: false, stored: false, message: 'Podnik neexistuje.' }, 404)
    }
    if (!activeStore) {
      return storageUnavailable('Supabase není nastavené — statistiky se neuložily.')
    }
    const saved = await activeStore.record(restaurantId, event)
    if (!saved.ok) {
      if (saved.error === 'not-ready') {
        return storageUnavailable('Tabulka statistik ještě není nasazená.')
      }
      if (saved.error === 'invalid-event') {
        return json({ ok: false, stored: false, message: 'Neplatná událost.' }, 400)
      }
      return storageUnavailable(saved.message || 'Statistiku se nepodařilo uložit.')
    }
    // Úspěch jen když je zápis trvalý (Supabase). Paměťový store pro HTTP nepoužíváme.
    return json({ ok: true, stored: true, persistent: true })
  }

  if (url.pathname === '/api/place-stats' && request.method === 'GET') {
    if (!activeStore) return storageUnavailable()

    let adminOk = false
    let readStore = activeStore
    if (typeof isAdmin === 'function') {
      adminOk = Boolean(await isAdmin(request))
    } else if (config.configured) {
      const resolved = await resolveUser(request, config, http)
      if (!resolved.user?.id || !resolved.accessToken) {
        return json({ ok: false, message: 'Forbidden' }, 403)
      }
      adminOk = await profileIsAdmin(config, resolved.accessToken, http, resolved.user.id)
      readStore = createSupabasePlaceStatsStore({
        config,
        accessToken: resolved.accessToken,
        fetchImpl: http,
      })
    }
    if (!adminOk) return json({ ok: false, message: 'Forbidden' }, 403)

    const restaurantId = String(url.searchParams.get('restaurantId') || '').trim()
    if (!restaurantId) return json({ ok: false, message: 'Chybí restaurantId.' }, 400)
    const result = await readStore.get(restaurantId)
    if (!result || result.ok === false) {
      if (result?.error === 'not-ready') return storageUnavailable()
      return json({ ok: false, message: 'Not found' }, 404)
    }
    return json({ ok: true, persistent: true, stats: result.stats || result })
  }

  return json({ ok: false, message: 'Not found' }, 404)
}

export const PLACE_STATS_SQL = readFileSync(sqlPath, 'utf8')
