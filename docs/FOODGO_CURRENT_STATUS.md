# FoodGo — Aktuální stav

Datum: 2026-11-24  
Větev: `foodgo-launch-preview`

## Verdikt jednou větou

Free katalog + mapa jsou technicky ready na Preview; veřejné vydání blokuje prázdný OPERATOR. Ostré platby blokuje chybějící Comgate účet / env (kód brány a auto-aktivace jsou hotové).

## Stack

React 19 · Vite 8 · Supabase · Vercel · Resend · Leaflet · MapLibre/OpenFreeMap · Playwright · oxlint

## Stav klíčových funkcí

| Oblast | Stav |
| --- | --- |
| Mapa Brno (OpenFreeMap, clustering, filtry, GPS, mobilní panel) | Hotovo v kódu |
| Podniky se souřadnicemi | **771 / 775** (4 bez coords: mamas-burger, cukrarna-vetrnik-lidicka, cukrarstvi-martinak, chicken-inn-svobody) |
| Placená propagace UI | Nezávazná poptávka (ne „Zaplatit“) |
| Comgate create + webhook auto-aktivace | Implementováno; sandbox transakce neproběhla |
| Admin propagací | Funguje (server-side) |
| Účet podniku `/pro-podniky/ucet` | Stav poptávky + žádost o zápis |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

## Preview

https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app

Detail: `docs/FOODGO_1_0_PRODUCT_REPORT.md`, platby: `docs/FOODGO_BUSINESS_AND_PAYMENTS.md`
