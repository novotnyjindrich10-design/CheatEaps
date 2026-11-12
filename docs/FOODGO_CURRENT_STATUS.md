# FoodGo — Aktuální stav

Datum: 2026-11-12  
Režim: Final Release Sprint → Preview větev

## Verdikt jednou větou

Free katalog je technicky ready; veřejné vydání blokuje prázdný OPERATOR + právní/env/deploy kroky. Detail: `docs/FOODGO_RELEASE_FINAL.md`.

## Stack

React 19 · Vite 8 · Supabase · Vercel · Resend · Leaflet · Playwright · oxlint

## Veřejná v1 (PUBLIC_V1)

- Zapnuto: katalog, mapa, poloha, detail, oblíbené, surprise, auth UI, neplacený zápis
- Vypnuto jako ready: členské slevy, placená propagace, Podpoř mě v sitemap

## Testy

| Sada | Stav |
| --- | --- |
| Unit | **350/350 PASS** |
| Lint | exit 0 / warnings |
| Build | PASS |
| Catalog audit | PASS |
| Playwright | **34/34 PASS** |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

## Produkční blokery

1. OPERATOR / právní identita — **BLOKUJE**
2. Právní kontrola Privacy/Terms
3. Vercel Production env + Supabase Auth redirects
4. Schválený merge → main + deploy
5. Volitelně SQL place-reports/stats

## Preview

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app
