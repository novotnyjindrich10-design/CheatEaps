# FoodGo — Aktuální stav

Datum: 2026-11-12  
Režim: po Final Polish (lokální změny **necommitnuté**, nenasazené)

## Verdikt jednou větou

Lokální free-launch kandidát je použitelný (IA, poloha, testy); veřejné spuštění stále blokují provozovatel, produkční env/e-mail a schválený deploy. Detail: `FOODGO_FINAL_POLISH_REPORT.md`, `FOODGO_LAUNCH_CANDIDATE.md`.

## Stack

React 19 · Vite 8 · Supabase · Vercel · Resend · Leaflet · Playwright · oxlint

## Data katalogu

| Metrika | Hodnota |
| --- | --- |
| Podniky | 775 |
| Confirmed audit errors | 0 |
| Ruční kontroly | 7 |
| Ověřené ceny | 68 |
| Odhadované ceny | 707 |
| Bez konkrétní kategorie | 144 |
| Se souřadnicemi | 771 |
| OSM otevírací doba | 655 |

## Testy (lokálně)

| Sada | Stav |
| --- | --- |
| Unit | **348/348 PASS** |
| Lint | exit 0 / warnings |
| Build | PASS |
| Catalog audit | PASS |
| Playwright | **34/34 PASS** |
| launch:check --offline | WARNING (Resend offline) |

## Klíčové změny od předchozího statusu

1. Auth E2E timeout opraven (deal index + Intl cache).
2. Place reports / stats: trvalé ukládání přes Supabase RPC; bez DB = 503, ne fake success.
3. SQL migrace připravené, nenasazené.
4. E2E mock map tiles + CDN failure smoke.
5. Skip-to-content.
6. Free-launch copy na Pro podniky (provozovatel / vypnuté platby).
7. `launch:check --offline` bez ostrých e-mailů.

## Bezpečnost (lokální kód)

- Hlášení/statistiky: veřejný INSERT jen přes RPC; tabulky revoked pro anon; admin read přes `is_cheapeats_admin`
- GET API reports/stats: 403 bez admina
- Service role jen server-side
- Placené brány vypnuté

Produkční RLS runtime: **NEOVĚŘENO** (bez destruktivních prod testů).

## Výkon

- Catalog chunk: **1 185,46 kB** (gzip ~196 kB) — beze změny dat
- Deal filter: ~30 ms / 10k lookupů (dříve ~1,3 s)
- Mapa lazy; auth E2E scénář ~20–30 s

## Produkční blokery

1. OPERATOR / právní identita prázdná — **BLOKOVÁNO**
2. Vercel env + Auth redirects — **NEOVĚŘENO**
3. Resend produkční doména — **BLOKOVÁNO** (trial)
4. SQL place-reports/stats — připraveno, **BLOKOVÁNO** nasazení
5. Commit / push / deploy — **BLOKOVÁNO** bez souhlasu

## Související dokumenty

- `docs/FOODGO_TECHNICAL_FIX_REPORT.md`
- `docs/FOODGO_RELEASE_READY.md`
- `docs/FOODGO_OVERNIGHT_BUILD.md` (historie, pokud existuje)
