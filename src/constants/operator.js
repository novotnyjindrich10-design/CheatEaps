/**
 * Údaje provozovatele. Doplní je živnost, pod kterou se FoodGo má vést.
 * Prázdné hodnoty se na webu nesmí nahradit odhadem.
 * Kontaktní e-mail značky je v constants/brand.js (CONTACT_EMAIL).
 *
 * Po živnostenském úřadě doplň VEŘEJNÉ údaje níže (commit do gitu je OK):
 * - legalName — jméno / název podle živnosti
 * - ico — IČO
 * - street, city, postalCode — sídlo
 * - email — veřejný provozní e-mail (může být stejný jako CONTACT_EMAIL)
 * - vatStatus — 'non-payer' | 'payer' | 'unconfirmed'
 * - vatRatePercent — jen u payer (např. 21)
 * - catalogPriceIncludesVat — true/false jen u payer
 * - dic — DIČ jen pokud jsi plátce DPH
 *
 * NEVEŘEJNÉ (jen Vercel env / účetní software, nikdy do gitu):
 * - Comgate merchant/secret, Resend API key, Supabase service role
 * - bankovní účet, hesla, soukromé kontakty
 *
 * launch:check zůstane BLOCKED, dokud operatorIsComplete() neprojde.
 */

export const OPERATOR = Object.freeze({
  legalName: '',
  ico: '',
  dic: '',
  vatStatus: 'unconfirmed',
  vatRatePercent: null,
  catalogPriceIncludesVat: null,
  street: '',
  city: '',
  postalCode: '',
  email: '',
})

export function operatorIsComplete(source = OPERATOR) {
  const operator = source || OPERATOR
  return Boolean(
    String(operator.legalName || '').trim()
    && String(operator.ico || '').trim()
    && String(operator.street || '').trim()
    && String(operator.city || '').trim()
    && String(operator.postalCode || '').trim()
    && String(operator.email || '').trim(),
  )
}

export function operatorAddress(source = OPERATOR) {
  const operator = source || OPERATOR
  return [operator.street, operator.postalCode, operator.city].map((part) => String(part || '').trim()).filter(Boolean).join(', ')
}

/**
 * Ceníková částka a režim DPH podle předaných údajů provozovatele.
 * Bez druhého argumentu se použije OPERATOR. Prázdný nebo neznámý status
 * zůstane nepotvrzený: daň se nedopočítá a částka se neoznačí za konečnou.
 *
 * non-payer: konečná částka je ceník, DPH je 0.
 * payer + catalogPriceIncludesVat true: konečná částka je ceník.
 * payer + catalogPriceIncludesVat false: konečná částka je ceník plus daň.
 * Chybějící sazba nebo nejasné „včetně daně“ se nehádejí.
 */
export function presentPrice(amount, source = OPERATOR) {
  const operator = source || OPERATOR
  const catalogAmount = amount
  if (operator.vatStatus === 'non-payer') {
    return {
      catalogAmount,
      finalAmount: catalogAmount,
      vatAmount: 0,
      vatStatus: 'non-payer',
      vatNote: 'Konečná částka. DPH se nepřičítá, provozovatel není plátce DPH.',
    }
  }
  if (
    operator.vatStatus === 'payer'
    && Number.isFinite(operator.vatRatePercent)
    && operator.catalogPriceIncludesVat === true
  ) {
    return {
      catalogAmount,
      finalAmount: catalogAmount,
      vatAmount: null,
      vatStatus: 'payer',
      vatNote: `Konečná částka včetně DPH ${operator.vatRatePercent} %.`,
    }
  }
  if (
    operator.vatStatus === 'payer'
    && Number.isFinite(operator.vatRatePercent)
    && operator.catalogPriceIncludesVat === false
  ) {
    const vatAmount = Math.round((catalogAmount * operator.vatRatePercent) / 100)
    return {
      catalogAmount,
      finalAmount: catalogAmount + vatAmount,
      vatAmount,
      vatStatus: 'payer',
      vatNote: `Ceník je bez DPH. DPH ${operator.vatRatePercent} % činí ${vatAmount} Kč. Konečná částka je ${catalogAmount + vatAmount} Kč.`,
    }
  }
  return {
    catalogAmount,
    finalAmount: null,
    vatAmount: null,
    vatStatus: 'unconfirmed',
    vatNote:
      'Režim DPH není potvrzený. Částka v ceníku není dopočítaná o daň. Konečná částka na faktuře se určí až po doplnění statusu plátce.',
  }
}
