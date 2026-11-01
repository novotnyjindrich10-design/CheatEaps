/**
 * Dobrovolná podpora CheapEats. Bez protislužby a bez údajů o kartě.
 *
 * Platba se smí spustit jen když SUPPORT_PAYMENT splní všechno najednou:
 * ověřenou adresu https, název parametru částky, jednotku `kc` nebo `halere`,
 * ověřeného příjemce, přijaté podmínky platební služby a souhlas zákonného zástupce.
 * Adresu sem nedoplňuj, dokud tyhle věci nejsou ověřené. Tajný klíč sem nepatří.
 */

export const SUPPORT_PRESET_KC = Object.freeze([30, 50, 100])

export const SUPPORT_PAYMENT = Object.freeze({
  paymentUrl: '',
  amountQueryParam: '',
  amountUnit: '',
  recipientVerified: false,
  serviceTermsVerified: false,
  guardianConsentVerified: false,
})

const GROUPED_AMOUNT = /^(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d{1,2})?$/

function halereFromParts(whole, frac = '') {
  if (!/^\d+$/.test(whole) || (frac !== '' && !/^\d{1,2}$/.test(frac))) return null
  if (whole.length > 12) return null
  const kc = Number(whole)
  const extra = frac.length === 0 ? 0 : frac.length === 1 ? Number(frac) * 10 : Number(frac)
  if (!Number.isSafeInteger(kc) || !Number.isSafeInteger(extra)) return null
  const halere = kc * 100 + extra
  if (!Number.isSafeInteger(halere) || halere <= 0) return null
  return halere
}

/** Kladná konečná částka v haléřích, nebo null. Nula, záporné hodnoty, NaN a nekonečno neprojdou. */
export function parseSupportAmount(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    const halere = Math.round(value * 100)
    if (!Number.isSafeInteger(halere) || halere <= 0) return null
    if (Math.abs(value * 100 - halere) > 1e-6) return null
    return halere
  }
  if (typeof value !== 'string') return null
  const stripped = value
    .replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
    .trim()
    .replace(/\s*kč\s*$/iu, '')
    .trim()
  if (!GROUPED_AMOUNT.test(stripped)) return null
  const [whole, frac = ''] = stripped.replace(/ /g, '').replace(',', '.').split('.')
  return halereFromParts(whole, frac)
}

export function formatSupportKc(halere) {
  if (!Number.isSafeInteger(halere) || halere <= 0) return ''
  const whole = Math.trunc(halere / 100)
  const frac = halere % 100
  const grouped = new Intl.NumberFormat('cs-CZ').format(whole)
  if (frac === 0) return `${grouped} Kč`
  return `${grouped},${String(frac).padStart(2, '0')} Kč`
}

function amountParam(halere, unit) {
  if (!Number.isSafeInteger(halere) || halere <= 0) return null
  if (unit === 'halere') return String(halere)
  if (unit !== 'kc') return null
  const whole = Math.trunc(halere / 100)
  const frac = halere % 100
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, '0')}`
}

function readPaymentTarget(config) {
  if (!config || typeof config !== 'object') return null
  if (config.recipientVerified !== true) return null
  if (config.serviceTermsVerified !== true) return null
  if (config.guardianConsentVerified !== true) return null
  if (typeof config.amountQueryParam !== 'string') return null
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(config.amountQueryParam)) return null
  if (config.amountUnit !== 'kc' && config.amountUnit !== 'halere') return null
  if (typeof config.paymentUrl !== 'string' || config.paymentUrl.trim() === '') return null
  let url
  try {
    url = new URL(config.paymentUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (!url.hostname) return null
  if (url.username || url.password) return null
  return url
}

export function canStartSupportPayment(config = SUPPORT_PAYMENT) {
  return readPaymentTarget(config) !== null
}

/**
 * Vrátí adresu jen pro ověřenou konfiguraci. Částka je kanonické číslo, ne text od uživatele.
 * Jinak null a platba se nespouští.
 */
export function buildSupportPaymentUrl(halere, config = SUPPORT_PAYMENT) {
  const url = readPaymentTarget(config)
  if (!url || !config) return null
  const amount = amountParam(halere, config.amountUnit)
  if (amount == null) return null
  url.searchParams.set(config.amountQueryParam, amount)
  return url.toString()
}
