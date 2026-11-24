# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
SQL ke schválení na současné produkci: `supabase/promotion-apply-missing.sql`, potom `supabase/place-overrides.sql`.  
Izolovaný test: `node scripts/test-promotion-migration-isolated.mjs`.

Tajné hodnoty sem nepatří.

---

## A. Kompletně dokončené funkce

- Katalog 775 podniků, filtry, detail, SEO prerender, stránka 404.
- Mapa: barevné značky podle kategorie, karta podniku, clustering, GPS, synchronizace se seznamem, popisky od zoomu 16 bez překryvu, větší plocha mapy se zámkem scrollu stránky, atribuce OpenFreeMap.
- Účty: registrace, přihlášení, odhlášení, obnova hesla, session v httpOnly cookie, návrat přes `next`.
- Podnikatelský účet: stav poptávky přes kód + klíč v hlavičce, tlačítko platby když je Comgate zapojený, další poptávka, kontakt na podporu.
- Ceny START 99 / PLUS 199 / PREMIUM 399 Kč. Roční = 10× měsíční, 365 dní, bez automatického obnovení.
- Propagace se po expiraci sama přestane zobrazovat podle `endsAt` při čtení. Cron není nutný.
- Administrace: podniky (hledání, skrytí, úprava jména/adresy/kategorie), hlášení chyb, žádosti o katalog, propagace + ownership claims, recenze/odměny, CSV export poptávek, fakturační podklad.
- `/api/health` bez tajných hodnot.
- SQL: `submit` / `read` / `record_verified_payment` / `activate_verified_promotion` jen pro `service_role`.
- Preview bootstrap odmítne produkční projekt a umí i `place-overrides.sql`.
- Právní stránky jsou pracovní návrhy. Spuštění obchodu dál blokuje prázdná identita provozovatele.

---

## B. Funkce čekající jen na externí konfiguraci

| Funkce | Co doplnit | Proměnná | Kde | Tajné | Prostředí | Redeploy |
| --- | --- | --- | --- | --- | --- | --- |
| Evidence poptávek | SQL C1 | — | Supabase SQL Editor | ne | Production po schválení | ne |
| Přepisy katalogu | SQL C1b | — | Supabase SQL Editor | ne | Production + Preview | ne |
| Preview databáze | projekt `foodgo-preview` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel → Preview | URL ne, klíče ano | jen Preview | ano |
| Webhook úhrady | Comgate + service role | `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | ano | Preview sandbox, Production později | ano |
| E-maily | Resend + doména | `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL` | Vercel | klíč ano | obě | ano |
| Auth odkazy | Site URL a redirecty | — | Supabase Auth URL Configuration | ne | každý projekt | ne |
| Kanonická adresa | origin | `PUBLIC_SITE_URL` | Vercel | ne | Preview i Production | ano |

---

## C. Tvoje ruční úkoly — přesné pořadí

Dělej kroky **v tomto pořadí**. Další programování před tím není potřeba.

### 1. Oddělit Preview od produkce (povinné před dalším testováním)

1. Otevři [supabase.com/dashboard/new](https://supabase.com/dashboard/new/_) → vytvoř projekt `foodgo-preview`. Do produkce nic nekopíruj.
2. V Preview projektu: **Project Settings → Database → Connection string (URI)**.
3. Lokálně: `PREVIEW_DATABASE_URL=<URI> node scripts/bootstrap-preview-database.mjs`  
   Když chybí `psql`, v SQL Editoru preview spusť soubory v pořadí ze skriptu.
4. Z Preview projektu zkopíruj URL a klíče `sb_publishable_…` / `sb_secret_…`.
5. [Vercel env](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables): u **Preview** přepiš `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Production nech na `pcptzyfoojmnspumcmsi`.
6. Preview: `PUBLIC_SITE_URL` = přesný preview origin. Production: `https://cheat-eaps.vercel.app` (dokud není vlastní doména).
7. Redeploy Preview.
8. Ověření: `GET /api/health` a `GET /api/auth/session` — Preview a Production musí mít jiný `supabaseHost`.

Tajné: ano. Náklad: Supabase Free. Redeploy: ano.

### 2. Auth redirects na obou projektech

Na každém Supabase: Authentication → URL Configuration.

- Site URL = origin daného prostředí.
- Redirect URLs: produkční `/nove-heslo`, preview `/nove-heslo`, `http://127.0.0.1:5173/nove-heslo`, `http://localhost:5173/nove-heslo`.

Tajné: ne. Redeploy: ne.

### 3. Záloha a produkční SQL (až schválíš)

1. [Backups](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi) nebo export `promotion_orders` a `promotion_payment_events`.
2. SQL Editor → celý `supabase/promotion-apply-missing.sql` → **Run**.
3. Hned potom `supabase/place-overrides.sql` → **Run** (stejně i na foodgo-preview, pokud jsi nepoužil bootstrap).
4. Ověření: `has_function_privilege('anon', 'public.submit_promotion_inquiry(jsonb,text,text)', 'execute')` = false.  
   `node scripts/check-supabase-schema.mjs` u RPC ukáže PRESENT.

Tajné: ne. Redeploy: ne. Náklad: 0.

### 4. Resend

1. [resend.com](https://resend.com) → API key.
2. Domains → DNS podle Resend.
3. Vercel: `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL`.
4. Volitelně Supabase Auth SMTP přes Resend.
5. Ověření: poptávka na Preview, doručení v Resend logu.

Tajné: klíč ano. Redeploy: ano.

### 5. Comgate sandbox

1. [portal.comgate.cz](https://portal.comgate.cz) → Merchant ID + Secret.
2. Result URL: `https://<preview-host>/api/payments/webhook?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>`.
3. Vercel Preview: `PAYMENT_PROVIDER=comgate`, `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
4. Ověření: `GET /api/payments/status` → `enabled: true`, `live: false`. Platba z `/pro-podniky/ucet`. Na Production test reklamu nezapne.
5. `PAYMENTS_LIVE=true` až po schválení provozovatele.

Tajné: ano. Redeploy: ano.

### 6. Live probe tajného klíče (jen Preview)

Do lokálního `.env` dej `SUPABASE_SERVICE_ROLE_KEY` z foodgo-preview. Spusť `node scripts/probe-supabase-secret-compat.mjs`.

### 7. Provozovatel a právo

1. Doplnit IČO, sídlo, e-mail do `src/constants/operator.js`.
2. Nechat zkontrolovat Obchodní podmínky a Ochrana osobních údajů.
3. Až bude hotové, nastavit schválení podle `launch:check` (`OPERATOR_LEGAL_APPROVED` / doplněný operator).

### 8. Před vydáním

1. `npm run launch:check -- --offline` bez FAIL.
2. Ruční průchod Preview: úvod, výsledky, mapa, detail, Pro podniky, účet podniku, admin.
3. `GET /api/payments/status` na produkci nesmí hlásit ostré platby.
4. Merge `foodgo-launch-preview` → `main` jen po výslovném schválení.

---

## D. Úkoly dospělého provozovatele

Viz C7 a rozhodnutí o `PAYMENTS_LIVE` + merge do `main`.

---

## E. Zbývající technické blokery

- Produkční SQL a place-overrides nejsou spuštěné bez tvého souhlasu.
- Preview a Production sdílejí Supabase, dokud neuděláš krok 1 v části C.
- Comgate, Resend a live `sb_secret_` jsou NOT TESTED bez klíčů.
- Interaktivní Preview může blokovat Vercel Authentication.
- Automatická fronta opakování e-mailů není. Selhání mailu objednávku nesmaže.
- Ostré platby musí zůstat vypnuté.

---

## F. Postup vydání

1 → 2 → 3 → 4 → 5 → 7 → 8 z části C.

Příkaz: `npm run launch:check -- --offline`.  
Databáze: `node scripts/test-promotion-migration-isolated.mjs`.

---

## G. Návrat při problému

**Web:** Vercel → Deployments → předchozí Production → Promote.

**SQL funkcí** (řádky objednávek zůstanou):

```sql
drop trigger if exists guard_promotion_order on public.promotion_orders;
drop function if exists public.guard_promotion_order();
drop function if exists public.submit_promotion_inquiry(jsonb, text, text);
drop function if exists public.read_promotion_inquiry(text, text);
drop function if exists public.record_verified_payment(text, text, text, text);
drop function if exists public.activate_verified_promotion(text);
drop function if exists public.review_place_owner_claim(uuid, text);
```

`place_overrides` shoď jen když schválíš ztrátu přepisů:

```sql
drop view if exists public.place_overrides_public;
drop table if exists public.place_overrides;
```

**Git:** nový commit, který vrátí kód. Historii na main nepřepisuj.

---

## Preview URL

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app

Po pushi vznikne nový deployment. Ověř `supabaseHost` až po kroku C1.
