# FoodGo 1.0 — zbývající ruční kroky

Jen to, co nejde dokončit bez provozovatele / Comgate / schválení.  
Technický stav: commit na `foodgo-launch-preview`, detail v `FOODGO-LAUNCH.md`.

---

## 1. Údaje provozovatele (blokuje vydání)

| | |
| --- | --- |
| **Kde** | Živnostenský úřad → pak soubor `src/constants/operator.js` |
| **Co** | `legalName`, `ico`, `street`, `city`, `postalCode`, `email`; DPH: `vatStatus` (`non-payer`/`payer`), případně `dic`, `vatRatePercent`, `catalogPriceIncludesVat` |
| **Ověření** | `npm run launch:check -- --offline` → žádné `BLOCKED` u `operator-identity` |

Neveřejné (banka, hesla, klíče) do gitu nepatří.

---

## 2. Právní texty

| | |
| --- | --- |
| **Kde** | `/ochrana-osobnich-udaju`, `/obchodni-podminky` (+ kontrola s právníkem) |
| **Co** | Schválit návrhy po doplnění OPERATOR |
| **Ověření** | Stránky ukazují skutečné jméno/IČO/kontakt; bez placeholderů |

---

## 3. Vercel Production / Preview env

Aktuálně na projektu jsou hlavně `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL` (Production). Doplň:

| Proměnná | Prostředí | Ověření |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Preview i Production (`https://…`) | Kanonické odkazy / sitemap |
| `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL` | Preview + Production | `npm run check:resend` / odeslání poptávky |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview + Production (jen server) | Webhook zápis RPC; nikdy `VITE_*` |
| `PAYMENT_PROVIDER=comgate`, `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET` | nejdřív Preview | `GET /api/payments/status` → `enabled` dle flagů |
| `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false` | Preview | sandbox create |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview (+ později Production) | `protectionBypassConfigured: true` **bez** úniku hodnoty v JSON |

**UI:** [Vercel Dashboard](https://vercel.com) → team `jindrichcompany` → project `cheat-eaps` → Settings → Environment Variables.

---

## 4. Supabase Auth redirects

| | |
| --- | --- |
| **Kde** | [Supabase Dashboard](https://supabase.com/dashboard) → projekt CheapEats → Authentication → URL Configuration |
| **Co** | Site URL = produkční `PUBLIC_SITE_URL`; Redirect Allow List: `/nove-heslo` na Production i Preview (`https://*-jindrichcompany.vercel.app/nove-heslo` nebo konkrétní Preview URL) |
| **Ověření** | Obnova hesla dorazí na `/nove-heslo` a uloží heslo |

---

## 5. SQL migrace (izolovaný test → produkce)

| | |
| --- | --- |
| **Kde** | Supabase SQL Editor (nejdřív **nový test projekt** / větev, ne ostrá data) |
| **Pořadí** | 1) `auth-rls` + `business-applications` (pokud chybí) → 2) `supabase/promotion-orders.sql` → 3) `supabase/promotion-owners.sql` → 4) `alter database postgres set app.payment_webhook_secret = '<PAYMENT_SECRET>';` |
| **Rollback owners** | `drop table public.promotion_audit_log; drop table public.place_owner_claims;` |
| **Ověření** | Tabulky existují; anon nemůže číst cizí objednávky; RPC `record_verified_payment` jen `service_role` |
| **Offline kontrakt** | `node scripts/sql-migration-dry-run.mjs` (nespouští DB) |

V tomto agent běhu Docker daemon / vzdálená test DB nebyly dostupné — migrace se **neaplikovaly**.

---

## 6. Resend + doména

| | |
| --- | --- |
| **Kde** | [resend.com](https://resend.com) → Domains + API Keys |
| **Co** | Ověřit DNS domény; `EMAIL_FROM` na ověřené doméně; stejné klíče do Vercel |
| **Lokálně** | `npm run resend:key` → `npm run check:resend` |
| **Ověření** | Poptávka Pro podniky / schválení žádosti dorazí (bez spamu na cizí restaurace) |

Trial `onboarding@resend.dev` doručí jen na e-mail Resend účtu.

---

## 7. Comgate sandbox → později live

| | |
| --- | --- |
| **Kde** | [portal.comgate.cz](https://portal.comgate.cz) → připojení e-shopu |
| **Result URL** | `https://<preview-host>/api/payments/webhook?x-vercel-protection-bypass=<BYPASS>` |
| **Ověření** | Test platba → admin ukáže `paid`/`active`; `paymentSource` u testu `gateway-test`; Production bez `PAYMENTS_LIVE` test neaktivuje |
| **Live** | Jen po sandbox E2E + explicitní `PAYMENTS_LIVE=true` |

---

## 8. Vydání

| | |
| --- | --- |
| **Kde** | GitHub `foodgo-launch-preview` → `main` (PR), Vercel Production |
| **Až když** | Kroky 1–2 hotové; smoke Preview/Production; platby odděleně (7) |
| **Rollback** | Vercel → předchozí Production → Promote |

---

## Co už není ruční technická překážka

Mapa, katalog 775 souřadnic, Comgate kód (create/push/status), auto-aktivace s oddělením test/live, CSV fakturace, SQL kontrakty, Preview deploy pipeline.
