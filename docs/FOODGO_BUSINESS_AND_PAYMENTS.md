# FoodGo — Business & Payments

Datum: 2026-11-24  
Větev: `foodgo-launch-preview`  
Stav: **Comgate integrace v kódu; ostrý outbound vypnutý; sandbox outbound jen po env**

## 1. Zdroje příjmů

| Produkt | Stav |
| --- | --- |
| Sponzorovaná karta / pin | Model ready; veřejný nákup UI = poptávka |
| Neplacený zápis | Zapnuto |
| Online Comgate Checkout | Kód hotový; vyžaduje merchant + secret + outbound flag |

## 2. Tarify

- `constants/promotionPrice.js`: START 99 / PLUS 199 / PREMIUM 399 Kč za 30 dní
- Roční = 10× měsíční (365 dní), jednorázově, bez auto-renewal
- Cenu určuje jen server (`quoteTrustedPrice` / objednávková vrstva)

## 3. Platební brána: Comgate

Jedna brána (CZK, karty + bankovní metody). Stripe/GoPay se nezavádí paralelně.

| Položka | Stav |
| --- | --- |
| `paymentConfig().enabled` | `true` jen při `PAYMENT_PROVIDER=comgate` + merchant + secret + webhook secret **a** (`PAYMENTS_SANDBOX_OUTBOUND=true` **nebo** `PAYMENTS_LIVE=true`) |
| `POST /api/payments/create` | Založí Comgate relaci a vrátí `redirect` (s mock/fetch testy) |
| Návrat z brány | `paid: false` — **neaktivuje** |
| Webhook | HMAC SHA-256, kontrola částky/měny, idempotence, **auto-aktivace** propagace |
| `POST /api/payments/test-confirm` | Simulace jen mimo production + `PAYMENTS_TEST_MODE` + secret ≥16 |
| Ostrá sandbox transakce u Comgate | **Neproběhla** — chybí merchant účet provozovatele |

### Env (Vercel Preview / Production — nikdy do gitu)

```
PAYMENT_PROVIDER=comgate
PAYMENT_MERCHANT_ID=...
PAYMENT_SECRET=...
PAYMENT_WEBHOOK_SECRET=...
PAYMENTS_SANDBOX_OUTBOUND=true   # teprve po sandbox účtu; LIVE nech false
PAYMENTS_LIVE=false
PAYMENTS_TEST_MODE=true          # jen Preview; nikdy na Production
PAYMENT_TEST_SECRET=...          # ≥16 znaků
```

Webhook URL: `https://<host>/api/payments/webhook`  
Create: `POST /api/payments/create` s `{ reference, accessKey }` po poptávce.

Ověření: status endpoint `GET /api/payments/status` → `enabled: true` + `reason: sandbox|live`.

## 4. Bezpečný režim (aktuálně bez klíčů)

1. Veřejnost vidí **Nezávazná poptávka**, ne „Zaplatit“.
2. Return URL neaktivuje reklamu.
3. Testovací platby neběží na Production (`VERCEL_ENV=production` blokuje test-confirm).
4. Admin dashboard eviduje objednávky; test revenue oddělené od live přes `paymentSource` / test flag.

## 5. Blokátory ostrých plateb

1. Identita provozovatele (OPERATOR / IČO)
2. Comgate smlouva + KYC + sandbox merchant
3. Env klíče výše + webhook v Comgate portálu
4. Schválené obchodní podmínky / fakturace
5. Explicitní souhlas s `PAYMENTS_LIVE=true` (až po sandbox E2E)

**Verdikt: kód brány je připravený. Skutečná sandbox transakce u Comgate ještě neproběhla → online platby se nesmí prezentovat jako funkční nákup.**
