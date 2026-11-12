# FoodGo — Launch Candidate (free public v1)

Datum: 2026-11-12  
Cíl: bezpečné veřejné spuštění **katalogu zdarma** bez ostrých plateb.

## Verdikt

**Technicky ANO jako free launch candidate lokálně.**  
**Veřejné spuštění zatím NE** bez lidských kroků (provozovatel, env, e-mail, schválený deploy).

## Co patří do první verze (zapnout)

| Funkce | Stav |
| --- | --- |
| Úvod + hledání | READY |
| Filtry / kategorie / rozpočet | READY |
| Mapa | READY (CDN v E2E mock) |
| Poloha + vzdálenosti + nejbližší | READY |
| Detail podniku | READY |
| Oblíbené bez účtu | READY |
| Nevím, co jíst | READY (sekundární nav) |
| Auth / účet | READY kódem; prod redirecty NEOVĚŘENO |
| Právní stránky | KOSTRY — čekají na OPERATOR |

## Co je odloženo / demoted

| Funkce | Stav |
| --- | --- |
| Slevy a body (`/odmeny`) | mimo hlavní nav; „Připravujeme“ bez DB |
| Ostré slevy pro hosty | login gate |
| Placená propagace | poptávka only; bez platební brány |
| Podpoř mě | mimo nav/footer; platba není napojená |
| Denní menu katalog | není; OSM zmínka jen jako štítek |
| Place reports/stats persistence | kód + SQL; prod SQL nenasazené → 503 |

## Ověřené vs. čeká na člověka

### Ověřené lokálně

- Unit 348/348, build, lint, catalog audit
- Playwright nav + location + public (22/22) + full suite (viz běh)
- Poloha: deny/revoke/forget/refresh
- Navigace IA free-launch

### Připravené, nenasazené

- SQL `supabase/place-reports.sql`, `place-stats.sql`
- Lokální polish diff (necommitnutý)

### Vyžaduje člověka

1. Commit + push + Vercel deploy
2. `OPERATOR_*` + právní kontrola
3. Vercel env (`PUBLIC_SITE_URL`, Supabase, `EMAIL_FROM`)
4. Supabase Auth Site URL + Redirect URLs
5. Resend produkční doména (ne trial `resend.dev`)
6. Volitelně SQL reports/stats
7. Smoke produkce

### Blokuje vydání

- Prázdná provozovatelská identita
- Neověřený produkční e-mail / auth redirecty
- Chybějící schválený deploy

## Bezpečný postup vydání

1. Projít `docs/FOODGO_FINAL_POLISH_REPORT.md` a tento dokument.
2. Schválit a commitnout diff.
3. Doplnit OPERATOR a zkontrolovat `/ochrana-osobnich-udaju`, `/obchodni-podminky`.
4. Nastavit Vercel env + Supabase Auth URL.
5. (Doporučeno) Spustit SQL migrace.
6. Deploy → smoke: `/`, `/results`, mapa, detail, oblíbené, poloha, login.
7. Až potom komunikovat veřejnou URL.

## Go / No-Go free launch

| Otázka | Odpověď |
| --- | --- |
| Je produkt použitelný zdarma jako katalog? | ANO (lokálně ověřeno) |
| Je připravený na veřejnou produkci teď hned? | NE — provozovatel / env / deploy |
| Je potřeba čekat na platby / body / denní menu? | NE |
