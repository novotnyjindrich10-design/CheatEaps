# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Stav po commitu `c3a8162` (+ případný follow-up commit s veřejným fallbackem `/api/place-overrides`).  
Větev: `foodgo-launch-preview`.  
**Vývojová fáze je ukončená.** Další práce je konfigurace, schválení a vydání — ne další programování.

Tajné hodnoty sem nepatří.

---

## HOTOVO

Technicky dokončeno a ověřeno v kódu / lokálně / Preview API (pokud není u položky jinak).

- Katalog 775 podniků, filtry, detail, SEO prerender, 404.
- Mapa: kategorie, karta (detail + navigace), clustering, GPS, synchronizace se seznamem, popisky od zoomu 16, větší plocha, OpenFreeMap. Lokální Playwright mapa **7/7**. Interaktivní klik ověřen v prohlížeči.
- Účty: registrace, přihlášení, odhlášení, obnova hesla, session cookie, `next`.
- Objednávky / poptávky: serverová cena START 99 / PLUS 199 / PREMIUM 399 Kč, klíční = 10×, bez auto-obnovení, klíč v hlavičce `x-foodgo-order-key`.
- Platby: Comgate create/return/webhook/idempotence/aktivace po ověření; `PAYMENTS_LIVE` výchozí vypnuté. Preview: `enabled: false`, `paymentsLive: false`.
- Administrace: podniky (přepisy), hlášení, žádosti, propagace + claims, recenze/odměny, CSV, fakturační podklad.
- Bezpečnost RPC: submit/read/payment/activate jen `service_role`; claims bez self-approve; `is_admin` nelze eskalovat profilem.
- Preview bootstrap + ochrana proti produkčnímu refu; syntetický seed.
- `/api/health` bez tajných hodnot.
- `launch:check --offline` po `c3a8162`: **overall BLOCKED** jen kvůli právnímu schválení / identitě provozovatele — ne kvůli chybějícímu kódu. Unit/lint/build/catalog **PASS**. Ostré platby **PASS** (vypnuté).

Preview deployment (Ready, ~3 min po pushi `c3a8162`):

- Alias: https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app  
- Poslední Ready URL: https://cheat-eaps-5okf1ezzs-jindrichcompany.vercel.app  
- Ověřeno přes `vercel curl`: `/api/health` ok, `/api/payments/status` platby vypnuté, `/api/auth/session` `configured: true` (zatím host `pcptzyfoojmnspumcmsi` — sdílená DB), `/api/sponsorships` ok.

SQL soubory připravené ke schválení: `supabase/promotion-apply-missing.sql`, `supabase/place-overrides.sql`.

---

## ZBÝVÁ NAPROGRAMOVAT

**Nic kritického.** Vývojová fáze končí.

Volitelné (neblokuje konfiguraci ani vydání po schválení):

- Fronta opakování neúspěšných e-mailů (selhání mailu objednávku nesmaže; stav je v adminu).
- Marketingová složka textů (až po konfiguraci, nic neposílat automaticky).

---

## ZBÝVÁ RUČNĚ NASTAVIT

Dělej **v tomto pořadí**. Po kroku 1 můžeš bezpečně testovat Preview bez zápisu do produkční DB.

### 1. Oddělit Preview od produkce

1. [Nový Supabase projekt](https://supabase.com/dashboard/new/_) pojmenuj `foodgo-preview`. Do produkce nic nekopíruj.  
2. Preview → **Project Settings → Database → URI**.  
3. Lokálně: `PREVIEW_DATABASE_URL=<URI> node scripts/bootstrap-preview-database.mjs`  
   Bez `psql`: v SQL Editoru preview spusť soubory v pořadí ze skriptu.  
4. Z preview zkopíruj URL + `sb_publishable_…` + `sb_secret_…`.  
5. [Vercel env](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables): u **Preview** přepiš `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Production nech na `pcptzyfoojmnspumcmsi`.  
6. Preview: `PUBLIC_SITE_URL` = přesný preview origin. Production: `https://cheat-eaps.vercel.app` (dokud není vlastní doména).  
7. Redeploy Preview.  
8. Ověření: `GET /api/auth/session` — Preview a Production mají **různý** `supabaseHost`.

Tajné: ano. Redeploy: ano. Náklad: Supabase Free.

### 2. Auth redirects (oba projekty)

[Produkční URL Configuration](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration) a stejná obrazovka u `foodgo-preview`.

- Site URL = origin daného prostředí.  
- Redirect URLs: `https://cheat-eaps.vercel.app/nove-heslo`, preview `/nove-heslo`, `http://127.0.0.1:5173/nove-heslo`, `http://localhost:5173/nove-heslo`.

Tajné: ne. Redeploy: ne.

### 3. Záloha + produkční SQL (až schválíš)

1. [Backups](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi) nebo export `promotion_orders` / `promotion_payment_events`.  
2. [SQL Editor](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/sql/new) → celý `supabase/promotion-apply-missing.sql` → **Run**.  
3. Hned `supabase/place-overrides.sql` → **Run**.  
4. Ověření:  
   `select has_function_privilege('anon', 'public.submit_promotion_inquiry(jsonb,text,text)', 'execute');` → false.  
   `node scripts/check-supabase-schema.mjs` → RPC PRESENT.

Tajné: ne. Redeploy: ne. Náklad: 0. Comgate secret do DB nedávej.

### 4. Resend

1. [resend.com](https://resend.com) → API key.  
2. Domains → DNS podle Resend.  
3. Vercel: `RESEND_API_KEY` (tajné), `EMAIL_FROM`, `INQUIRY_TO_EMAIL`.  
4. Volitelně Supabase Auth SMTP.  
5. Ověření: poptávka na Preview, doručení v Resend logu.

Redeploy: ano.

### 5. Comgate sandbox

1. [portal.comgate.cz](https://portal.comgate.cz) → Merchant ID + Secret.  
2. Result URL: `https://<preview-host>/api/payments/webhook?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>`.  
3. Vercel Preview: `PAYMENT_PROVIDER=comgate`, `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`.  
4. Ověření: `GET /api/payments/status` → `enabled: true`, `live: false`. Platba z `/pro-podniky/ucet`.  
5. `PAYMENTS_LIVE=true` až po schválení provozovatele.

Redeploy: ano.

### 6. Live probe tajného klíče (jen Preview)

Do lokálního `.env` dej preview `SUPABASE_SERVICE_ROLE_KEY`. Spusť `node scripts/probe-supabase-secret-compat.mjs`.

### 7. Provozovatel a právo

1. Doplnit IČO, sídlo, e-mail do `src/constants/operator.js`.  
2. Nechat zkontrolovat Obchodní podmínky a Ochrana osobních údajů (pracovní návrhy).  
3. Až bude hotové, označ schválení tak, aby `launch:check` přestal hlásit BLOCKED u `legal-approval` / `operator-identity`.

### 8. Před vydáním

1. `npm run launch:check -- --offline` bez FAIL (BLOCKED na právu smí zmizet až po kroku 7).  
2. Ruční průchod Preview: úvod, výsledky, mapa, detail, Pro podniky, účet podniku, admin.  
3. `GET /api/payments/status` na produkci → ostré platby vypnuté.  
4. Merge `foodgo-launch-preview` → `main` **jen po výslovném schválení**. Force-push na main ne.

---

## launch:check (stav po c3a8162)

Příkaz: `npm run launch:check -- --offline`

| Status | Co znamená teď |
| --- | --- |
| **BLOCKED** | `legal-approval` (+ případně prázdná identita provozovatele) — ruční krok 7 |
| **WARNING** | chybí `PUBLIC_SITE_URL`; lokální `.env` míří na produkční Supabase — kroky 1 a 6 |
| **NOT TESTED** | Resend API, Comgate sandbox, live `sb_secret_`, interaktivní Preview login |
| **PASS** | unit, lint, build, catalog, SQL grant kontrakt, `PAYMENTS_LIVE` vypnuté |

Exit code 0 i při BLOCKED (FAIL by ukončil 1). Ostrý provoz z toho neplyne.

Izolovaná DB: `node scripts/test-promotion-migration-isolated.mjs`.

---

## Návrat při problému

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

Přepisy katalogu (jen když schválíš ztrátu):

```sql
drop view if exists public.place_overrides_public;
drop table if exists public.place_overrides;
```

**Git:** nový commit s návratem kódu. Historii na main nepřepisuj.
