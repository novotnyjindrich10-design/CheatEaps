/** Rozbor odkazu z e-mailu. Supabase posílá tokeny v hash, v query, nebo PKCE code / token_hash. */

export const NEW_PASSWORD_PATH = '/nove-heslo'

function paramsFrom(href) {
  let url
  try {
    url = new URL(href, 'http://127.0.0.1')
  } catch {
    return null
  }
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const query = url.searchParams
  const read = (key) => hash.get(key) || query.get(key) || ''
  return { url, read, query, hash }
}

export function parseRecoveryLink(href) {
  const parsed = paramsFrom(href)
  if (!parsed) return { status: 'missing' }
  const { read } = parsed
  const errorCode = read('error_code')
  const error = read('error')
  if (error || errorCode) return { status: 'invalid', error: errorCode || error }

  const type = read('type')
  const accessToken = read('access_token')
  const refreshToken = read('refresh_token')
  const code = read('code')
  const tokenHash = read('token_hash')
  const flowId = read('sb_flow_id')

  if (type && type !== 'recovery' && !accessToken && !refreshToken && !code && !tokenHash) {
    return { status: 'invalid', error: type }
  }
  if (type && type !== 'recovery' && (accessToken || refreshToken || tokenHash)) {
    return { status: 'invalid', error: type }
  }

  if (accessToken && refreshToken) {
    return { status: 'ready', kind: 'tokens', accessToken, refreshToken, type: type || 'recovery' }
  }
  if (tokenHash && (!type || type === 'recovery')) {
    return { status: 'ready', kind: 'token_hash', tokenHash, type: type || 'recovery' }
  }
  if (code) {
    return { status: 'ready', kind: 'code', code, flowId: flowId || '', type: type || 'recovery' }
  }
  return { status: 'missing' }
}

export function hasRecoveryCallback(href) {
  const recovery = parseRecoveryLink(href)
  return recovery.status === 'ready' || recovery.status === 'invalid'
}

export function recoveryCallbackTarget(href) {
  const parsed = paramsFrom(href)
  if (!parsed) return NEW_PASSWORD_PATH
  const { url } = parsed
  return `${NEW_PASSWORD_PATH}${url.search}${url.hash}`
}

export function recoveryCallbackLocation(href) {
  const parsed = paramsFrom(href)
  if (!parsed) return { pathname: NEW_PASSWORD_PATH }
  return {
    pathname: NEW_PASSWORD_PATH,
    search: parsed.url.search,
    hash: parsed.url.hash,
  }
}

export function stripRecoveryParams(href) {
  const parsed = paramsFrom(href)
  if (!parsed) return '/'
  const { url } = parsed
  for (const key of [
    'error',
    'error_code',
    'error_description',
    'code',
    'sb_flow_id',
    'token_hash',
    'type',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'provider_token',
    'provider_refresh_token',
  ]) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  return `${url.pathname}${url.search}`
}

export function recoveryFailureMessage(status, detail = '') {
  if (status === 'ready') return ''
  if (status === 'loading') return ''
  const blob = `${status} ${detail}`.toLowerCase()
  if (blob.includes('pkce') || blob.includes('verifier') || blob.includes('code verifier')) {
    return 'Obnovovací kód z e-mailu se nepodařilo ověřit. Pošli si nový odkaz a otevři ho v tomhle prohlížeči.'
  }
  if (status === 'invalid' || blob.includes('expired') || blob.includes('otp') || blob.includes('invalid')) {
    return 'Odkaz je neplatný, vypršel, nebo už byl použitý. Pošli si nový.'
  }
  return 'Chybí platná relace z e-mailu. Otevři odkaz znovu, nebo si pošli nový.'
}

export function recoveryPrepareBody(recovery) {
  if (!recovery || recovery.status !== 'ready') return null
  if (recovery.kind === 'tokens') {
    return { accessToken: recovery.accessToken, refreshToken: recovery.refreshToken }
  }
  if (recovery.kind === 'token_hash') {
    return { tokenHash: recovery.tokenHash, type: recovery.type || 'recovery' }
  }
  if (recovery.kind === 'code') {
    return { code: recovery.code, flowId: recovery.flowId || '' }
  }
  return null
}
