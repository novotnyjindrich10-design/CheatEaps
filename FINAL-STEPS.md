# FoodGo 1.0 — zbývající ruční kroky

Jen to, co nejde dokončit bez provozovatele / Comgate / schválení.  
Technický stav: větev `foodgo-launch-preview`, detail v `FOODGO-LAUNCH.md`.

**Stav Supabase (projekt `pcptzyfoojmnspumcmsi`, ověřeno po obnovení z pauzy):**
host `pcptzyfoojmnspumcmsi.supabase.co` je dostupný; Auth GoTrue odpovídá; základní tabulky (`profiles`, `favorites`, `reviews`, `review_reports`, `business_applications`, `published_places`) existují; `is_cheapeats_admin()` existuje. Tabulky `promotion_orders` / `promotion_payment_events` / view `promotion_sponsorships_public` existují, ale **RPC** `submit_promotion_inquiry`, `read_promotion_inquiry`, `record_verified_payment` **chybí** — evidence poptávek a webhook zápis zatím neběží end-to-end. `place_owner_claims` a `promotion_audit_log` chybí. Produkční DB se bez schválení neměnila.

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

## 3. Vercel environment variables

Projekt `cheat-eaps` (team `jindrichcompany`). Aktuálně nastaveno: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Preview + Production), `PUBLIC_SITE_URL` (jen Production). Protection Bypass pro Preview webhooky je na projektu zapnutý (`protectionBypassConfigured: true` u `/api/payments/status`).

| Proměnná | Kde získat | Preview | Production | Povinná katalog (zdarma) | Povinná platby | Ověření |
| --- | --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ano | ano | ano (účty/recenze) | ano (evidence) | `GET /api/auth/session` → `configured:true` |
| `SUPABASE_ANON_KEY` | Settings → API Keys → **publishable** (`sb_publishable_…`); legacy JWT anon zatím nechej | ano | ano | ano (účty) | ano (inquiry RPC) | session + přihlášení; `node scripts/check-supabase-schema.mjs` hlásí `publishable` |
| `PUBLIC_SITE_URL` | kanonický https origin webu | ano (`https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app`) | ano (`https://cheat-eaps.vercel.app` nebo vlastní doména) | doporučeno | doporučeno | sitemap / e-mailové odkazy |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API Keys → **secret** (`sb_secret_…`); legacy `service_role` zatím nechej | ano | ano | ne | ano (webhook → `record_verified_payment`) | jen server; nikdy `VITE_*`, nikdy do gitu/bundle |
| `RESEND_API_KEY` | Resend → API Keys | ano | ano | ne (poptávka se uloží i bez e-mailu) | ne | `npm run check:resend` |
| `EMAIL_FROM` | ověřená doména Resend (trial: `… <onboarding@resend.dev>`) | ano | ano | ne | ne | doručení poptávky |
| `INQUIRY_TO_EMAIL` | schránka provozovatele | ano | ano | ne | ne | upozornění na poptávku |
| `PAYMENT_PROVIDER` | pevně `comgate` | sandbox | později | ne | ano | `GET /api/payments/status` |
| `PAYMENT_MERCHANT_ID` | Comgate portál | sandbox | později | ne | ano | status → ne `gateway-not-connected` |
| `PAYMENT_SECRET` | Comgate secret (≥16) | sandbox | později | ne | ano | create + push; stejná hodnota do DB `app.payment_webhook_secret` |
| `PAYMENTS_SANDBOX_OUTBOUND` | `true` pro test create | ano | ne (nechat vypnuto) | ne | sandbox | outbound create v Preview |
| `PAYMENTS_LIVE` | vždy `false`, dokud neproběhne sandbox E2E | `false` | `false` | ne | gate | test platba neaktivuje Production |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Deployment Protection → Protection Bypass | ano | až při live webhooku | ne | ano (push URL) | status → `protectionBypassConfigured` **bez** úniku hodnoty |

**`SUPABASE_SERVICE_ROLE_KEY`:** jen Environment Variables na Vercelu (Server / Secret). Nesmí být v klientském bundle, GitHubu, logu ani veřejném API. Kód ho čte jen v `src/server/*`.

**UI:** [Vercel Dashboard](https://vercel.com) → team `jindrichcompany` → project `cheat-eaps` → Settings → Environment Variables.

---

## 4. Supabase Auth — Site URL a Redirect URLs

| | |
| --- | --- |
| **Kde** | [Supabase Dashboard](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration) → Authentication → URL Configuration |

**Site URL (Production):**
```
https://cheat-eaps.vercel.app
```
(až bude vlastní doména, Site URL na ni přepni a starou nech v Redirect listu)

**Redirect URLs — přesně tyto řádky:**
```
https://cheat-eaps.vercel.app/nove-heslo
https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app/nove-heslo
http://127.0.0.1:5173/nove-heslo
http://localhost:5173/nove-heslo
```

Volitelně (všechny Preview větve):
```
https://*-jindrichcompany.vercel.app/nove-heslo
```

**Ověření:** obnova hesla dorazí na `/nove-heslo` a uloží heslo; po přihlášení zůstane uživatel na webu (RecoveryRedirect zachytí tokeny i na Site URL).

---

## 5. SQL migrace (izolovaný test → produkce po schválení)

Kontrola: `node scripts/check-supabase-schema.mjs`  
Offline kontrakt: `node scripts/sql-migration-dry-run.mjs` (nespouští DB)

| Soubor | Stav na `pcptzyfoojmnspumcmsi` | Akce |
| --- | --- | --- |
| `supabase/bootstrap-all.sql` (základ) | **hotovo** — tabulky + `is_cheapeats_admin` | nic |
| `supabase/promotion-orders.sql` | tabulky/view **ano**, RPC **ne** | po schválení **spustit celý soubor** (idempotentní `create table if not exists` + `create or replace function`) |
| `supabase/promotion-owners.sql` | `place_owner_claims`, `promotion_audit_log` **MISSING** | po schválení spustit (až po funkčních RPC z orders) |
| `alter database … app.payment_webhook_secret` | neověřeno (vyžaduje service/SQL) | až bude `PAYMENT_SECRET` — stejná hodnota |
| `supabase/loyalty.sql` | chybí (volitelné V1) | neblokuje katalog |
| `supabase/place-reports.sql` / `place-stats.sql` | chybí (volitelné) | neblokuje katalog |

**Pořadí po schválení:** 1) `promotion-orders.sql` → 2) `promotion-owners.sql` → 3) DB secret = `PAYMENT_SECRET` → 4) Vercel `SUPABASE_SERVICE_ROLE_KEY`.

**Rollback owners:** `drop table public.promotion_audit_log; drop table public.place_owner_claims;`

**Bezpečnost:** anon nesmí číst cizí objednávky; `record_verified_payment` jen `service_role`.  
Izolovaná test DB / Docker v tomto běhu nebyly dostupné — migrace se **neaplikovaly** na produkci.

---

## 6. Resend + doména

| | |
| --- | --- |
| **Kde** | [resend.com](https://resend.com) → Domains + API Keys |
| **Co** | Ověřit DNS domény; `EMAIL_FROM` na ověřené doméně; stejné klíče do Vercel Preview + Production |
| **Lokálně** | `npm run resend:key` → `npm run check:resend` |
| **Ověření** | Poptávka Pro podniky / schválení žádosti dorazí |

**Důležité:** výpadek Resend **nezruší** uloženou poptávku — server nejdřív volá `submit_promotion_inquiry`, e-mail je až potom. Bez RPC (současný stav) se evidence neuloží a zbývá jen e-mailová větev → proto nejdřív migrace RPC.

Trial `onboarding@resend.dev` doručí jen na e-mail Resend účtu.

---

## 7. Comgate sandbox → později live

Integrace v kódu je hotová (`create` / push / `status`). Po doplnění merchant údajů **není potřeba znovu programovat** platební systém — jen env + DB secret + Result URL.

| | |
| --- | --- |
| **Kde** | [portal.comgate.cz](https://portal.comgate.cz) → připojení e-shopu |
| **Sandbox postup** | 1) Preview env: `PAYMENT_PROVIDER=comgate`, `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false`, `SUPABASE_SERVICE_ROLE_KEY` 2) SQL `app.payment_webhook_secret` = stejný secret 3) Result/push URL: `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app/api/payments/webhook?x-vercel-protection-bypass=<BYPASS>` 4) Test platba v Comgate → admin `paid`/`active`, `paymentSource` u testu `gateway-test` |
| **Live** | Jen po sandbox E2E + explicitní `PAYMENTS_LIVE=true` (Production bez toho test neaktivuje) |

Žádné ostré platby v tomto běhu.

---

## 8. Vydání

| | |
| --- | --- |
| **Kde** | GitHub `foodgo-launch-preview` → `main` (PR), Vercel Production |
| **Až když** | Kroky 1–2 hotové; SQL RPC + Auth redirects; smoke Preview/Production; platby odděleně (7) |
| **Rollback** | Vercel → předchozí Production → Promote |

---

## Co už není ruční technická překážka

Obnova hostitele Supabase (projekt znovu běží), mapa, katalog 775 souřadnic, Comgate kód (create/push/status), auto-aktivace s oddělením test/live, CSV fakturace, SQL kontrakty, schema check včetně propagace/RPC, Preview deploy pipeline.
