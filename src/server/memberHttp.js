import { allDealRows, publicDealById } from '../data/restaurantDeals.js'
import { DEAL_PRIVATE } from './dealPrivate.js'
import {
  allowAttempt,
  allowRecoverAttempt,
  authConfig,
  clearSessionCookies,
  clientKey,
  mapAuthError,
  mapRecoveryError,
  passwordResetRedirect,
  prepareRecoverySession,
  requestIsSecure,
  resolveUser,
  revokeSession,
  sendPasswordReset,
  sessionCookies,
  signInWithPassword,
  signUpWithPassword,
  tokensFromBody,
  updateUserPassword,
  validateCredentials,
  validateEmail,
  validatePassword,
  readCookie,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  PKCE_COOKIE,
  clearPkceCookie,
} from './supabaseAuth.js'

function json(body, status = 200, cookies = []) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

async function readBody(request) {
  const text = await request.text()
  if (text.length > 10_000) return { ok: false, message: 'Požadavek je moc velký.' }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, message: 'Požadavek nemá platné JSON.' }
  }
}

function notConfigured() {
  return json(
    {
      ok: false,
      configured: false,
      authenticated: false,
      error: 'auth-not-configured',
      message: 'Přihlášení ještě není zapnuté. Chybí SUPABASE_URL nebo SUPABASE_ANON_KEY na serveru.',
    },
    503,
  )
}

export async function authActionHttp(action, request, deps = {}) {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const config = authConfig(env)
  const secure = requestIsSecure(request)

  if (request.method === 'GET' && action === 'session') {
    if (!config.configured) {
      return json({ ok: true, configured: false, authenticated: false })
    }
    const resolved = await resolveUser(request, config, fetchImpl)
    if (!resolved.user) return json({ ok: true, configured: true, authenticated: false })
    return json(
      { ok: true, configured: true, authenticated: true, email: resolved.user.email },
      200,
      resolved.cookies,
    )
  }

  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere jen POST.' }, 405)
  if (!config.configured) return notConfigured()

  if (action === 'logout') {
    const access = readCookie(request.headers.get('cookie'), ACCESS_COOKIE)
    if (access) await revokeSession(config, access, fetchImpl)
    return json({ ok: true, authenticated: false }, 200, clearSessionCookies(secure))
  }

  if (action === 'recover') {
    if (!allowRecoverAttempt(clientKey(request))) {
      return json({ ok: false, sent: false, error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }, 429)
    }
    const payload = await readBody(request)
    if (!payload.ok) return json({ ok: false, sent: false, message: payload.message }, 400)
    const email = validateEmail(payload.value?.email)
    if (!email.ok) return json({ ok: false, sent: false, error: email.error, message: email.message }, 400)
    const redirectTo = passwordResetRedirect(request)
    if (!redirectTo) {
      return json(
        {
          ok: false,
          sent: false,
          error: 'redirect-not-allowed',
          message:
            'Návratovou adresu se nepodařilo sestavit. Obnov stránku a zkus to znovu, nebo v Supabase doplň Redirect URLs pro /nove-heslo.',
        },
        400,
      )
    }
    const sent = await sendPasswordReset(config, email.email, redirectTo, deps)
    if (!sent.ok) {
      const mapped = mapRecoveryError(sent.body)
      return json({ ok: false, sent: false, ...mapped }, sent.status || 400)
    }
    return json({
      ok: true,
      sent: true,
      redirectTo,
      message: 'Pokud k tomuto e-mailu účet patří, poslali jsme odkaz na nové heslo.',
    })
  }

  if (action === 'prepare-recovery') {
    if (!allowRecoverAttempt(clientKey(request))) {
      return json({ ok: false, ready: false, error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }, 429)
    }
    const payload = await readBody(request)
    if (!payload.ok) return json({ ok: false, ready: false, message: payload.message }, 400)
    const prepared = await prepareRecoverySession(
      config,
      {
        accessToken: typeof payload.value?.accessToken === 'string' ? payload.value.accessToken : '',
        refreshToken: typeof payload.value?.refreshToken === 'string' ? payload.value.refreshToken : '',
        code: typeof payload.value?.code === 'string' ? payload.value.code : '',
        tokenHash: typeof payload.value?.tokenHash === 'string' ? payload.value.tokenHash : '',
        type: typeof payload.value?.type === 'string' ? payload.value.type : 'recovery',
        codeVerifier: readCookie(request.headers.get('cookie'), PKCE_COOKIE),
      },
      deps.authClient,
      deps.fetchImpl,
    )
    if (!prepared.ok) {
      const mapped = mapRecoveryError(prepared.body)
      return json({ ok: false, ready: false, ...mapped }, prepared.status || 400, [clearPkceCookie(secure)])
    }
    return json(
      { ok: true, ready: true, message: 'Odkaz je platný. Zvol si nové heslo.' },
      200,
      [...sessionCookies(prepared.tokens, secure), clearPkceCookie(secure)],
    )
  }

  if (action === 'update-password') {
    if (!allowAttempt(clientKey(request))) {
      return json({ ok: false, passwordUpdated: false, error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }, 429)
    }
    const payload = await readBody(request)
    if (!payload.ok) return json({ ok: false, passwordUpdated: false, message: payload.message }, 400)
    const password = validatePassword(payload.value?.password)
    if (!password.ok) {
      return json({ ok: false, passwordUpdated: false, error: password.error, message: password.message }, 400)
    }
    const cookieHeader = request.headers.get('cookie')
    const accessToken =
      (typeof payload.value?.accessToken === 'string' && payload.value.accessToken) ||
      readCookie(cookieHeader, ACCESS_COOKIE)
    const refreshToken =
      (typeof payload.value?.refreshToken === 'string' && payload.value.refreshToken) ||
      readCookie(cookieHeader, REFRESH_COOKIE)
    const code = typeof payload.value?.code === 'string' ? payload.value.code : ''
    const tokenHash = typeof payload.value?.tokenHash === 'string' ? payload.value.tokenHash : ''
    if (!accessToken && !refreshToken && !code && !tokenHash) {
      return json(
        {
          ok: false,
          passwordUpdated: false,
          error: 'link-expired',
          message: 'Odkaz je neplatný, vypršel, nebo už byl použitý. Pošli si nový.',
        },
        401,
      )
    }
    const updated = await updateUserPassword(
      config,
      {
        accessToken,
        refreshToken,
        code,
        tokenHash,
        type: typeof payload.value?.type === 'string' ? payload.value.type : 'recovery',
        codeVerifier: readCookie(cookieHeader, PKCE_COOKIE),
        password: password.password,
      },
      deps.authClient,
      deps.fetchImpl,
    )
    if (!updated.ok) {
      const mapped = mapRecoveryError(updated.body)
      return json({ ok: false, passwordUpdated: false, ...mapped }, updated.status || 400, [clearPkceCookie(secure)])
    }
    return json(
      {
        ok: true,
        passwordUpdated: true,
        authenticated: true,
        email: updated.email,
        message: 'Heslo je změněné.',
      },
      200,
      [...sessionCookies(updated.tokens, secure), clearPkceCookie(secure)],
    )
  }

  if (action !== 'login' && action !== 'signup') {
    return json({ ok: false, message: 'Neznámá akce.' }, 404)
  }

  if (!allowAttempt(clientKey(request))) {
    return json({ ok: false, error: 'rate-limited', message: 'Moc pokusů. Zkus to za chvíli.' }, 429)
  }

  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400)
  const credentials = validateCredentials(payload.value?.email, payload.value?.password)
  if (!credentials.ok) return json({ ok: false, error: credentials.error, message: credentials.message }, 400)

  if (action === 'login') {
    const result = await signInWithPassword(config, credentials.email, credentials.password, fetchImpl)
    const tokens = result.ok ? tokensFromBody(result.body) : null
    if (!tokens) {
      const mapped = mapAuthError(result.body)
      return json({ ok: false, ...mapped }, 401)
    }
    return json(
      { ok: true, configured: true, authenticated: true, email: credentials.email },
      200,
      sessionCookies(tokens, secure),
    )
  }

  const created = await signUpWithPassword(config, credentials.email, credentials.password, fetchImpl)
  if (!created.ok) {
    const mapped = mapAuthError(created.body)
    return json({ ok: false, ...mapped }, 400)
  }
  const tokens = tokensFromBody(created.body)
  if (!tokens) {
    return json({
      ok: true,
      configured: true,
      authenticated: false,
      needsConfirmation: true,
      message: 'Účet je založený. Potvrď odkaz v e-mailu a pak se přihlas.',
    })
  }
  return json(
    { ok: true, configured: true, authenticated: true, email: credentials.email },
    200,
    sessionCookies(tokens, secure),
  )
}

export async function dealDetailHttp(request, deps = {}) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const now = deps.now ?? new Date()
  const config = authConfig(env)
  if (!config.configured) return notConfigured()

  const resolved = await resolveUser(request, config, fetchImpl)
  if (!resolved.user) {
    return json({ ok: false, authenticated: false, error: 'auth-required', message: 'Nejdřív se přihlas.' }, 401)
  }

  const id = new URL(request.url).searchParams.get('id') ?? ''
  const known = allDealRows().find((item) => item.id === id) ?? null
  const deal = publicDealById(id, now)
  if (!deal) {
    const ended = Boolean(known)
    return json(
      {
        ok: false,
        error: ended ? 'deal-expired' : 'deal-unavailable',
        message: ended
          ? 'Tahle nabídka už není aktivní. Kód ani postup se nezobrazují.'
          : 'Nabídka v katalogu není.',
      },
      ended ? 410 : 404,
      resolved.cookies,
    )
  }
  const detail = DEAL_PRIVATE[deal.offerId]
  if (!detail?.sourceUrl) {
    return json({ ok: false, error: 'deal-unavailable', message: 'K téhle nabídce nemáme postup.' }, 404, resolved.cookies)
  }

  return json(
    {
      ok: true,
      authenticated: true,
      id: deal.id,
      restaurantId: deal.restaurantId,
      headline: deal.headline,
      code: detail.code || '',
      conditions: detail.conditions,
      steps: detail.steps,
      sourceUrl: detail.sourceUrl,
      validFrom: deal.validFrom,
      validUntil: deal.validUntil,
      verification: deal.verification,
      validityFullyVerified: deal.verification === 'verified' && Boolean(deal.validFrom && deal.validUntil),
      studentOnly: deal.studentOnly,
      requiresLoyaltyApp: deal.requiresLoyaltyApp,
      checkedAt: deal.checkedAt,
    },
    200,
    resolved.cookies,
  )
}
