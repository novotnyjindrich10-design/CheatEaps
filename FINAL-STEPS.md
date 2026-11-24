# FoodGo 1.0 — co udělat po návratu

Větev: `foodgo-launch-preview`.  
SQL ke schválení: `supabase/promotion-apply-missing.sql`.  
Izolovaný integrační test: `node scripts/test-promotion-migration-isolated.mjs` (**OK** na Docker Postgres 16).

---

## A. Hotové a ověřené

- Katalog, mapa, filtry; Playwright **38/38**; unit **375/375**.
- Auth cookies + `next=`; Comgate kód; `PAYMENTS_LIVE` false.
- **`promotion-apply-missing.sql` otestováno izolovaně** (2× apply, zachování dat, RLS, RPC grants, zákaz aktivace bez admina, `record_verified_payment` neaktivuje).
- `sb_publishable_` live OK (apikey-only). `sb_secret_` live probe **přeskočen** — chybí lokální `SUPABASE_SERVICE_ROLE_KEY`.
- HTML e-maily, právní stránky, security headers, produktové události.
- Session API nově vrací `supabaseHost` (bez tajemství) pro kontrolu Preview vs Production.
- Rollback dokumentace: bezpečný = drop funkcí; drop owners tabulek **smaže claims/audit vzniklé po migraci**.

---

## B. Čeká na konfiguraci

| Co | Čeká na |
| --- | --- |
| Evidence poptávek na ostrém projektu | schválení + Run SQL na `pcptzyfoojmnspumcmsi` |
| Webhook úhrady | `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`) + DB `app.payment_webhook_secret` |
| E-maily | Resend |
| Comgate create | merchant + secret + sandbox |
| Live ověření `sb_secret_` | doplnit secret do lokálního `.env` → `node scripts/probe-supabase-secret-compat.mjs` |

---

## C. Tvůj ruční zásah

### C0. Záloha před SQL (tarif Free / Pro)

1. [Project](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi) → **Database** → **Backups**.
2. **Free:** denní zálohy obvykle **nejsou** / omezené — před migrací udělej ruční export:
   - SQL Editor: `select * from public.promotion_orders;` (+ `promotion_payment_events` pokud něco je)
   - nebo Table Editor → Export CSV u kritických tabulek (`profiles` jen pokud potřebuješ)
3. **Pro / Team:** ověř **Point-in-time recovery (PITR)** / Daily backups → zapiš čas před Run.
4. Obnova: Dashboard → Backups → Restore (PITR na čas před migrací), nebo import CSV/SQL exportu. Restore přepíše DB — nejdřív si ověř, že restore bod existuje.

### C1. Supabase SQL (až schválíš)

1. Záloha (C0).
2. SQL Editor → celý `supabase/promotion-apply-missing.sql` → **Run**.
3. `node scripts/check-supabase-schema.mjs` → RPC PRESENT.
4. Preview: poptávka Pro podniky → `stored: true`.

**Bezpečný rollback:** jen drop trigger/funkcí (hlavička SQL).  
**Nedropuj** `promotion_orders`. Owners tabulky dropuj jen prázdné / po schválení ztráty claims.

### C2. Auth redirects

[URL Configuration](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration)

- Site URL: `https://cheat-eaps.vercel.app`
- Redirects: Production + Preview `/nove-heslo` + localhost (viz dříve)

### C3. Vercel env

[Environment Variables](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables)

| Proměnná | Odkud | Typ | Preview | Production | Redeploy |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Project URL | Secret | ano | ano | ano |
| `SUPABASE_ANON_KEY` | `sb_publishable_…` | Secret | ano | ano | ano |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | **Secret** | ano | ano | ano |
| `PUBLIC_SITE_URL` | Preview alias / Production origin | Config | **doplň** | ano | ano |
| Resend trio | resend.com | Secret/Config | ano | ano | ano |
| Comgate + `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false` | portal.comgate.cz | Secret/Config | sandbox | live až později | ano |

Ověření hostitele po deployi: `GET /api/auth/session` → pole `supabaseHost`.

### C4. Oddělení Preview / Production (doporučení)

**Stav:** Preview i Production mají `SUPABASE_URL` + `SUPABASE_ANON_KEY`. Lokální `.env` míří na `pcptzyfoojmnspumcmsi.supabase.co`. Tajné hodnoty Vercel CLI nestáhne — po deployi porovnej `supabaseHost` na Preview vs Production. Pokud sedí stejný host, **sdílíte jednu DB** (riziko: Preview poptávky/testy v ostrých datech).

**Bezpečné oddělení:**
1. Nový Supabase projekt např. `foodgo-preview`.
2. Na Preview Vercel nastav `SUPABASE_URL` / `ANON` / `SERVICE_ROLE` jen z preview projektu.
3. Production nech na `pcptzyfoojmnspumcmsi`.
4. SQL migrace nejdřív na preview projektu, pak teprve Production po schválení.
5. Auth Redirect URLs pro oba projekty zvlášť.

---

## D. Provozovatel

`operator.js`, právní texty, Comgate účet, vlastní doména, merge → main.

---

## E. Blokery / limity tohoto běhu

- Produkční SQL **nespuštěno** (čeká schválení).
- Interaktivní mobilní Preview v prohlížeči agenta: **Vercel Deployment Protection → login** (share link 403). Mobil ověřen Playwright 390 px + `vercel curl` HTML.
- Live `sb_secret_` neověřen (klíč není v lokálním `.env`).
- `launch:check` BLOCKED na `operator-identity`.

---

## Preview URL

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app

## Aktivace po platbě (ověřeno v kódu + izolované DB)

1. `record_verified_payment` / `applyPayment` → jen `payment_status=paid`, **ne** `active`.
2. `payments.js` → `mayActivateFromComgate` (blokuje test na live / live bez `PAYMENTS_LIVE`).
3. Při průchodu → `activateAfterPaid` → `applyAdminAction(..., 'activate')` (vyžaduje paid + placeId).
4. Return URL aktivaci **nedělá**.
