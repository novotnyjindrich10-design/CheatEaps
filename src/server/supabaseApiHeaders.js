/**
 * Hlavičky pro Supabase REST / Auth gateway.
 *
 * Nové klíče `sb_publishable_` / `sb_secret_` nejsou JWT — oficiálně patří jen do `apikey`.
 * Legacy `anon` / `service_role` (JWT `eyJ…`) zůstávají v `apikey` i `Authorization: Bearer`
 * kvůli kompatibilitě, dokud je Dashboard nevyřadí.
 * Uživatelský access token vždy patří do `Authorization: Bearer`.
 *
 * @see https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
 */

export function isNewSupabaseApiKey(key) {
  const value = String(key || '')
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')
}

export function isLegacyJwtApiKey(key) {
  return String(key || '').startsWith('eyJ')
}

/**
 * @param {{ apiKey?: string, accessToken?: string }} [options]
 * @returns {Record<string, string>}
 */
export function supabaseApiHeaders({ apiKey = '', accessToken = '' } = {}) {
  const key = String(apiKey || '').trim()
  const userJwt = String(accessToken || '').trim()
  const headers = {
    apikey: key,
    Accept: 'application/json',
  }

  if (userJwt && userJwt !== key) {
    headers.Authorization = `Bearer ${userJwt}`
    return headers
  }

  // Legacy JWT klíče a testovací stuby: zachovat starý pattern Bearer = api key.
  // Nové sb_* klíče do Authorization nedávej — platforma je jako JWT neumí ověřit.
  if (key && !isNewSupabaseApiKey(key)) {
    headers.Authorization = `Bearer ${key}`
  }

  return headers
}
