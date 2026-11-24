/** Produkční Supabase projekt FoodGo. Destruktivní skripty ho musí odmítnout. */
export const PRODUCTION_SUPABASE_REF = 'pcptzyfoojmnspumcmsi'

export function isProductionSupabaseTarget(value) {
  return String(value || '').toLowerCase().includes(PRODUCTION_SUPABASE_REF)
}

export function assertNotProductionTarget(value, purpose = 'tento skript') {
  if (isProductionSupabaseTarget(value)) {
    throw new Error(
      `${purpose}: odmítnuto. Cíl obsahuje produkční projekt ${PRODUCTION_SUPABASE_REF}.`,
    )
  }
}
