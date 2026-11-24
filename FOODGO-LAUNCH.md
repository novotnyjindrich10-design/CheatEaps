# FoodGo 1.0 — Launch příručka

Větev: `foodgo-launch-preview`  
Preview: https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app  
Produkce (neměnit bez schválení): https://cheat-eaps.vercel.app

Tento dokument je jediný „co zbývá udělat“ checklist. Tajné hodnoty do chatu ani do gitu nepatří.

---

## A. Co je hotové a ověřené

| Oblast | Stav |
| --- | --- |
| Katalog 775 podniků, filtry, detail | Ano |
| Mapa Leaflet + OpenFreeMap, clustering, GPS, mobil | Ano (E2E + unit) |
| Souřadnice | **775/775** (4 doplněny z OSM ODbL; Chicken Inn = adresa budovy, provoz ověřit) |
| Comgate create (`/v1.0/create`, prepareOnly) | Ano v kódu |
| Comgate push = secret v těle + ověření `/v1.0/status` | Ano v kódu + unit |
| Return URL neaktivuje | Ano |
| test=true neaktivuje na Production / LIVE | Ano |
| Nezávazná poptávka místo falešného nákupu | Ano |
| Admin CSV export + podklad faktury | Ano |
| SQL `promotion-orders.sql` + `promotion-owners.sql` | Připraveno, **neaplikováno** |
| Ostrá sandbox transakce u Comgate | **Ne** |
| OPERATOR / právní texty | **Prázdné — blokuje launch:check** |

---

## B. Co musí udělat uživatel (ty)

1. Otevřít Preview (Vercel login) a ručně projít: úvod → výsledky → mapa → detail → Pro podniky → účet podniku.  
2. Po doplnění OPERATOR provozovatelem: `npm run launch:check -- --offline` lokálně / na CI.  
3. **Nemergovat** do `main` bez výslovného schválení.

---

## C. Co musí udělat dospělý provozovatel

1. Živnost (obory 56 / 66 / 47 dle plánu) → získat IČO a sídlo.  
2. Doplnit **veřejné** údaje do `src/constants/operator.js` (viz komentář v souboru).  
3. Zkontrolovat Privacy + Terms s právníkem.  
4. Založit Comgate (sekce D).  
5. Nastavit Vercel env (sekce E) a Resend (ověřená doména).  
6. Aplikovat SQL migrace na **test** DB, pak na produkci (sekce F).  
7. Provést sandbox platbu (sekce G).  
8. Teprve pak schválit Production deploy a případně `PAYMENTS_LIVE`.

---

## D. Přesný postup Comgate

### D1. Účet
1. [portal.comgate.cz](https://portal.comgate.cz) → registrace e-shopu (KYC).  
2. Služby → Pokladny / Checkout → připojení e-shopu.  
3. Zkopíruj **Merchant ID** a **Secret** (Shop connection).  
4. Redirect URLs (Result URL / push):  
   `https://<tvůj-host>/api/payments/webhook`  
5. Return URL (paid / cancelled / pending) mohou mířit na `/pro-podniky/ucet` — **neaktivují** reklamu.

### D2. Vercel Authentication vs push
Preview je chráněné SSO. Comgate server se nepřihlásí.  
**Řešení bez vypnutí ochrany celého Preview:**

1. Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation**.  
2. Vygeneruj secret → ulož jako `VERCEL_AUTOMATION_BYPASS_SECRET` (Preview + Production).  
3. Do Comgate Result URL dej:  
   `https://<host>/api/payments/webhook?x-vercel-protection-bypass=<SECRET>`  
   (volitelně `&x-vercel-set-bypass-cookie=true`)  
4. Ověření: `GET /api/payments/status` → `protectionBypassConfigured: true`.

### D3. Env (žádné výmysly)
| Proměnná | Účel |
| --- | --- |
| `PAYMENT_PROVIDER=comgate` | Volba brány |
| `PAYMENT_MERCHANT_ID` | Merchant z portálu |
| `PAYMENT_SECRET` | Secret z portálu (create + push + status) |
| `PAYMENTS_SANDBOX_OUTBOUND=true` | Povolí create s `test=true` |
| `PAYMENTS_LIVE=false` | Dokud neproběhne sandbox E2E |
| `PAYMENTS_TEST_MODE` / `PAYMENT_TEST_SECRET` | Jen Preview interní simulace (≥16 znaků); **ne** na Production |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypass pro Comgate push |

`PAYMENT_WEBHOOK_SECRET` už Comgate nepoužívá. Pokud běží Supabase RPC, nastav `app.payment_webhook_secret` na **stejnou hodnotu jako `PAYMENT_SECRET`**.

### D4. Ověření
- `GET /api/payments/status` → `enabled: true`, `reason: sandbox`  
- Po create: redirect na Comgate  
- Po zaplacení: push → HTTP 200 `OK` → objednávka `paid` + `active` (jen mimo LIVE/Production u test=true)

---

## E. Produkční prostředí

### E1. Env (Production)
Povinné pro free katalog: `PUBLIC_SITE_URL`, Supabase `SUPABASE_URL` + `SUPABASE_ANON_KEY`, service role jen server-side.  
Volitelné: Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL`).  
Platby: viz D3 (+ `PAYMENTS_LIVE` až po G).

### E2. Supabase Auth redirects
Dashboard → Authentication → URL Configuration:  
- Site URL = produkční origin  
- Redirect Allow List: produkce + Preview originy + `/nove-heslo`

### E3. Doména
1. Vercel → Domains → Add  
2. DNS dle instrukcí Vercelu (A/CNAME)  
3. `PUBLIC_SITE_URL=https://tvoje-domena.cz`  
4. Rebuild  
5. Canonical/sitemap berou `PUBLIC_SITE_URL` (`src/constants/site.js` fallback je cheat-eaps.vercel.app)

### E4. SEO
- Preview: runtime `noindex` (`isNonProductionHost`)  
- Production: index po schválení; ověř `robots.txt` + `sitemap.xml`

### E5. Smoke test Production
Úvod → hledání → filtr → mapa → detail → oblíbené → Pro podniky → login → admin (pokud admin).  
`GET /api/payments/status` musí říkat inquiry/enabled podle env.

### E6. Rollback
Vercel → Deployments → předchozí Production → Promote.  
Případně revert merge na `main`. SQL rollback jen se zálohou.

---

## F. Databázové migrace

**Pořadí (nejdřív izolovaný test projekt Supabase):**

1. `supabase/auth-rls.sql` (+ `business-applications.sql` pokud ještě neběží)  
2. `supabase/promotion-orders.sql`  
3. `supabase/promotion-owners.sql` (volitelné — claims + audit)

Pak:  
`alter database postgres set app.payment_webhook_secret = '<PAYMENT_SECRET>';`

**Rollback owners:**  
`drop table if exists public.promotion_audit_log;`  
`drop table if exists public.place_owner_claims;`

**Produkci nespouštěj bez schválení a zálohy.**

---

## G. Testovací platba

1. Preview env: D3 s `PAYMENTS_SANDBOX_OUTBOUND=true`, `PAYMENTS_LIVE=false`.  
2. Vytvoř poptávku → `POST /api/payments/create` s reference + accessKey → redirect.  
3. Zaplať Comgate test kartou (dle portálu).  
4. Ověř push dorazil (logy / admin → stav `paid` / `active`).  
5. Zkontroluj, že na Production se stejný test **nespustí** (`mayActivateFromComgate` blokuje test při LIVE).  
6. Teprve po úspěchu zvaž `PAYMENTS_LIVE=true` (explicitní souhlas).

---

## H. Podmínky veřejného vydání free katalogu

- [ ] `OPERATOR` kompletní → `launch:check` bez `operator-identity` BLOCKED  
- [ ] Privacy/Terms schválené člověkem  
- [ ] Production env + Auth redirects  
- [ ] Smoke na Production  
- [ ] Schválený merge `foodgo-launch-preview` → `main`  
- [ ] Preview zůstane noindex  

## I. Podmínky ostrých plateb

- [ ] Vše z H  
- [ ] Comgate KYC + sandbox E2E (G)  
- [ ] Webhook URL s bypass funguje  
- [ ] SQL promotion-orders nasazené  
- [ ] Resend / fakturace pro potvrzení  
- [ ] Explicitní `PAYMENTS_LIVE=true`  
- [ ] UI může teprve tehdy nabídnout nákup (dnes poptávka)

## J. Deploy a rollback

1. Commit na `foodgo-launch-preview` → Preview Ready  
2. Po schválení: PR/merge do `main` (ne force-push)  
3. Ověř Production SHA  
4. Rollback: Promote předchozí deployment  

---

## Fakturace (stručně)

- Admin → podklad text + **Stáhnout CSV pro účetní**  
- Doporučení: jednoduché české účetnictví (např. iDoklad / Fakturoid / Účto) — jedna služba, vystavuješ ty; do adminu jen zapíšeš číslo dokladu (`invoice` akce).  
- `gateway-test` v CSV = test, neostrá tržba.  
- Bez OPERATOR/DPH se částka neoznačuje za konečnou.

## Resend (stručně)

Viz `docs/FOODGO_RESEND_SETUP.md`.  
`npm run resend:key` → `.env`; stejné klíče do Vercel.  
Ověřená doména nutná pro ostré maily. Trial `onboarding@resend.dev` jen na ověřený účet Resend.
