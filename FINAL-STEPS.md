# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
SQL ke schválení na současné produkci: `supabase/promotion-apply-missing.sql`.  
Izolovaný test: `node scripts/test-promotion-migration-isolated.mjs`.

Tajné hodnoty sem nepatří.

---

## A. Kompletně dokončené funkce

Ověřeno v tomto sprintu, pokud není u položky jiná poznámka.

- Katalog 775 podniků, filtry, detail, SEO prerender, stránka 404.
- Mapa: barevné značky podle kategorie, karta podniku (foto, cena, hodnocení, adresa, detail, navigace), clustering, GPS v prohlížeči, výběr se seznamem, popisky od zoomu 16 bez překryvu, větší plocha mapy, atribuce OpenFreeMap.
- Účty: registrace, přihlášení, odhlášení, obnova hesla, session v httpOnly cookie, návrat přes `next`.
- Poptávka propagace ukládá cenu na serveru: START 99 Kč, PLUS 199 Kč, PREMIUM 399 Kč. Roční období je 10× měsíční cena, 365 dní, bez automatického obnovení.
- Přístupový klíč poptávky jde v hlavičce `x-foodgo-order-key`, ne v URL.
- Comgate: create, návrat z brány nic neaktivuje, webhook ověří `/status`, částku a měnu, opakovaný webhook je idempotentní. Když se po zapsané úhradě aktivace nepovede, webhook vrátí 503 a jde ho zopakovat.
- Ostré platby zůstávají vypnuté, dokud není `PAYMENTS_LIVE=true`. Testovací platba na produkci reklamu nezapne.
- SQL: `submit` / `read` / `record_verified_payment` / `activate_verified_promotion` jen pro `service_role`. Anon jimi neobejde rate limit. Limit 3 poptávky na e-mail za hodinu je i v databázi.
- Comgate secret se do databáze neukládá.
- Žádost o vlastnictví: uživatel vidí jen svou, schválit ji může admin a ne sám sebe. Rozhraní je v `/admin/propagace`.
- Běžný uživatel si přes profil nezapne `is_admin`.
- E-mail selže, objednávka v evidenci zůstane.
- Právní stránky jsou pracovní návrhy. Spuštění obchodu dál blokuje prázdná identita provozovatele.
- Unit testy po úpravách: **376/376**. Izolovaný Postgres 16: apply, druhý běh, zachování dat, dump/restore, rollback funkcí, bootstrap prázdné databáze se syntetickým seedem.

---

## B. Funkce čekající jen na externí konfiguraci

| Funkce | Co doplnit | Proměnná | Kde | Tajné | Prostředí | Redeploy |
| --- | --- | --- | --- | --- | --- | --- |
| Evidence poptávek na produkci | SQL níže v C1 | — | Supabase SQL Editor | ne | Production po schválení | ne |
| Preview databáze | nový projekt `foodgo-preview` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel → Preview | URL ne, klíče ano | jen Preview | ano |
| Webhook úhrady | Comgate merchant + secret + service role | `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel | ano | Preview sandbox, Production až později | ano |
| E-maily | Resend + ověřená doména | `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL` | Vercel | klíč ano | obě, až bude doména | ano |
| Auth odkazy | Site URL a redirecty | — | Supabase → Authentication → URL Configuration | ne | každý projekt zvlášť | ne |
| Kanonická adresa | vlastní nebo vercel origin | `PUBLIC_SITE_URL` | Vercel | ne | Preview i Production | ano |
| Live ověření `sb_secret_` | secret do lokálního `.env`, ne do gitu | `SUPABASE_SERVICE_ROLE_KEY` | jen tvůj počítač | ano | testovací projekt, ne produkční secret na Preview | ne |

Ceny v UI, SQL a API jsou stejné. Roční balíček, pokud ho formulář nabídne, stojí desetinásobek měsíční ceny a trvá 365 dní. Automatické obnovení není.

---

## C. Tvoje ruční úkoly

### C0. Záloha před produkčním SQL

1. Otevři [projekt](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi) → **Database** → **Backups**.
2. Na Free tarifu denní záloha často není. V SQL Editoru si ulož výpis `select * from public.promotion_orders;` a `select * from public.promotion_payment_events;`.
3. Na Pro ověř, že existuje bod obnovy, a zapiš čas.
4. Obnova přepíše databázi. Nejdřív zkontroluj, že bod existuje.

Tajné: ne. Prostředí: Production. Závisí na: ničem. Redeploy: ne. Náklad: 0, pokud nezměníš tarif.

### C1. Produkční SQL — až schválíš

1. Záloha z C0.
2. [SQL Editor](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/sql/new) → vlož celý `supabase/promotion-apply-missing.sql` → **Run**.
3. Když některý existující řádek poruší nové omezení, migrace se vrátí a vypíše jen počet, ne osobní údaje. Data se nesmažou.
4. `node scripts/check-supabase-schema.mjs` má u RPC ukázat PRESENT. Skript funkce nespouští.
5. Preview poptávka má vrátit `stored: true` až ve chvíli, kdy Preview míří na databázi, kde SQL běží.

Ověření: v SQL Editoru `select has_function_privilege('anon', 'public.submit_promotion_inquiry(jsonb,text,text)', 'execute');` musí být false.

Rollback: sekce G. Secret platební brány do databáze nezadávej.

### C2. Oddělit Preview od produkce

1. [Nový projekt](https://supabase.com/dashboard/new/_) pojmenuj `foodgo-preview`. Do produkčního projektu nic nekopíruj.
2. Na preview projektu spusť `PREVIEW_DATABASE_URL=<URI z Database settings> node scripts/bootstrap-preview-database.mjs`. URI je tajné. Když `psql` nemáš, soubory ze skriptu spusť v SQL Editoru preview projektu v uvedeném pořadí. Seed jsou jen adresy `@example.com`.
3. [Environment Variables](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables): u **Preview** přepiš `SUPABASE_URL`, `SUPABASE_ANON_KEY` (`sb_publishable_…`) a `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`) hodnotami z foodgo-preview. Production nech na `pcptzyfoojmnspumcmsi`.
4. `PUBLIC_SITE_URL` na Preview nastav na přesný preview origin. Na Production na `https://cheat-eaps.vercel.app`, dokud není vlastní doména.
5. Redeploy Preview.
6. Ověření: `GET /api/auth/session` na Preview a na Production. Pole `supabaseHost` se musí lišit.

Náklad: Supabase Free, pokud se vejdeš do limitu. Závisí na: novém projektu. Tajné: ano, klíče a URI.

### C3. Auth redirects

Na **každém** Supabase projektu: [URL Configuration](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration) a stejná obrazovka u foodgo-preview.

- Site URL: produkční origin, u preview projektu preview origin.
- Redirect URLs: `https://cheat-eaps.vercel.app/nove-heslo`, preview origin `/nove-heslo`, `http://127.0.0.1:5173/nove-heslo`, `http://localhost:5173/nove-heslo`.

Tajné: ne. Redeploy: ne. Náklad: 0.

### C4. Resend

1. [resend.com](https://resend.com) → API key.
2. Domains → přidej doménu, DNS záznamy, které Resend ukáže.
3. Vercel: `RESEND_API_KEY` (tajné), `EMAIL_FROM` na adrese ověřené domény, `INQUIRY_TO_EMAIL` na schránku provozovatele.
4. Supabase Auth SMTP, až budeš chtít maily z Auth přes vlastní doménu: Authentication → Emails → SMTP. Host a heslo dá Resend v dokumentaci SMTP. Do té doby může Auth používat výchozí mailer Supabase, který má vlastní limity.
5. Ověření: poptávka na Preview, v Resend logu doručení. Když klíč chybí, poptávka se stejně uloží, pokud databáze běží.

Redeploy: ano. Náklad: Resend free tier do jeho limitu. Závisí na: vlastní doméně pro doručení mimo účet Resend.

### C5. Comgate sandbox

1. [portal.comgate.cz](https://portal.comgate.cz) → e-shop, Merchant ID a Secret.
2. Result URL: `https://<host>/api/payments/webhook?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>`.
3. Vercel Preview: `PAYMENT_PROVIDER=comgate`, `PAYMENT_MERCHANT_ID`, `PAYMENT_SECRET`, `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
4. Ověření: `GET /api/payments/status` → `enabled: true` a sandbox. Po testovací platbě je objednávka `paid` a `active` jen mimo produkci. Na Production stejný test reklamu nezapne.
5. `PAYMENTS_LIVE=true` až po tomto testu a po schválení provozovatele.

Tajné: secret, bypass. Redeploy: ano. Náklad: podle ceníku Comgate, sandbox bez ostrého inkasa.

### C6. Live probe tajného klíče

Do lokálního `.env` dej `SUPABASE_SERVICE_ROLE_KEY` z **preview** projektu, ne z produkce. Pak `node scripts/probe-supabase-secret-compat.mjs`. Výstup nesmí vypsat klíč.

---

## D. Úkoly dospělého provozovatele

1. Živnost a skutečné IČO, sídlo, e-mail. Nic z toho v kódu nevymýšlej.
2. Doplnit veřejné údaje do `src/constants/operator.js`.
3. Nechat zkontrolovat stránky obchodních podmínek a ochrany osobních údajů. Jsou pracovní návrhy.
4. Založit Comgate a projít C5.
5. Schválit produkční SQL (C1) a oddělení databází (C2).
6. Až sandbox projde, teprve rozhodnout o `PAYMENTS_LIVE=true` a merge do `main`.

---

## E. Zbývající technické blokery

- Produkční SQL není spuštěné. Bez schválení ho nespouštěj.
- Preview i Production pořád můžou mířit na jeden Supabase projekt, dokud neuděláš C2. Lokální `.env` na produkční projekt je varování, ne oprava.
- `launch:check` je BLOCKED na prázdné identitě provozovatele a na neschválených právních textech.
- Comgate sandbox, Resend doručení a live `sb_secret_` jsou **NOT TESTED**, dokud nejsou klíče.
- Interaktivní Preview v prohlížeči naráží na Vercel login. Lokální testy to nenahrazují.
- Automatická fronta opakování e-mailů není. Neúspěšný mail objednávku nesmaže; stav je v administraci.
- Nový Supabase projekt `foodgo-preview` v tomhle běhu nevznikl. Připravený je jen lokální bootstrap.

Ostrý provoz z toho neplyne.

---

## F. Postup vydání

1. C2, aby Preview nepsal do produkce.
2. C1 na produkci až po záloze a po zeleném izolovaném testu.
3. C3, C4, C5.
4. `npm run launch:check -- --offline` musí skončit bez FAIL. BLOCKED na provozovateli smí zmizet až po doplnění `operator.js` a schválení textů.
5. Ruční průchod Preview: úvod, výsledky, mapa, detail, Pro podniky, účet, administrace.
6. `GET /api/payments/status` na produkci nesmí hlásit ostré platby.
7. Merge `foodgo-launch-preview` → `main` jen po výslovném schválení. Force-push na main ne.

Příkaz před vydáním: `npm run launch:check -- --offline`.  
Databázi ověří zvlášť: `node scripts/test-promotion-migration-isolated.mjs`.

---

## G. Návrat při problému

**Web:** Vercel → Deployments → předchozí Production deployment → Promote. Databázi to nevrátí.

**SQL funkcí** (objednávky zůstanou):

```sql
drop trigger if exists guard_promotion_order on public.promotion_orders;
drop function if exists public.guard_promotion_order();
drop function if exists public.submit_promotion_inquiry(jsonb, text, text);
drop function if exists public.read_promotion_inquiry(text, text);
drop function if exists public.record_verified_payment(text, text, text, text);
drop function if exists public.activate_verified_promotion(text);
drop function if exists public.review_place_owner_claim(uuid, text);
```

`promotion_orders` neshazuj. Tabulky `place_owner_claims` a `promotion_audit_log` shoď jen když jsou prázdné, nebo když schválíš ztrátu žádostí vzniklých po migraci.

**Git:** nový commit, který vrátí kód. Historii na main nepřepisuj.

---

## Preview URL

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app

Po pushi téhle větve vznikne nový deployment. Ověř `supabaseHost` až po C2.
