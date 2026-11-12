/**
 * Veřejná free-katalog v1 — co smí vypadat jako hotová služba.
 * Vypnuté cesty zůstávají v kódu (URL/admin), ale nejsou nabízené jako ready produkt.
 */
export const PUBLIC_V1 = Object.freeze({
  /** Ověřené členské slevy (`?deals=1`) — vyžadují auth a nejsou jádrem free katalogu. */
  memberDealsUi: false,
  /** Placené balíčky / poptávka propagace na Pro podniky. */
  paidPromotionUi: false,
  /** Dobrovolná podpora `/podpor-me` (platba není napojená). */
  supportInSitemap: false,
  /** Auth zůstává dostupný (oblíbené sync, recenze); bez Supabase se degraduje. */
  authUi: true,
  /** Neplacený zápis podniku do katalogu. */
  freeBusinessApplication: true,
})

export function publicCategories(list) {
  if (PUBLIC_V1.memberDealsUi) return list
  return list.filter((item) => !item?.dealsFilter && item?.value !== 'slevy')
}
