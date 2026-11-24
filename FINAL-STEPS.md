# FoodGo 1.0 — co udělat po návratu

Větev: `foodgo-launch-preview`. Detail historie: `FOODGO-LAUNCH.md`.  
SQL ke schválení: `supabase/promotion-apply-missing.sql`.

---

## A. Hotové a ověřené (kód)

- Katalog 775 podniků, mapa, filtry, mobilní E2E (Playwright 38).
- Auth session přes serverové cookies; návrat přes `next=` (open redirect blokován).
- Comgate create/push/status v kódu; `PAYMENTS_LIVE` zůstává false.
- Gap-fill SQL připravený (RPC + owners) — **nespouštěn na produkci**.
- Kompatibilita `sb_publishable_` / `sb_secret_` (klíče jen v `apikey`).
- HTML e-mailové šablony FoodGo + text fallback; poptávka se při výpadku mailu nesmaže, pokud je uložená.
- Stránky: `/o-foodgo`, `/kontakt`, `/cookies`, `/reklamni-zvyrazneni` + odkazy v patičce.
- Security headers ve `vercel.json` (nosniff, frame deny, referrer, permissions).
- Produktové události v sessionStorage (bez externí analytiky).
- CSV export objednávek v admin propagaci.
- Unit/SQL kontrakty zelené v posledním běhu sprintu (viz report).

---

## B. Implementováno, čeká na konfiguraci

| Co | Čeká na |
| --- | --- |
| Evidence poptávek end-to-end | spuštění `promotion-apply-missing.sql` |
| Webhook zápis úhrady | `SUPABASE_SERVICE_ROLE_KEY` + `app.payment_webhook_secret` |
| Odesílání e-mailů | Resend API + ověřená doména |
| Comgate create redirect | merchant ID + secret + sandbox flag |
| place-stats / loyalty / reports | volitelné SQL soubory |

---

## C. Tvůj ruční zásah (teď)

### C1. Supabase SQL (až schválíš)

1. [Supabase Dashboard](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi) → **Database** → ověř Backups/PITR.
2. → **SQL Editor** → New query.
3. Vlož celý soubor `supabase/promotion-apply-missing.sql` → **Run**.
4. Ověření: lokálně `node scripts/check-supabase-schema.mjs` → RPC PRESENT; owners EXISTS.
5. Redeploy Preview není nutný pro SQL; API začne RPC používat hned.

**Rollback:** komentář v hlavičce SQL souboru (drop funkcí + 2 owners tabulek; `promotion_orders` nedropuj).

### C2. Supabase Auth URL

1. [URL Configuration](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration)
2. **Site URL:** `https://cheat-eaps.vercel.app`
3. **Redirect URLs:**
   - `https://cheat-eaps.vercel.app/nove-heslo`
   - `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app/nove-heslo`
   - `http://127.0.0.1:5173/nove-heslo`
   - `http://localhost:5173/nove-heslo`
4. Ověření: obnova hesla → `/nove-heslo`. Redeploy ne.

### C3. Vercel env

[Project cheat-eaps → Settings → Environment Variables](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables)

| Proměnná | Hodnota odkud | Typ | Preview | Production | Redeploy |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Project URL | Secret/Config | ano | ano | ano po změně |
| `SUPABASE_ANON_KEY` | API Keys → **publishable** `sb_publishable_…` | Secret | ano | ano | ano |
| `SUPABASE_SERVICE_ROLE_KEY` | API Keys → **secret** `sb_secret_…` | **Secret** (jen server) | ano | ano | ano |
| `PUBLIC_SITE_URL` | `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app` (Preview) / `https://cheat-eaps.vercel.app` (Prod) | Config | ano | ano | ano |
| `RESEND_API_KEY` | resend.com → API Keys | Secret | ano | ano | ano |
| `EMAIL_FROM` | ověřená doména, např. `FoodGo Brno <…@domena.cz>` | Config | ano | ano | ano |
| `INQUIRY_TO_EMAIL` | tvoje schránka | Config | ano | ano | ano |
| `PAYMENT_PROVIDER` | `comgate` | Config | sandbox | později | ano |
| `PAYMENT_MERCHANT_ID` | portal.comgate.cz | Secret | sandbox | později | ano |
| `PAYMENT_SECRET` | Comgate secret (≥16) | Secret | sandbox | později | ano |
| `PAYMENTS_SANDBOX_OUTBOUND` | `true` | Config | ano | ne | ano |
| `PAYMENTS_LIVE` | `false` | Config | ano | ano (nechat false) | ano |

Ověření: `GET /api/auth/session` → `configured:true`; `GET /api/payments/status` → `PAYMENTS_LIVE` false / inquiry dokud chybí merchant.

**Nikdy** nedávej service/secret klíč do `VITE_*` ani do Gitu.

### C4. Resend

1. [resend.com](https://resend.com) → Domains → ověř DNS.
2. API Key → Vercel `RESEND_API_KEY`.
3. `EMAIL_FROM` na ověřené doméně.
4. Ověření: `npm run check:resend` (až bude klíč lokálně) / odeslání poptávky na Preview.

---

## D. Dospělý provozovatel

1. Doplnit `src/constants/operator.js`: `legalName`, `ico`, `street`, `city`, `postalCode`, `email`, DPH (`vatStatus`…).
2. Nechat zkontrolovat `/obchodni-podminky` a `/ochrana-osobnich-udaju` (jsou kostry).
3. Comgate účet + sandbox E2E, teprve pak `PAYMENTS_LIVE`.
4. Vlastní doména: nastav `PUBLIC_SITE_URL`, Auth redirects, Resend FROM, Comgate return/webhook URL; kód hardcoded cheat-eaps jen jako fallback v `site.js`.
5. Merge `foodgo-launch-preview` → `main` a Production deploy **až po A–D**.

---

## E. Zbývající technické / záměrně neřešené

- Produkční SQL ještě **neběží** (čeká schválení).
- Docker/izolovaná DB na tomto stroji nebyla dostupná — migrace jen offline kontrakt.
- Loyalty / place-reports / place-stats SQL volitelné.
- Ostré e-maily a ostré platby záměrně neproběhly.
- `launch:check` zůstane BLOCKED na `operator-identity`, dokud není OPERATOR.

---

## Preview URL

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app
