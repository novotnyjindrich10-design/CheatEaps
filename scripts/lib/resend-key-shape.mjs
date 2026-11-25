/**
 * Společná kontrola tvaru Resend API klíče bez výpisu hodnoty.
 * Oficiální (Resend 2026): re_ + 8 + _ + 24 base58 (bez 0/O/I/l), celkem 36.
 * Přijaté k zápisu: stejná struktura s běžným [A-Za-z0-9], suffix 16–64.
 */
export const RESEND_KEY_OFFICIAL = /^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$/
export const RESEND_KEY_ACCEPTED = /^re_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,64}$/

export function normalizeResendKey(raw) {
  let value = String(raw ?? '')
  value = value.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
  value = value.trim().replace(/^['"]|['"]$/g, '')
  const bearer = value.match(/^bearer\s+(.+)$/i)
  if (bearer) value = bearer[1].trim().replace(/^['"]|['"]$/g, '')
  const envLine = value.match(/^RESEND_API_KEY\s*=\s*(.+)$/i)
  if (envLine) value = envLine[1].trim().replace(/^['"]|['"]$/g, '')
  return value.replace(/\s+/g, '')
}

export function describeResendKey(raw) {
  const value = normalizeResendKey(raw)
  if (!value) {
    return { present: false, length: 0, prefixOk: false, official: false, accepted: false }
  }
  return {
    present: true,
    length: value.length,
    prefixOk: value.startsWith('re_'),
    official: RESEND_KEY_OFFICIAL.test(value),
    accepted: RESEND_KEY_OFFICIAL.test(value) || RESEND_KEY_ACCEPTED.test(value),
  }
}
