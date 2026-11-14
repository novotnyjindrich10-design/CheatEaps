# FoodGo — Business & Payments

Datum: 2026-11-14  
Stav: **pouze testovací / vypnutá architektura**

## 1. Možné zdroje příjmů (realisticky)

| Produkt | Popis | Stav v kódu |
| --- | --- | --- |
| Sponzorovaná karta ve výsledcích | Oddělený blok „Sponzorováno“ | Model ready, UI vypnuté |
| Rozšířený / ověřený profil | Oficiální web, foto s právy | Částečně (katalogová data) |
| Sponzorovaný pin na mapě | Odlišný marker | Vizualizace připravena |
| Neplacený zápis | Lead pro katalog | Zapnuto (`freeBusinessApplication`) |
| Dobrovolná podpora | `/podpor-me` | Bez `paymentUrl` |

Organické výsledky zůstávají oddělené — klientský příznak `sponsored` se zahazuje.

## 2. Připravené produkty / tarify

- Ceník v `constants/promotionPrice.js` + plány v `businessPlans.js`
- `presentPrice()` respektuje DPH režim provozovatele; bez potvrzeného VAT **neoznačuje** cenu za konečnou
- Objednávky / admin workflow v `server/promotionOrders.js` (aktivace až po ověřené úhradě adminem/webhookem)

## 3. Platební integrace — audit

Soubor: `src/server/payments.js`

| Položka | Stav |
| --- | --- |
| `paymentConfig().enabled` | **vždy `false`** (`gateway-not-connected`) |
| Návrat z brány | `paid: false` — success URL **neaktivuje** reklamu |
| Webhook | HMAC SHA-256 + idempotence připravené |
| Ostrý outbound | `buildGatewayPayment` → `gateway-not-wired` |
| Stripe / GoPay / Comgate účet | **Nevytvořen agentem** |

### Volba poskytovatele (neověřené tržní údaje — ověřit před smlouvou)

Pro ČR typicky stačí **jeden** poskytovatel s kartami + bankovními metodami (Comgate nebo GoPay). Stripe je silný mezinárodně; Apple/Google Pay závisí na aktivaci u zvolené brány.  
**Nezavádět tři brány najednou.**

## 4. Bezpečný režim (aktuální)

1. Ceny se musí ověřovat server-side (už v objednávkové vrstvě).
2. Propagace se aktivuje až po ověřené platbě (admin `mark_paid` / budoucí webhook) — **ne** po return URL.
3. `PUBLIC_V1.paidPromotionUi = false` — veřejnost nevidí placené balíčky jako ready.
4. Stránka Pro podniky vysvětluje, že online platba není zapojená.

## 5. Chybějící podmínky pro ostrý provoz

1. Identita provozovatele (živnost / IČO) — případně zákonný zástupce, pokud je majitel nezletilý
2. Smlouva s platební branou + KYC
3. Ověřená fakturační a daňová pravidla
4. Resend / e-mailová doména pro potvrzení objednávek
5. Právní texty schválené člověkem
6. Explicitní souhlas majitele projektu se založením platebního účtu

## 6. Další kroky (až bude souhlas)

1. Doplnit OPERATOR + DPH
2. Zapnout `paidPromotionUi` jen na Preview
3. Sandbox Comgate/GoPay (bez `PAYMENTS_LIVE`)
4. E2E: neplatný webhook odmítnut; return URL neaktivuje
5. Teprve po manuálním sign-off: live klíče mimo git

**Verdikt: FoodGo NENÍ připravené přijímat skutečné platby. Pouze testovací / vypnutý režim.**
