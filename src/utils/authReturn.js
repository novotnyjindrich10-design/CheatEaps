import { safeInternalPath } from './internalPath.js'

export function dealPath(dealId) {
  return safeInternalPath(`/nabidka/${encodeURIComponent(dealId)}`, '/results')
}

export function loginPath(next, mode = 'login') {
  const safe = safeInternalPath(next, '/results')
  const base = mode === 'signup' ? '/registrace' : '/prihlaseni'
  return `${base}?next=${encodeURIComponent(safe)}`
}

export function postLoginTarget(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '')
  return safeInternalPath(params.get('next'), '/results')
}

const RESET_NEXT_KEY = 'cheapeats-reset-next'

export function rememberResetNext(path, storage) {
  if (!storage || typeof storage.setItem !== 'function') return
  storage.setItem(RESET_NEXT_KEY, safeInternalPath(path, '/results'))
}

export function takeResetNext(storage) {
  if (!storage || typeof storage.getItem !== 'function') return '/results'
  return safeInternalPath(storage.getItem(RESET_NEXT_KEY), '/results')
}
