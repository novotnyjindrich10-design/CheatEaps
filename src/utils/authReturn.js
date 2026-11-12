import { safeInternalPath } from './internalPath.js'

/** Veřejná cesta na filtr ověřených ISIC slev (UI brána po přihlášení). */
export const DEALS_RESULTS_PATH = '/results?deals=1'

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

/** True, když návrat míří na filtr ověřených slev. */
export function isDealsReturnPath(path) {
  const safe = safeInternalPath(path, '')
  if (!safe.startsWith('/results')) return false
  try {
    const url = new URL(safe, 'https://cheapeats.local')
    return url.pathname === '/results' && url.searchParams.get('deals') === '1'
  } catch {
    return false
  }
}

export function isDealDetailPath(path) {
  const safe = safeInternalPath(path, '')
  return safe.startsWith('/nabidka/')
}

/** Texty přihlášení / registrace podle cíle po přihlášení. */
export function authGateCopy(nextPath) {
  if (isDealsReturnPath(nextPath) || isDealDetailPath(nextPath)) {
    return {
      headline: 'Přihlas se a objev dostupné slevy',
      lead:
        'Prohlížení ověřených ISIC nabídek v FoodGo je zdarma. Neodečítáme body a nejde o vlastní vouchery FoodGo.',
      note:
        'Přihlášení do FoodGo nenahrazuje platný průkaz ISIC. Podmínky a uplatnění určuje poskytovatel nabídky.',
    }
  }
  return {
    headline: null,
    lead: 'Účet FoodGo odemkne kód a postup uplatnění. Restaurace kvůli tomu svůj ceník nemění.',
    note: null,
  }
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
