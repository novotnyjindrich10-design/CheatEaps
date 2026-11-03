export const COMPARE_LIMIT = 3

export function cleanCompareIds(ids) {
  const seen = new Set()
  const next = []
  for (const id of ids || []) {
    const value = String(id || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    next.push(value)
    if (next.length >= COMPARE_LIMIT) break
  }
  return next
}

export function nextCompareIds(ids, id) {
  const value = String(id || '').trim()
  const current = cleanCompareIds(ids)
  if (!value) return { ids: current, notice: '' }
  if (current.includes(value)) {
    return { ids: current.filter((item) => item !== value), notice: '' }
  }
  if (current.length >= COMPARE_LIMIT) {
    return { ids: current, notice: 'Porovnat jde nejvýš 3 podniky.' }
  }
  return { ids: [...current, value], notice: '' }
}
