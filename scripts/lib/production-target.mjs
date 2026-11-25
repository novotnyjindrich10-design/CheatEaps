/** Produkční Supabase projekt FoodGo. Destruktivní skripty ho musí odmítnout. */
export const PRODUCTION_SUPABASE_REF = 'pcptzyfoojmnspumcmsi'

/** Oddělený Preview projekt (foodgo-preview). */
export const PREVIEW_SUPABASE_REF = 'jnyxjyyvzxriuyvyiuxe'

export function isProductionSupabaseTarget(value) {
  return String(value || '').toLowerCase().includes(PRODUCTION_SUPABASE_REF)
}

export function isPreviewSupabaseTarget(value) {
  return String(value || '').toLowerCase().includes(PREVIEW_SUPABASE_REF)
}

export function assertNotProductionTarget(value, purpose = 'tento skript') {
  if (isProductionSupabaseTarget(value)) {
    throw new Error(
      `${purpose}: odmítnuto. Cíl obsahuje produkční projekt ${PRODUCTION_SUPABASE_REF}.`,
    )
  }
}

export function assertPreviewSupabaseTarget(value, purpose = 'tento skript') {
  assertNotProductionTarget(value, purpose)
  if (!isPreviewSupabaseTarget(value)) {
    throw new Error(
      `${purpose}: odmítnuto. Očekáván Preview projekt ${PREVIEW_SUPABASE_REF}, cíl ho neobsahuje.`,
    )
  }
}
