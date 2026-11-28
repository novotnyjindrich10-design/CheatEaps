export function pragueDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shiftDay(day, delta) {
  const [year, month, date] = String(day).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + delta))
  return next.toISOString().slice(0, 10)
}

function emptyCounts() {
  return { profileViews: 0, routeClicks: 0, websiteClicks: 0, phoneClicks: 0 }
}

function addCounts(target, row) {
  target.profileViews += Number(row.profileViews || row.profile_views || 0)
  target.routeClicks += Number(row.routeClicks || row.route_clicks || 0)
  target.websiteClicks += Number(row.websiteClicks || row.website_clicks || 0)
  target.phoneClicks += Number(row.phoneClicks || row.phone_clicks || 0)
  return target
}

function countsHaveData(counts) {
  if (!counts) return false
  return counts.profileViews + counts.routeClicks + counts.websiteClicks + counts.phoneClicks > 0
}

/** Denní řádky → součet za 7 a 30 dní a celé období. Bez řádků vrací nuly, ne odhady. */
export function summarizeDailyStats(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  const end = pragueDay(now)
  const sumSince = (days) => {
    const start = shiftDay(end, -(days - 1))
    const acc = emptyCounts()
    for (const row of list) {
      const day = String(row.day || '')
      if (!day || day < start || day > end) continue
      addCounts(acc, row)
    }
    return acc
  }
  const all = list.reduce((acc, row) => addCounts(acc, row), emptyCounts())
  return {
    d7: sumSince(7),
    d30: sumSince(30),
    all,
    hasData: countsHaveData(all),
  }
}

export function summarizeRange(rows, startIso, endIso) {
  const start = String(startIso || '').slice(0, 10)
  const end = String(endIso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return null
  const acc = emptyCounts()
  for (const row of Array.isArray(rows) ? rows : []) {
    const day = String(row.day || '')
    if (!day || day < start || day > end) continue
    addCounts(acc, row)
  }
  return { ...acc, hasData: countsHaveData(acc), start, end }
}

export function emptyStatCounts() {
  return emptyCounts()
}
