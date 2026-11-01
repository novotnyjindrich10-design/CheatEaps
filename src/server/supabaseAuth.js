/**
 * Přihlášení přes Supabase Auth. Klíče čte jen server z prostředí.
 * Do prohlížeče jde jen httpOnly cookie, ne anon key.
 */
import { createClient } from '@supabase/supabase-js'

export const NEW_PASSWORD_PATH = '/nove-heslo'

const ACCESS_COOKIE = 'ce_access'
const REFRESH_COOKIE = 'ce_refresh'
const PKCE_COOKIE = 'ce_pkce'
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const RECOVER_MAX_ATTEMPTS = 12
const attempts = new Map()
const recoverAttempts = new Map()

export function resetAuthLimits() {
  attempts.clear()
  recoverAttempts.clear()
}

export function readCookie(header, name) {
  const source = Array.isArray(header) ? header.join(';') : String(header ?? '')
  for (const part of source.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(eq + 1))
    } catch {
      return ''
    }
  }
  return ''
}

export function authConfig(env = process.env) {
  const raw = String(env.SUPABASE_URL ?? '').trim()
  const anonKey = String(env.SUPABASE_ANON_KEY ?? '').trim()
  let parsed = null
  try {
    parsed = raw ? new URL(raw) : null
  } catch {
    parsed = null
  }
  if (parsed) {
    const path = parsed.pathname.replace(/\/(rest|auth)\/v1\/?$/i, '').replace(/\/$/, '')
    parsed.pathname = path || '/'
    parsed.search = ''
    parsed.hash = ''
  }
  const url = parsed ? `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}` : ''
  const configured = Boolean(
    parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname && anonKey,
  )
  return { url, anonKey, configured }
}

function cookie(name, value, maxAge, secure) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function sessionCookies(tokens, secure) {
  const accessAge = Number(tokens.expires_in)
  const access = cookie(
    ACCESS_COOKIE,
    tokens.access_token,
    Number.isFinite(accessAge) && accessAge > 0 ? Math.floor(accessAge) : 3600,
    secure,
  )
  const refresh = cookie(REFRESH_COOKIE, tokens.refresh_token, 60 * 60 * 24 * 30, secure)
  return [access, refresh]
}

export function clearSessionCookies(secure) {
  return [cookie(ACCESS_COOKIE, '', 0, secure), cookie(REFRESH_COOKIE, '', 0, secure)]
}

export function requestIsSecure(request) {
  const forwarded = request.headers.get('x-forwarded-proto')
  if (forwarded) return forwarded.split(',')[0].trim() === 'https'
  return new URL(request.url).protocol === 'https:'
}

function allowInWindow(store, key, max) {
  const now = Date.now()
  const prev = (store.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  if (prev.length >= max) {
    store.set(key, prev)
    return false
  }
  prev.push(now)
  store.set(key, prev)
  return true
}

function allowAttempt(key) {
  return allowInWindow(attempts, key, MAX_ATTEMPTS)
}

function allowRecoverAttempt(key) {
  return allowInWindow(recoverAttempts, key, RECOVER_MAX_ATTEMPTS)
}

export function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'local'
  return ip.slice(0, 80)
}

async function authFetch(config, path, options, fetchImpl) {
  const headers = new Headers(options.headers)
  headers.set('apikey', config.anonKey)
  headers.set('content-type', 'application/json')
  return fetchImpl(`${config.url}${path}`, { ...options, headers })
}

export async function signInWithPassword(config, email, password, fetchImpl) {
  const response = await authFetch(
    config,
    '/auth/v1/token?grant_type=password',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    fetchImpl,
  )
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export async function signUpWithPassword(config, email, password, fetchImpl) {
  const response = await authFetch(
    config,
    '/auth/v1/signup',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    fetchImpl,
  )
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export async function fetchAuthUser(config, accessToken, fetchImpl) {
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${accessToken}` },
  })
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export async function refreshSession(config, refreshToken, fetchImpl) {
  const response = await authFetch(
    config,
    '/auth/v1/token?grant_type=refresh_token',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    fetchImpl,
  )
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export async function revokeSession(config, accessToken, fetchImpl) {
  await fetchImpl(`${config.url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: config.anonKey, authorization: `Bearer ${accessToken}` },
  }).catch(() => null)
}

export function tokensFromBody(body) {
  const access = body?.access_token || body?.session?.access_token || ''
  const refresh = body?.refresh_token || body?.session?.refresh_token || ''
  if (!access || !refresh) return null
  return { access_token: access, refresh_token: refresh, expires_in: body.expires_in ?? body.session?.expires_in }
}

function requestOrigin(request) {
  const origin = request.headers.get('origin')
  if (origin) return origin
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      /* ignore */
    }
  }
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .split(',')[0]
    .trim()
  if (!host) return null
  const forwarded = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim()
  const localHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const protocol = forwarded || (localHost ? 'http' : 'https')
  return `${protocol}://${host}`
}

export function passwordResetRedirect(request) {
  const origin = requestOrigin(request)
  if (!origin) return null
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const hostname = hostHeader.split(',')[0].trim().split(':')[0]
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  // Cizí Origin musí sedět s Host. Chybějící Host u nelokální adresy odmítni.
  if (!local && (!hostname || parsed.hostname !== hostname)) return null
  return `${parsed.origin}${NEW_PASSWORD_PATH}`
}

export function createAuthClient(config) {
  return createClient(config.url, config.anonKey, {
    auth: {
      // Implicit: odkaz z e-mailu funguje i v jiném prohlížeči/zařízení než žádost o reset.
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function sessionFromAuth(data, fallback = {}) {
  const session = data?.session || fallback.session || null
  const access = session?.access_token || fallback.access_token || ''
  const refresh = session?.refresh_token || fallback.refresh_token || ''
  if (!access || !refresh) return null
  return {
    email: data?.user?.email || session?.user?.email || fallback.email || '',
    tokens: {
      access_token: access,
      refresh_token: refresh,
      expires_in: session?.expires_in || fallback.expires_in || 3600,
    },
  }
}

function authFailure(error, fallbackStatus = 400) {
  return {
    ok: false,
    status: error?.status || fallbackStatus,
    body: { message: error?.message || 'Obnovení hesla se nepovedlo.', error_code: error?.code || error?.name || '' },
  }
}

export async function sendPasswordReset(config, email, redirectTo, deps = {}) {
  const createClientImpl = deps.authClient
  const fetchImpl = deps.fetchImpl ?? fetch

  // Testy mohou dodat fake authClient. Ostrý provoz volá GoTrue přímo, ať je HTTP chyba vidět.
  if (typeof createClientImpl === 'function') {
    try {
      const supabase = createClientImpl(config)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) return authFailure(error)
      return { ok: true }
    } catch {
      return { ok: false, status: 502, body: { message: 'E-mail s odkazem se neposlal.' } }
    }
  }

  try {
    const response = await authFetch(
      config,
      `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: 'POST', body: JSON.stringify({ email }) },
      fetchImpl,
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: {
          message: body.msg || body.message || body.error_description || 'E-mail s odkazem se neposlal.',
          error_code: body.error_code || body.error || body.code || '',
        },
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, status: 502, body: { message: 'E-mail s odkazem se neposlal.' } }
  }
}

async function exchangeRecoveryCode(config, code, codeVerifier, fetchImpl = fetch) {
  if (!code || !codeVerifier) {
    return authFailure({ message: 'missing code verifier', code: 'pkce_verifier_missing', status: 401 }, 401)
  }
  const verifier = String(codeVerifier).split('/')[0]
  const response = await authFetch(
    config,
    '/auth/v1/token?grant_type=pkce',
    { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }) },
    fetchImpl,
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, status: response.status, body }
  const tokens = tokensFromBody(body)
  if (!tokens) return authFailure({ message: 'invalid grant', code: 'invalid_grant', status: 401 }, 401)
  return {
    ok: true,
    email: body.user?.email || body.email || '',
    tokens,
  }
}

export async function prepareRecoverySession(
  config,
  { accessToken, refreshToken, code, tokenHash, type, codeVerifier } = {},
  createClientImpl = createAuthClient,
  fetchImpl = fetch,
) {
  try {
    if (accessToken && refreshToken) {
      const supabase = createClientImpl(config)
      const established = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (established.error) return authFailure(established.error, 401)
      const session = sessionFromAuth(established.data, {
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (!session) return authFailure({ message: 'invalid grant', code: 'invalid_grant', status: 401 }, 401)
      return { ok: true, ...session }
    }

    if (tokenHash) {
      const supabase = createClientImpl(config)
      const verified = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === 'recovery' || !type ? 'recovery' : type,
      })
      if (verified.error) return authFailure(verified.error, 401)
      const session = sessionFromAuth(verified.data)
      if (!session) return authFailure({ message: 'invalid grant', code: 'invalid_grant', status: 401 }, 401)
      return { ok: true, ...session }
    }

    if (code) {
      return exchangeRecoveryCode(config, code, codeVerifier, fetchImpl)
    }

    return authFailure({ message: 'missing recovery session', code: 'otp_expired', status: 401 }, 401)
  } catch {
    return { ok: false, status: 502, body: { message: 'Obnovovací odkaz se nepodařilo ověřit.' } }
  }
}

export async function updateUserPassword(
  config,
  { accessToken, refreshToken, password, code, tokenHash, type, codeVerifier } = {},
  createClientImpl = createAuthClient,
  fetchImpl = fetch,
) {
  try {
    const prepared = await prepareRecoverySession(
      config,
      { accessToken, refreshToken, code, tokenHash, type, codeVerifier },
      createClientImpl,
      fetchImpl,
    )
    if (!prepared.ok) return prepared

    const supabase = createClientImpl(config)
    const established = await supabase.auth.setSession({
      access_token: prepared.tokens.access_token,
      refresh_token: prepared.tokens.refresh_token,
    })
    if (established.error) return authFailure(established.error, 401)

    const updated = await supabase.auth.updateUser({ password })
    if (updated.error) return authFailure(updated.error)

    const session = sessionFromAuth(updated.data, prepared.tokens)
    return {
      ok: true,
      email: updated.data?.user?.email || prepared.email || session?.email || '',
      tokens: session?.tokens || prepared.tokens,
    }
  } catch {
    return { ok: false, status: 502, body: { message: 'Heslo se nepodařilo změnit.' } }
  }
}

export function clearPkceCookie(secure) {
  return cookie(PKCE_COOKIE, '', 0, secure)
}

export function mapRecoveryError(body) {
  const code = String(body?.error_code || body?.error || body?.msg || body?.message || '').toLowerCase()
  const detail = String(body?.message || body?.msg || body?.error_description || '').toLowerCase()
  const blob = `${code} ${detail}`
  if (blob.includes('pkce') || blob.includes('verifier')) {
    return {
      error: 'link-expired',
      message: 'Obnovovací kód z e-mailu se nepodařilo ověřit. Pošli si nový odkaz a otevři ho znovu.',
    }
  }
  if (
    blob.includes('otp_expired') ||
    blob.includes('expired') ||
    blob.includes('flow_state') ||
    (blob.includes('invalid') && (blob.includes('token') || blob.includes('grant') || blob.includes('jwt') || blob.includes('otp')))
  ) {
    return { error: 'link-expired', message: 'Odkaz je neplatný, vypršel, nebo už byl použitý. Pošli si nový.' }
  }
  if (blob.includes('redirect') || blob.includes('not allowed')) {
    return {
      error: 'redirect-not-allowed',
      message: 'Návratová adresa není v Supabase povolená. Doplň ji v Redirect URLs.',
    }
  }
  if (blob.includes('rate') || blob.includes('too many')) {
    return { error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }
  }
  if (blob.includes('weak') || (blob.includes('password') && blob.includes('character'))) {
    return { error: 'weak-password', message: 'Heslo musí mít 8 až 72 znaků.' }
  }
  return { error: 'reset-failed', message: 'Požadavek na heslo se nepovedl.' }
}

export function mapAuthError(body) {
  const code = String(body?.error_code || body?.error || body?.msg || body?.message || '').toLowerCase()
  if (code.includes('email_not_confirmed') || code.includes('not confirmed')) {
    return { error: 'email-not-confirmed', message: 'Nejdřív potvrď e-mail, potom se přihlas.' }
  }
  if (code.includes('already') || code.includes('registered') || code.includes('exists')) {
    return { error: 'account-exists', message: 'Účet s tímto e-mailem už existuje. Přihlas se.' }
  }
  if (code.includes('weak') || code.includes('password')) {
    return { error: 'weak-password', message: 'Heslo musí mít aspoň 8 znaků.' }
  }
  if (code.includes('rate') || code.includes('too many')) {
    return { error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }
  }
  return { error: 'invalid-credentials', message: 'E-mail nebo heslo nesedí.' }
}

export function validateEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'invalid-email', message: 'Zadej platný e-mail.' }
  }
  return { ok: true, email: normalized }
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return { ok: false, error: 'weak-password', message: 'Heslo musí mít 8 až 72 znaků.' }
  }
  return { ok: true, password }
}

export function validateCredentials(email, password) {
  const emailResult = validateEmail(email)
  if (!emailResult.ok) return emailResult
  const passwordResult = validatePassword(password)
  if (!passwordResult.ok) return passwordResult
  return { ok: true, email: emailResult.email, password: passwordResult.password }
}

export async function resolveUser(request, config, fetchImpl) {
  const access = readCookie(request.headers.get('cookie'), ACCESS_COOKIE)
  if (access) {
    const user = await fetchAuthUser(config, access, fetchImpl)
    if (user.ok && user.body?.email) return { user: user.body, accessToken: access, cookies: [] }
  }
  const refresh = readCookie(request.headers.get('cookie'), REFRESH_COOKIE)
  if (!refresh) return { user: null, accessToken: '', cookies: [] }
  const next = await refreshSession(config, refresh, fetchImpl)
  const tokens = next.ok ? tokensFromBody(next.body) : null
  if (!tokens) return { user: null, accessToken: '', cookies: [] }
  const user = await fetchAuthUser(config, tokens.access_token, fetchImpl)
  if (!user.ok || !user.body?.email) return { user: null, accessToken: '', cookies: [] }
  return {
    user: user.body,
    accessToken: tokens.access_token,
    cookies: sessionCookies(tokens, requestIsSecure(request)),
  }
}

export { ACCESS_COOKIE, REFRESH_COOKIE, PKCE_COOKIE, allowAttempt, allowRecoverAttempt }
