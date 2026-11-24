/**
 * Sloučení přepisů katalogu se statickými / published podniky.
 * Skryté podniky vypadnou. Jméno, adresa a kategorie se přepíší jen když jsou vyplněné.
 */

export function normalizePlaceOverride(row) {
  if (!row || typeof row !== 'object') return null
  const placeId = String(row.placeId || row.place_id || '').trim()
  if (!placeId) return null
  return {
    placeId,
    hidden: row.hidden === true,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
    address: typeof row.address === 'string' && row.address.trim() ? row.address.trim() : null,
    category: typeof row.category === 'string' && row.category.trim() ? row.category.trim() : null,
    adminNote:
      typeof row.adminNote === 'string'
        ? row.adminNote.trim()
        : typeof row.admin_note === 'string'
          ? row.admin_note.trim()
          : null,
    updatedAt: row.updatedAt || row.updated_at || null,
  }
}

export function applyPlaceOverrides(places, overrides) {
  const map = new Map()
  for (const raw of overrides || []) {
    const row = normalizePlaceOverride(raw)
    if (row) map.set(row.placeId, row)
  }
  if (!map.size) return places || []

  const out = []
  for (const place of places || []) {
    const id = String(place?.id || '')
    const patch = map.get(id)
    if (!patch) {
      out.push(place)
      continue
    }
    if (patch.hidden) continue
    const next = { ...place }
    if (patch.name) next.name = patch.name
    if (patch.address) next.address = patch.address
    if (patch.category) next.category = patch.category
    out.push(next)
  }
  return out
}

export function validatePlaceOverrideInput(body) {
  const placeId = String(body?.placeId || '').trim()
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(placeId)) {
    return { ok: false, message: 'Neplatné ID podniku.' }
  }
  const hidden = body?.hidden === true
  const name = body?.name == null || body?.name === '' ? null : String(body.name).trim()
  const address = body?.address == null || body?.address === '' ? null : String(body.address).trim()
  const category = body?.category == null || body?.category === '' ? null : String(body.category).trim()
  const adminNote =
    body?.adminNote == null || body?.adminNote === '' ? null : String(body.adminNote).trim().slice(0, 1000)

  if (name != null && (name.length < 2 || name.length > 160)) {
    return { ok: false, message: 'Název musí mít 2–160 znaků, nebo zůstat prázdný.' }
  }
  if (address != null && (address.length < 3 || address.length > 240)) {
    return { ok: false, message: 'Adresa musí mít 3–240 znaků, nebo zůstat prázdná.' }
  }
  if (category != null && (category.length < 2 || category.length > 80)) {
    return { ok: false, message: 'Kategorie musí mít 2–80 znaků, nebo zůstat prázdná.' }
  }

  return {
    ok: true,
    override: { placeId, hidden, name, address, category, adminNote },
  }
}
