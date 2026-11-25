# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
**Vývojová fáze je ukončená.** Teď jde o konfiguraci Preview DB a vydání.

Tajné hodnoty sem nepatří.

---

## Stav oddělení Preview (2026-11-25)

| Kontrola | Výsledek |
| --- | --- |
| Nový projekt foodgo-preview | `https://jnyxjyyvzxriuyvyiuxe.supabase.co` |
| Runtime Preview `/api/auth/session` | **`supabaseHost=jnyxjyyvzxriuyvyiuxe.supabase.co`** (propojeno) |
| Schema Preview | **Ještě prázdná** — `/api/published-places` hlásí chybějící tabulku; `/api/place-overrides` → `configured: false` |
| `PUBLIC_SITE_URL` na Preview | Runtime `publicSiteUrl: false` — doplň Preview env a redeploy |
| Ostré platby | Vypnuté (`paymentsLive: false`) |
| Produkční DB | Nedotčená |

**Závěr:** Preview už míří na foodgo-preview. Zbývá spustit `supabase/preview-bootstrap-all.sql` v SQL Editoru **jen** u `jnyxjyyvzxriuyvyiuxe` (krok A2) a doplnit Auth redirects + případně `PUBLIC_SITE_URL`.

Jeden SQL soubor pro prázdnou Preview DB:

`supabase/preview-bootstrap-all.sql`  
(generuj znovu: `node scripts/build-preview-bootstrap-sql.mjs`)

Obsahuje v pořadí: bootstrap-all → business-applications-form-v2 → loyalty → promotion-apply-missing → place-reports → place-overrides → place-stats → preview-synthetic-seed.

Izolovaný Docker Postgres 16: `node scripts/test-promotion-migration-isolated.mjs` — včetně combined bootstrapu — **OK**. Produkce nedotčena.

---

## HOTOVO (kód)

- Katalog, mapa, účty, admin, poptávky, Comgate logika (ostré vypnuté), security RPC, `/api/health`.
- Preview bootstrap skript odmítne produkční ref a vyžaduje `jnyxjyyvzxriuyvyiuxe`.
- Syntetický seed nevkládá hesla; na skutečném Supabase Auth nepřepisuje `auth.users`.

---

## ZBÝVÁ NAPROGRAMOVAT

**Nic kritického** pro oddělení Preview.

---

## A. Ruční kroky teď (Preview DB) — přesné pořadí

### A1. Vercel Preview env (SUPABASE_URL už sedí)

Ověřeno: Preview session vrací `jnyxjyyvzxriuyvyiuxe`. Doplň ještě, pokud chybí:

| Proměnná | Hodnota | Tajné | Stav |
| --- | --- | --- | --- |
| `SUPABASE_URL` | `https://jnyxjyyvzxriuyvyiuxe.supabase.co` | ne | OK v runtime |
| `SUPABASE_ANON_KEY` | klíč z foodgo-preview | ano | OK (configured) |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` **jen foodgo-preview** | ano | zkontroluj, že je na Preview |
| `PUBLIC_SITE_URL` | `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app` | ne | zatím `publicSiteUrl: false` |

[Environment Variables](https://vercel.com/jindrichcompany/cheat-eaps/settings/environment-variables) → Preview → případně Edit + Redeploy.

### A2. Bootstrap prázdné Preview databáze (teď nejdůležitější)

**Bez connection stringu (doporučeno):**

1. Otevři výhradně [SQL Editor foodgo-preview](https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/sql/new).  
2. V záhlaví Dashboardu ověř project ref **`jnyxjyyvzxriuyvyiuxe`** (ne `pcptzyfoojmnspumcmsi`).  
3. Vlož celý soubor `supabase/preview-bootstrap-all.sql` → **Run**.  
4. Ověření v SQL Editoru:  
   `select count(*) from public.promotion_orders where reference = 'CEPREVIEW1';` → 1.  
   `select to_regclass('public.place_overrides');` → ne null.

**S `psql` (volitelné):** URI z Project Settings → Database musí obsahovat `jnyxjyyvzxriuyvyiuxe`.

```text
PREVIEW_DATABASE_URL=<URI> node scripts/bootstrap-preview-database.mjs
```

Skript při produkčním refu nebo chybějícím `jnyxjyyvzxriuyvyiuxe` skončí chybou.

Agent **nemá** DB heslo — inicializaci na živém preview projektu musíš spustit ty (A2).

### A3. Auth redirects — foodgo-preview

[URL Configuration preview](https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/auth/url-configuration)

- **Site URL:** `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app`
- **Redirect URLs:**
  - `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app/nove-heslo`
  - `http://127.0.0.1:5173/nove-heslo`
  - `http://localhost:5173/nove-heslo`

Produkční projekt ([pcptzyfoojmnspumcmsi](https://supabase.com/dashboard/project/pcptzyfoojmnspumcmsi/auth/url-configuration)) nech s produkčním originem.

### A4. Po A1+A2 ověř Preview

1. `GET …/api/auth/session` → host `jnyxjyyvzxriuyvyiuxe`.  
2. `GET …/api/health` → `supabaseConfigured: true`, `paymentsLive: false`.  
3. Registrace testovacího účtu `@example.com` na Preview.  
4. Admin: v SQL `update public.profiles set is_admin = true where email = '<tvůj test>';` (jen preview).  
5. Poptávka z `/pro-podniky` → v preview DB nový řádek `promotion_orders`.  
6. Live probe tajného klíče **jen z preview**: do lokálního `.env` dej preview `SUPABASE_SERVICE_ROLE_KEY`, spusť `node scripts/probe-supabase-secret-compat.mjs`. Nevypisuj klíč.

---

## B. Až později (produkce / vydání)

1. Záloha produkce → `promotion-apply-missing.sql` → `place-overrides.sql` (jen po schválení).  
2. Resend, Comgate sandbox, provozovatel + právní texty.  
3. `npm run launch:check -- --offline`.  
4. Merge do `main` jen po výslovném schválení. `PAYMENTS_LIVE=true` až potom.

---

## Návrat

**Web:** Vercel → předchozí deployment → Promote.  
**SQL preview:** můžeš projekt foodgo-preview smazat/znovu vytvořit — produkce zůstane.  
**Produkční SQL rollback:** viz starší sekce G v gitu před tímto souborem / drop funkcí v `promotion-apply-missing` dokumentaci.
