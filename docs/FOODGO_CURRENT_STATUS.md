# FoodGo — Aktuální stav

Datum: 2026-11-14  
Režim: FoodGo 1.0 master transform → Preview větev

## Verdikt jednou větou

Free katalog je technicky ready; veřejné vydání blokuje prázdný OPERATOR + právní/env/deploy kroky. Detail: `docs/FOODGO_1_0_PRODUCT_REPORT.md`.

## Stack

React 19 · Vite 8 · Supabase · Vercel · Resend · Leaflet · MapLibre/OpenFreeMap · Playwright · oxlint

## Veřejná v1 (PUBLIC_V1)

- Zapnuto: katalog, mapa (bez API klíče), poloha, detail, oblíbené, surprise, auth UI, neplacený zápis
- Vypnuto jako ready: členské slevy, placená propagace, Podpoř mě v sitemap

## Testy (2026-11-14)

| Sada | Stav |
| --- | --- |
| Unit | **354/354 PASS** |
| Lint | exit 0 / warnings |
| Build + SEO prerender | PASS (775 restaurant HTML) |
| Catalog audit | PASS |
| Playwright | **34/34 PASS** |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

## Produkční blokery

1. OPERATOR / právní identita — **BLOKUJE**
2. Právní kontrola Privacy/Terms
3. Vercel Production env + Supabase Auth redirects
4. Schválený merge → main + deploy
5. Volitelně SQL place-reports/stats + Resend

## Preview

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app
