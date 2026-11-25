/** Otevírací doba a telefon z OSM tagů. Stav open/closed řeší openingStatus.js jen u spolehlivých vzorů. */

const DAY_MAP = {
  mo: 'Po',
  tu: 'Út',
  we: 'St',
  th: 'Čt',
  fr: 'Pá',
  sa: 'So',
  su: 'Ne',
}

const UNREADABLE_HOURS = new Set(['', 'closed', 'unknown', 'fix', 'n/a', 'na', 'none', '-'])

export function rawOsmPhone(tags = {}) {
  const direct = String(tags.phone || '').trim()
  if (direct) return direct
  return String(tags['contact:phone'] || '').trim()
}

export function rawOsmOpeningHours(tags = {}) {
  return String(tags.opening_hours || '').trim()
}

/** Telefon z OSM: zobrazitelný text a tel: odkaz, nebo null. */
export function normalizeOsmPhone(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  if (/https?:\/\//i.test(text) || /@/.test(text)) return null

  const first = text.split(/[;,/|]/)[0].trim()
  if (!first) return null

  let digits = first.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (!digits.startsWith('+') && /^420\d{9}$/.test(digits)) digits = `+${digits}`
  if (!digits.startsWith('+') && /^\d{9}$/.test(digits)) digits = `+420${digits}`

  const national = digits.startsWith('+420') ? digits.slice(4) : digits.replace(/\D/g, '')
  if (!/^\d{9}$/.test(national) && !/^\+\d{10,15}$/.test(digits)) return null
  if (digits.startsWith('+420') && national.length !== 9) return null

  const tel = digits.startsWith('+420') ? `+420${national}` : digits
  const display = tel.startsWith('+420')
    ? `+420 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
    : first

  return { display, tel }
}

/** Čitelná OSM otevírací doba (neodhadujeme stav otevření). */
export function isReadableOpeningHours(raw) {
  const value = String(raw || '').trim()
  if (!value) return false
  if (UNREADABLE_HOURS.has(value.toLowerCase())) return false
  if (value.length > 220) return false
  if (/https?:\/\//i.test(value) || /www\./i.test(value)) return false
  if (/^(viz|see|call|telefon|tel\.|by appointment|dle dohody)/i.test(value)) return false
  if (value === '24/7' || /^24\s*\/\s*7$/i.test(value)) return true
  if (!/\d/.test(value)) return false
  if (!/(mo|tu|we|th|fr|sa|su|ph|\d{1,2}\s*:\s*\d{2})/i.test(value)) return false
  return true
}

function mapDayToken(token) {
  const key = token.toLowerCase()
  return DAY_MAP[key] || token
}

/** Přepíše anglické zkratky dnů; časy a ostatní tokeny nechá. */
export function formatOpeningHoursForDisplay(raw) {
  if (!isReadableOpeningHours(raw)) return null
  const value = String(raw).trim()
  if (value === '24/7' || /^24\s*\/\s*7$/i.test(value)) return 'Nonstop (24/7)'

  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/gi, (day) => mapDayToken(day))
        .replace(/\boff\b/gi, 'zavřeno')
        .replace(/-/g, '–'),
    )
    .join('\n')
}

export function extractOsmContact(tags = {}) {
  const hoursRaw = rawOsmOpeningHours(tags)
  const phoneRaw = rawOsmPhone(tags)
  const phone = normalizeOsmPhone(phoneRaw)
  const hoursReadable = isReadableOpeningHours(hoursRaw)
  const out = { source: 'openstreetmap' }

  if (hoursReadable) {
    out.osmOpeningHours = hoursRaw
    out.osmOpeningHoursDisplay = formatOpeningHoursForDisplay(hoursRaw)
  }
  if (phone) {
    out.osmPhone = phone.display
    out.osmPhoneTel = phone.tel
  }

  return out
}

/** Pohled pro UI z už sloučeného záznamu restaurace. */
export function presentOsmContact(restaurant) {
  const hoursRaw = restaurant?.osmOpeningHours
  const hoursDisplay =
    formatOpeningHoursForDisplay(hoursRaw) || restaurant?.osmOpeningHoursDisplay || null
  const phoneDisplay = restaurant?.osmPhone || null
  const phoneTel = restaurant?.osmPhoneTel || normalizeOsmPhone(phoneDisplay)?.tel || null

  return {
    hasHours: Boolean(hoursDisplay),
    hoursDisplay: hoursDisplay || null,
    hoursRaw: isReadableOpeningHours(hoursRaw) ? hoursRaw : null,
    hasPhone: Boolean(phoneDisplay && phoneTel),
    phoneDisplay: phoneDisplay && phoneTel ? phoneDisplay : null,
    phoneTel: phoneDisplay && phoneTel ? phoneTel : null,
    sourceLabel: 'OpenStreetMap',
    unverifiedNote: 'Údaj z OpenStreetMap. Neověřovali jsme ho nezávisle.',
  }
}
