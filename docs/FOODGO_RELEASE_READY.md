# FoodGo — Release Ready Checklist

Datum: 2026-11-12  
Cíl: bezpečné veřejné spuštění **zdarma** (bez plateb / placené propagace).

## Verdikt

**ČÁSTEČNĚ připraveno k veřejnému spuštění.**  
Technický kód a lokální testy jsou v dobrém stavu. Blokuje provozovatelská identita, produkční env (NEOVĚŘENO), e-mailová doména a neschválený deploy. Trvalé hlášení/statistiky fungují až po nasazení SQL.

## Go / No-Go

| Oblast | Stav | Poznámka |
| --- | --- | --- |
| Unit testy | HOTOVO | 342/342 |
| Lint / build | HOTOVO | 15 lint warningů |
| Auth E2E | HOTOVO | dříve timeout; opraveno |
| Playwright suite | HOTOVO | 24/24 PASS |
| Katalog 775 | HOTOVO | 0 confirmed errors; 7 ruční |
| Mapa (mock tiles) | HOTOVO | živá CDN NEOVĚŘENO |
| Skip-link a11y | HOTOVO | |
| Place reports persistence | ČÁSTEČNĚ | kód + SQL hotové; prod SQL BLOKOVÁNO |
| Stats persistence | ČÁSTEČNĚ | stejně |
| Memory fake success | HOTOVO | odstraněno (503 bez DB) |
| launch:check offline | ČÁSTEČNĚ | WARNING |
| Vercel env | NEOVĚŘENO | MCP 403 |
| Auth redirect URLs | NEOVĚŘENO | |
| Resend produkční doména | BLOKOVÁNO | trial sender |
| OPERATOR / právní text | BLOKOVÁNO | prázdné |
| Platby | HOTOVO (vypnuto) | záměr free launch |
| Commit / deploy | BLOKOVÁNO | bez souhlasu |

## Free launch (doporučený režim)

Zapnout veřejně:
- katalog, mapa, filtry, detail, recenze, oblíbené, auth
- hlášení chyb (po SQL) nebo jasná 503 „dočasně nedostupné“
- statické stránky / SEO základy

Nezapínat / jasně vypnout v UI:
- placená propagace a platební brána
- sliby statistik podnikům, dokud není SQL + admin
- ostré transakční e-maily přes `resend.dev`

## Lidské kroky před veřejným spuštěním

1. **Schválit a commitnout** aktuální diff (agent nesmí commitnout bez souhlasu).
2. Vyplnit `OPERATOR_*` a zkontrolovat `/pravni`, `/ochrana-udaju`, `/cookies`.
3. Nastavit Vercel env: `PUBLIC_SITE_URL` (https), Supabase, `EMAIL_FROM` na ověřenou doménu.
4. Supabase Auth: Site URL + Redirect URLs pro produkční doménu.
5. (Doporučeno) Spustit v Supabase SQL:
   - `supabase/place-reports.sql`
   - `supabase/place-stats.sql`
6. Deploy na Vercel; smoke: home, výsledky, mapa, detail, login, oblíbené, hlášení.
7. Ručně projít 7 katalogových položek z auditu.

## Rizika po spuštění bez SQL

- `/api/place-reports` a `/api/place-stats` vrací **503** — UI nesmí tvrdit, že zápis proběhl.
- Admin nemá co číst v DB.
- Auth a katalog fungují nezávisle na těchto tabulkách.

## Co není release blocker pro „katalog zdarma“

- Neověřená Carto CDN v E2E (mock stačí; produkční síť ověřit smoke)
- 144× kategorie „neuvedeno“ (data kvalita, ne crash)
- 68 ověřených vs 707 odhadovaných cen (označeno v UI)
- Placené funkce vypnuté
