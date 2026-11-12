/** Validace hlášení chybných údajů o podniku. */

export const PLACE_REPORT_REASONS = Object.freeze([
  { id: 'address', label: 'Špatná adresa' },
  { id: 'price', label: 'Neaktuální cena' },
  { id: 'closed', label: 'Zavřený podnik' },
  { id: 'photo', label: 'Špatná fotografie' },
  { id: 'category', label: 'Nesprávná kategorie' },
  { id: 'other', label: 'Jiný problém' },
])

const REASON_IDS = new Set(PLACE_REPORT_REASONS.map((row) => row.id))

export function validatePlaceReport(input = {}) {
  const restaurantId = String(input.restaurantId || '').trim()
  const reason = String(input.reason || '').trim()
  const details = String(input.details || '').trim()
  const contact = String(input.contact || '').trim()
  const honeypot = String(input.website || '').trim()

  if (honeypot) return { ok: false, message: 'Formulář se nepodařilo odeslat.' }
  if (!restaurantId || restaurantId.length > 120) {
    return { ok: false, message: 'Chybí platný podnik.' }
  }
  if (!REASON_IDS.has(reason)) {
    return { ok: false, message: 'Vyber důvod hlášení.' }
  }
  if (details.length < 8 || details.length > 1200) {
    return { ok: false, message: 'Popiš problém (8–1200 znaků).' }
  }
  if (contact && (contact.length > 120 || /[\r\n]/.test(contact))) {
    return { ok: false, message: 'Kontakt je neplatný.' }
  }

  return {
    ok: true,
    report: {
      restaurantId,
      reason,
      details,
      contact: contact || null,
      createdAt: new Date().toISOString(),
    },
  }
}
