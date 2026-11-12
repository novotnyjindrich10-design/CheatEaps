# FoodGo — Finální release dokument

Datum: 2026-11-12  
Větev: `foodgo-launch-preview`  
Preview: https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app  
Produkce (zatím neměnit): https://cheat-eaps.vercel.app

---

## 1. Aktuální stav

FoodGo je **technicky připravený free katalog** (hledání, filtry, mapa, poloha, detail, oblíbené, náhodný výběr).

Veřejné vydání **ještě není právní/provozní GO**: chybí identita provozovatele (`OPERATOR_*`), právní schválení textů a lidské ověření produkčních env + Auth redirectů.

`npm run launch:check -- --offline` → **overall: BLOCKED** (jediný BLOCKED: `operator-identity`).

---

## 2. Co je hotové (veřejná free v1)

| Oblast | Stav |
| --- | --- |
| Homepage + hledání | READY |
| Filtry, řazení, ověřené ceny | READY |
| Mapa (Leaflet) | READY |
| Geolokace + nejbližší | READY |
| Detail restaurace | READY |
| Oblíbené bez účtu | READY |
| Nevím, co jíst | READY (URL + Kam dál) |
| Navigace free IA | READY |
| Privacy / Terms kostry | READY (neplatné bez OPERATOR) |
| SEO (title, meta, OG, robots, sitemap, canonical) | READY |
| SPA routing + API rewrite | READY |
| Platby | VYPNUTO v kódu |
| Katalog audit | 0 confirmed errors |

---

## 3. Co bylo opraveno v tomto sprintu

1. **`PUBLIC_V1` scope** (`src/constants/publicV1.js`) — jasná hranice free katalogu.
2. **Slevy (`?deals=1`)** — skryté z CategoryStrip; přímá URL ukáže „zatím nejsou ve veřejné verzi“ (ne login gate jako hotová služba).
3. **Pro podniky** — placené balíčky skryté; zůstává neplacený zápis.
4. **Sitemap** — `/podpor-me` pryč; `robots.txt` Disallow `/podpor-me`.
5. **Hlášení chyb** — srozumitelná hláška při 503 (DB nenasazená).
6. **SEO** — absolutní `og:url` / `og:image`, canonical, `theme-color`.
7. **Terms** — placené služby označené jako nespouštěné ve free v1.
8. **launch:check** — `operator-identity` = BLOCKED; Resend chybí = WARNING (free katalog nezávisí na mailech).
9. E2E upravené na free v1 chování.

---

## 4. Co je deaktivované / demoted

| Funkce | Chování |
| --- | --- |
| Členské slevy | UI vypnuté (`memberDealsUi: false`) |
| Placená propagace | UI vypnuté; online platba stále `enabled: false` |
| Podpoř mě | mimo nav/sitemap; platba bez URL |
| Odměny / body | `/odmeny` „Připravujeme“; mimo nav |
| Place reports/stats persistence | bez SQL → 503 (bez fake success) |
| Ostré e-maily | bez Resend / ověřené domény se neodesílají |

Kód zůstává; zapnutí = změna `PUBLIC_V1` + env + případně SQL.

---

## 5. Výsledky testů (lokálně)

| Kontrola | Výsledek |
| --- | --- |
| Unit | **350/350 PASS** |
| Lint | exit 0 (warnings) |
| Build | PASS |
| Catalog audit | PASS |
| Playwright | **34/34 PASS** |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

---

## 6. Přesné zbývající blokery

1. **Vyplnit `src/constants/operator.js`** (legalName, ico, street, city, postalCode, email) — bez vymyšlených údajů.
2. **Právní kontrola** Privacy + Terms po doplnění OPERATOR.
3. **Vercel Production env** (názvy, ne hodnoty): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL=https://cheat-eaps.vercel.app` (nebo vlastní doména). Resend jen pokud chceš B2B maily.
4. **Supabase Auth** Site URL + Redirect URLs včetně `/nove-heslo` na produkční origin.
5. **Volitelně SQL** `supabase/bootstrap-all.sql` (+ `place-reports.sql` / `place-stats.sql` pokud chceš hlášení).
6. **Schválený merge Preview → main + production deploy** (agent nedělá automaticky).
7. **Smoke na produkci** po deployi.

---

## 7. Konkrétní ruční kroky (checklist)

1. Doplň OPERATOR skutečnými údaji živnosti.
2. Nech zkontrolovat `/ochrana-osobnich-udaju` a `/obchodni-podminky`.
3. V Vercel → Project → Settings → Environment Variables (Production): Supabase + `PUBLIC_SITE_URL`.
4. V Supabase → Authentication → URL configuration: Site URL + Redirect.
5. (Doporučeno) Spusť SQL migrace v SQL Editoru — **až po tvém potvrzení**.
6. Merge `foodgo-launch-preview` → `main` (viz §8).
7. Počkej na Production Ready.
8. Smoke (§9).
9. Až pak komunikuj veřejnou URL.

---

## 8. Bezpečný postup produkčního deploye (merge Preview → main)

**Nedělat automaticky.** Po schválení:

```bash
git checkout foodgo-launch-preview
git pull
git checkout main
git pull
git merge --no-ff foodgo-launch-preview
# zkontroluj diff; žádné .env secrets
git push origin main
```

Vercel má nasadit Production z `main`.  
**Ne**: force push, změna produkční domény, mazání DB, zapnutí plateb.

Rollback: redeploy předchozí Production deployment v Vercel Dashboard, nebo `git revert` merge commit + push.

---

## 9. Postup ověření po nasazení

Na **produkční** URL (ne Preview):

1. `/` — hero, kategorie **bez** Slevy, hledání
2. `/results` — filtry, řazení
3. Povolit GPS — „Nejbližší“ / „Nejblíž ke mně“, reálné vzdálenosti
4. Zamítnout GPS — žádné falešné km
5. `/results?view=map` — mapa desktop + mobil
6. Detail podniku — ilustrace označená, ceny ODHAD vs ověřené
7. Oblíbené bez účtu
8. `/nevim-co-jist`
9. `/results?deals=1` — stránka „zatím nejsou ve veřejné verzi“
10. `/pro-podniky` — bez placených balíčků jako ready; neplacený zápis OK
11. Privacy/Terms — po OPERATOR bez `LegalMissing` checklist mezer
12. View-source / Network — nový hashed JS/CSS (ne starý bundle)

---

## 10. Rollback plán

1. Vercel → Deployments → předchozí Production → Promote / Rollback.
2. Pokud bad commit: `git revert <merge-sha>` na `main` + push.
3. Auth/env problém: nejdřív opravit Redirect URLs / env, ne mazat data.
4. SQL: migrace jen dopředné; rollback schématu jen se zálohou a souhlasem.

---

## Verdikt

| Otázka | Odpověď |
| --- | --- |
| Funguje free katalog technicky? | **ANO** |
| Můžeme teď bezpečně veřejně vydat? | **AŽ PO KONKRÉTNÍCH KROCÍCH** (OPERATOR + právní + env + deploy) |
| Čekat na platby / body / slevy? | **NE** |

Související: `FOODGO_LAUNCH_CANDIDATE.md`, `FOODGO_RELEASE_READY.md`, `.env.example`.
