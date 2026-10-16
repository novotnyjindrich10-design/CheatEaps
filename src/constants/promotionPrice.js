/**
 * Důvěryhodný ceník propagace.
 * Částku určuje jen známý identifikátor balíčku a období.
 * Modul nesahá na window, document, localStorage ani jiné prohlížečové API,
 * takže ho později může zavolat i serverová funkce.
 *
 * Tohle není server. Dokud objednávku nepřijme funkce na serveru,
 * běží stejný výpočet i v prohlížeči a návštěvník si ho tam může obejít.
 */

export const YEARLY_MONTHS_BILLED = 10

/** Jediný zdroj měsíčních cen. Roční cena je deset těchto plateb. */
export const PROMOTION_MONTHLY_PRICES = Object.freeze({
  start: 99,
  plus: 199,
  premium: 399,
})

const PERIODS = new Set(['mesicne', 'rocne'])

export function yearlyPrice(monthlyPrice) {
  return monthlyPrice * YEARLY_MONTHS_BILLED
}

export function yearlySavings(monthlyPrice) {
  return monthlyPrice * 12 - yearlyPrice(monthlyPrice)
}

/**
 * Cena objednávky z konfigurace výše.
 * Další argumenty, třeba částka poslaná z prohlížeče, se nečtou.
 * Neznámý balíček nebo období nevrátí částku.
 */
export function quoteTrustedPrice(planId, periodId) {
  if (!Object.hasOwn(PROMOTION_MONTHLY_PRICES, planId)) {
    return { ok: false, error: 'unknown-plan' }
  }
  if (!PERIODS.has(periodId)) {
    return { ok: false, error: 'unknown-period' }
  }

  const monthly = PROMOTION_MONTHLY_PRICES[planId]
  const yearly = yearlyPrice(monthly)
  const yearlyBilling = periodId === 'rocne'
  return {
    ok: true,
    planId,
    periodId,
    monthly,
    yearly,
    amount: yearlyBilling ? yearly : monthly,
    savings: yearlyBilling ? yearlySavings(monthly) : 0,
    currency: 'CZK',
  }
}
