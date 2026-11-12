/**
 * Bezpečné odvození „otevřeno teď“ z OSM opening_hours.
 * Podporuje 24/7 a jednoduché vzory Mo-Fr 10:00-22:00; Su off.
 * Složité pravidla (PH, měsíce, výjimky) → unknown (nepretendujeme).
 */

const DAY_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']

function pragueParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayIndex = weekdayMap[parts.weekday]
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  if (!Number.isFinite(dayIndex) || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { dayIndex, minutes: hour * 60 + minute }
}

function parseTimeToken(token) {
  const match = String(token || '')
    .trim()
    .match(/^(\d{1,2})\s*:\s*(\d{2})$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

function expandDays(spec) {
  const value = String(spec || '').trim().toLowerCase()
  if (!value || value === 'ph') return null
  if (value.includes('-')) {
    const [from, to] = value.split('-').map((part) => part.trim())
    const start = DAY_KEYS.indexOf(from)
    const end = DAY_KEYS.indexOf(to)
    if (start < 0 || end < 0) return null
    const days = []
    let i = start
    for (;;) {
      days.push(i)
      if (i === end) break
      i = (i + 1) % 7
      if (days.length > 7) return null
    }
    return days
  }
  const single = DAY_KEYS.indexOf(value)
  return single >= 0 ? [single] : null
}

function parseRule(rule) {
  const trimmed = String(rule || '').trim()
  if (!trimmed) return { ok: false, complex: false }
  if (/^(24\/7|24\s*\/\s*7)$/i.test(trimmed)) return { ok: true, always: true }

  // Deny complex OSM features we don't evaluate.
  if (/\b(ph|sh|year|month|week|sunrise|sunset|\+|\[|\])/i.test(trimmed)) {
    return { ok: false, complex: true }
  }

  const match = trimmed.match(/^([A-Za-z,-]+)\s+(.+)$/)
  if (!match) return { ok: false, complex: true }
  const days = expandDays(match[1])
  if (!days) return { ok: false, complex: true }

  const timesRaw = match[2].trim().toLowerCase()
  if (timesRaw === 'off' || timesRaw === 'closed') {
    return { ok: true, days, closed: true }
  }

  const intervals = []
  for (const chunk of timesRaw.split(',')) {
    const [startTok, endTok] = chunk.split(/[-–]/).map((part) => part.trim())
    const start = parseTimeToken(startTok)
    const end = parseTimeToken(endTok)
    if (start == null || end == null) return { ok: false, complex: true }
    intervals.push({ start, end })
  }
  return { ok: true, days, intervals }
}

/**
 * @returns {{ status: 'open'|'closed'|'unknown', reason: string }}
 */
export function openingStatusNow(raw, now = new Date()) {
  const value = String(raw || '').trim()
  if (!value) return { status: 'unknown', reason: 'missing' }
  if (/^(24\/7|24\s*\/\s*7)$/i.test(value)) return { status: 'open', reason: '24/7' }

  const prague = pragueParts(now)
  if (!prague) return { status: 'unknown', reason: 'timezone' }

  const rules = value.split(';').map((part) => part.trim()).filter(Boolean)
  if (rules.length === 0) return { status: 'unknown', reason: 'empty' }

  let matched = null
  for (const rule of rules) {
    const parsed = parseRule(rule)
    if (!parsed.ok) {
      if (parsed.complex) return { status: 'unknown', reason: 'complex' }
      continue
    }
    if (parsed.always) return { status: 'open', reason: '24/7' }
    if (parsed.days.includes(prague.dayIndex)) matched = parsed
  }

  if (!matched) return { status: 'unknown', reason: 'no-day-rule' }
  if (matched.closed) return { status: 'closed', reason: 'off' }

  const { minutes } = prague
  for (const interval of matched.intervals || []) {
    const { start, end } = interval
    if (end > start) {
      if (minutes >= start && minutes < end) return { status: 'open', reason: 'interval' }
    } else if (end < start) {
      // přes půlnoc
      if (minutes >= start || minutes < end) return { status: 'open', reason: 'overnight' }
    }
  }
  return { status: 'closed', reason: 'outside' }
}

export function isOpenNowReliable(raw, now = new Date()) {
  return openingStatusNow(raw, now).status === 'open'
}
