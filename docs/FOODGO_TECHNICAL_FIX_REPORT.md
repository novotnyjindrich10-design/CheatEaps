# FoodGo — Technical Fix Report

Datum: 2026-11-12  
Rozsah: MEGA FIX & PRODUCTION READINESS (bez commit / push / deploy / produkčních SQL)

## Shrnutí

Opravena příčina timeoutu auth E2E (pomalý filtr slev + drahý `Intl` při každém lookupu). Hlášení chyb a statistiky už nepředstírají úspěch v paměti procesu — bez nasazené migrace vrací 503. Připravené SQL + RLS + RPC, unit testy, mock mapových dlaždic, skip-link, offline `launch:check`.

## Fáze 1 — Auth Playwright

**Příčina:** Při `dealsOnly` se pro každý z ~775 podniků volalo `restaurantHasPublicDeal` → opakovaný expand všech nabídek. Navíc `todayIso()` vytvářel nový `Intl.DateTimeFormat` při každém volání (~1,3 s na 10k lookupů). Test pak nestihl 60 s budget (dříve pád na `goto /oblibene`).

**Oprava:**
- Denní index nabídek (`publicDeals` / `publicDealsIndex`) v `restaurantDeals.js`
- Sdílený `pragueDayFormat` v `todayIso`
- E2E: reload s `domcontentloaded`, přechod na Oblíbené přes odkaz (stejné asserty session/favorites)

**Ověření:** auth mock `repeat-each=2` → **4/4 PASS** (scénář ~20–30 s).

## Fáze 2 — Hlášení chyb

- SQL `supabase/place-reports.sql`: tabulka, RLS, admin select/update, RPC `submit_place_report` (anon execute)
- Server `placeReports.js`: Supabase RPC; bez konfigurace / bez migrace → **503 `stored: false`**
- GET jen pro admina
- Rate limit + honeypot zachovány; formulář posílá honeypot i na server a vyžaduje `stored: true`
- Testy: `placeReports.test.js`

**Nasazení SQL: BLOKOVÁNO** (vyžaduje souhlas).

## Fáze 3 — Statistiky

- SQL `supabase/place-stats.sql`: `place_stats_daily`, RLS admin select, RPC `record_place_stat`
- Eventy: `profile_view`, `website_click`, `directions_click`, `phone_click` (+ legacy `route_click`)
- Bez DB → 503, bez falešných veřejných čísel
- Testy: `placeStats.test.js`

**Nasazení SQL: BLOKOVÁNO.**

## Fáze 4 — Security

- Contract testy SQL: revoke anon table access, admin-only policies, RPC insert
- Veřejné GET hlášení/statistik → 403
- Unit store mock: chybějící RPC → `not-ready`
- Produkční destruktivní testy se nespouštěly

## Fáze 5 — Mapa

- E2E mock dlaždic (`allowMapTiles`) — ověří tile pane + atribuci OSM/CARTO
- Scénář bez dlaždic: canvas a body přežijí abort CDN
- Živá Carto CDN síť: **NEOVĚŘENO** (záměrně mock / block)

## Fáze 6 — Katalog

- Audit: 775 / 0 confirmed / 7 ruční
- Mezi 7 body není jednoznačná auto-oprava bez vymýšlení kategorie → **žádná datová změna**

## Fáze 7 — A11y / mobil

- Skip-link „Přeskočit na obsah“ → `#main-content`
- Existující 320/390 E2E zachovány
- axe: neinstalován (nepřidal se nový dependency runtime)

## Fáze 8 — Výkon

| Metrika | Před (status 12. 11.) | Po |
| --- | --- | --- |
| catalog chunk | ~1 185 kB | **1 185,46 kB** (beze změny dat) |
| vendor | ~259 kB | 259,07 kB |
| map | ~189 kB | 189,04 kB |
| deal lookup 10k | ~1 300 ms | **~30 ms** |
| auth E2E hlavní scénář | timeout 60 s | **~20–30 s PASS** |

Catalog chunk se záměrně nerozděloval — riziko rozbití filtrů bez měřeného přínosu v gzip (stále ~196 kB).

## Fáze 9 — Produkce

| Položka | Stav |
| --- | --- |
| Vercel env | NEOVĚŘENO (403 tým) |
| Supabase Redirect URLs | NEOVĚŘENO |
| Resend doména | lokálně trial `onboarding@resend.dev` |
| PUBLIC_SITE_URL | lokálně ne-https → WARNING |
| SQL place-reports/stats | připravené, nenasazené |
| OPERATOR | prázdný |
| Platby | vypnuté |
| Free launch copy | Pro podniky upozorňuje na chybějící provozovatele |

`npm run launch:check -- --offline` → overall **WARNING** (0 FAIL, 3 WARNING).

## Testy (tento běh)

| Sada | Výsledek |
| --- | --- |
| Unit | **342/342 PASS** |
| Lint | exit 0, 15 warningů |
| Build | PASS |
| Catalog audit | PASS (0 confirmed) |
| Playwright | **24/24 PASS** (auth scénář ~18 s) |
| launch:check --offline | WARNING (0 FAIL, 3 WARNING) |

## Co musí udělat člověk

1. Review diff + schválit commit / push / deploy.
2. Doplnit `OPERATOR`.
3. Vercel env + Supabase Redirect URLs.
4. Resend ověřená doména.
5. Volitelně SQL: `place-reports.sql`, `place-stats.sql`.
