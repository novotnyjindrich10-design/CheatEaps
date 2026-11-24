/**
 * Přepisy katalogu: skrytí a úprava jména/adresy/kategorie.
 * Veřejný GET vrací data bez admin_note. Zápis jen pro administrátora.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePlaceOverride, validatePlaceOverrideInput } from '../utils/placeOverrides.js'
import { authConfig, resolveUser } from './supabaseAuth.js'
import { supabaseApiHeaders } from './supabaseApiHeaders.js'

const sqlPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../supabase/place-overrides.sql')

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
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

export function createMemoryPlaceOverrideStore() {
  const rows = new Map()
  return {
    kind: 'memory',
    async listPublic() {
      return {
        ok: true,
        overrides: [...rows.values()].map((row) => ({
          placeId: row.placeId,
          hidden: row.hidden,
          name: row.name,
          address: row.address,
          category: row.category,
          updatedAt: row.updatedAt,
        })),
      }
    },
    async listAdmin() {
      return { ok: true, overrides: [...rows.values()].map((row) => ({ ...row })) }
    },
    async upsert(override, userId = null) {
      const next = {
        ...override,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      }
      rows.set(override.placeId, next)
      return { ok: true, override: next }
    },
    async remove(placeId) {
      rows.delete(placeId)
      return { ok: true }
    },
  }
}

export function createSupabasePlaceOverrideStore({ config, accessToken = '', fetchImpl = fetch }) {
  return {
    kind: 'supabase',
    async listPublic() {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_overrides_public?select=place_id,hidden,name,address,category,updated_at&order=updated_at.desc&limit=2000`,
        {
          headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
        },
      )
      const body = await response.json().catch(() => ({}))
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the|PGRST205|PGRST202/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) return { ok: false, error: 'failed', status: response.status }
      return {
        ok: true,
        overrides: (Array.isArray(body) ? body : []).map((row) => normalizePlaceOverride(row)).filter(Boolean),
      }
    },
    async listAdmin() {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_overrides?select=place_id,hidden,name,address,category,admin_note,updated_at,updated_by&order=updated_at.desc&limit=2000`,
        {
          headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
        },
      )
      const body = await response.json().catch(() => ({}))
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the|PGRST205/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) return { ok: false, error: 'failed', status: response.status }
      return {
        ok: true,
        overrides: (Array.isArray(body) ? body : []).map((row) => normalizePlaceOverride(row)).filter(Boolean),
      }
    },
    async upsert(override, userId = null) {
      const payload = {
        place_id: override.placeId,
        hidden: override.hidden === true,
        name: override.name,
        address: override.address,
        category: override.category,
        admin_note: override.adminNote,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      }
      const response = await fetchImpl(`${config.url}/rest/v1/place_overrides`, {
        method: 'POST',
        headers: {
          ...supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
          'content-type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the|PGRST205/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) {
        return { ok: false, error: 'failed', status: response.status, message: 'Přepis se nepodařilo uložit.' }
      }
      const row = Array.isArray(body) ? body[0] : body
      return { ok: true, override: normalizePlaceOverride(row) }
    },
    async remove(placeId) {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_overrides?place_id=eq.${encodeURIComponent(placeId)}`,
        {
          method: 'DELETE',
          headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
        },
      )
      if (response.status === 404) return { ok: false, error: 'not-ready', status: 503 }
      if (!response.ok) return { ok: false, error: 'failed', status: response.status }
      return { ok: true }
    },
  }
}

export async function placeOverridesHttp(request, { store, env, fetchImpl, isAdmin, placeExists } = {}) {
  const url = new URL(request.url)
  if (url.pathname !== '/api/place-overrides' && url.pathname !== '/api/admin/place-overrides') {
    return json({ ok: false, message: 'Not found' }, 404)
  }

  const runtimeEnv = env ?? process.env
  const config = authConfig(runtimeEnv)
  const http = fetchImpl || fetch
  const adminPath = url.pathname === '/api/admin/place-overrides'

  let activeStore = store
  let accessToken = ''
  let userId = null
  let adminOk = false

  if (!activeStore && config.configured) {
    if (adminPath) {
      const resolved = await resolveUser(request, config, http)
      if (!resolved.user?.id || !resolved.accessToken) {
        return json({ ok: false, message: 'Forbidden' }, 403)
      }
      accessToken = resolved.accessToken
      userId = resolved.user.id
      adminOk =
        typeof isAdmin === 'function'
          ? Boolean(await isAdmin(request))
          : await profileIsAdmin(config, accessToken, http, userId)
      if (!adminOk) return json({ ok: false, message: 'Forbidden' }, 403)
      activeStore = createSupabasePlaceOverrideStore({ config, accessToken, fetchImpl: http })
    } else {
      activeStore = createSupabasePlaceOverrideStore({ config, fetchImpl: http })
    }
  }

  if (adminPath && typeof isAdmin === 'function' && store) {
    adminOk = Boolean(await isAdmin(request))
    if (!adminOk) return json({ ok: false, message: 'Forbidden' }, 403)
  }

  if (!activeStore) {
    if (request.method === 'GET' && !adminPath) {
      return json({ ok: true, overrides: [], configured: false })
    }
    return json(
      {
        ok: false,
        error: 'storage-unavailable',
        message: 'Přepisy katalogu nejsou nastavené. Spusť supabase/place-overrides.sql.',
      },
      503,
    )
  }

  if (request.method === 'GET') {
    const listed = adminPath ? await activeStore.listAdmin() : await activeStore.listPublic()
    if (!listed.ok) {
      // Veřejný katalog musí přežít chybějící SQL — stejně jako /api/sponsorships.
      if (!adminPath && listed.error === 'not-ready') {
        return json({ ok: true, overrides: [], configured: false })
      }
      if (listed.error === 'not-ready') {
        return json(
          {
            ok: false,
            error: 'not-ready',
            message: 'Tabulka přepisů ještě není nasazená.',
          },
          503,
        )
      }
      return json({ ok: false, message: 'Přepisy se nepodařilo načíst.' }, listed.status || 502)
    }
    return json({ ok: true, overrides: listed.overrides, configured: true })
  }

  if (!adminPath) {
    return json({ ok: false, message: 'Method not allowed' }, 405)
  }

  if (request.method === 'DELETE') {
    const placeId = String(url.searchParams.get('placeId') || '').trim()
    if (!placeId) return json({ ok: false, message: 'Chybí placeId.' }, 400)
    const removed = await activeStore.remove(placeId)
    if (!removed.ok) {
      if (removed.error === 'not-ready') {
        return json({ ok: false, error: 'not-ready', message: 'Tabulka přepisů ještě není nasazená.' }, 503)
      }
      return json({ ok: false, message: 'Přepis se nepodařilo smazat.' }, removed.status || 502)
    }
    return json({ ok: true, removed: true, placeId })
  }

  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
    return json({ ok: false, message: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, message: 'Neplatné JSON tělo.' }, 400)
  }

  const validated = validatePlaceOverrideInput(body)
  if (!validated.ok) return json({ ok: false, message: validated.message }, 400)
  if (typeof placeExists === 'function' && !placeExists(validated.override.placeId)) {
    return json({ ok: false, message: 'Podnik v katalogu není.' }, 404)
  }

  const saved = await activeStore.upsert(validated.override, userId)
  if (!saved.ok) {
    if (saved.error === 'not-ready') {
      return json({ ok: false, error: 'not-ready', message: 'Tabulka přepisů ještě není nasazená.' }, 503)
    }
    return json({ ok: false, message: saved.message || 'Přepis se nepodařilo uložit.' }, saved.status || 502)
  }
  return json({ ok: true, override: saved.override })
}

export const PLACE_OVERRIDES_SQL = readFileSync(sqlPath, 'utf8')
