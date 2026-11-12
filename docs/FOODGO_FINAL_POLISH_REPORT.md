# FoodGo — Final Polish Report

Datum: 2026-11-12  
Režim: lokální změny **bez commit / push / deploy**

## Co bylo špatně

1. **Navigace** míchała jádro produktu s vedlejšími cestami (`Nevím, co jíst` v primární liště; `Slevy a body` / `Podpoř mě` v hlavní navigaci i footeru).
2. **Homepage** nabízela B2B „placenou propagaci“ a slevy s login wall jako rovnocenné objevování.
3. **Poloha**: po odebrání oprávnění mohla zůstat stará GPS v `localStorage` a tvářit se jako aktuální; „Vypnout polohu“ nebylo jasné „zapomenutí“.
4. **Výsledky**: duplicitní ovládání filtrů (`Vše` + `Zobrazit všechny filtry`).
5. **Google Fonts** v `index.html` i přes lokální fonty → zbytečné cizí requesty (a padající E2E).
6. **`npm test`** měl neúplný výčet souborů → neběžela celá unit sada.
7. Chyběl **ErrorBoundary** kolem rout.

## Co bylo skutečně opraveno

| Oblast | Změna |
| --- | --- |
| Header | Primární: Úvod · Najít podnik · Mapa · Oblíbené. Více: Nevím, Ověřené ceny, Pro podniky. Mobilní drawer s Hlavní / Další. |
| Footer | Jen jádro + právní; bez Slevy a body / Podpoř mě. |
| Home | Lead text; Kam dál zúženo na mapu / náhodný výběr / ověřené ceny / oblíbené. |
| Location | Denied smaže GPS; `permissionchange`; `forgetOrigin` + tlačítko „Zapomenout moji polohu“. |
| Results | Odstraněn `FiltersAllButton`; 2sloupcová mřížka filtrů. |
| Štítky | Polední zmínka (OSM), ne falešné denní menu. |
| Fonty | Odstraněny odkazy na Google Fonts; OG/title FoodGo. |
| Testy | Glob `src/**/*.test.js`; E2E nav + location rozšířeny. |
| App | ErrorBoundary kolem rout. |

## Vzhled

- Zachována FoodGo identita (Fraunces + Jakarta lokálně, zelená/oranžová).
- Hero má jednu srozumitelnou hodnotovou větu.
- Navigace je kratší a čitelnější.
- Screenshot po: `docs/polish-screenshots/home-desktop-after.png`

## Navigace (nová IA)

```
Úvod | Najít podnik | Mapa | Oblíbené | Více ▾ | Přihlášení
                              └ Nevím, co jíst
                                Ověřené ceny
                                Pro podniky
                                (+ admin)
```

Bez spodní mobilní lišty — hamburger + jasné skupiny stačí a nepřekáží kartám.

## Poloha — chování teď

1. První návštěva → výzva Povolit / Teď ne.
2. Povolení → GPS + Haversine hned + OSRM na pozadí.
3. Denied / revoke → GPS z localStorage pryč; žádné falešné km.
4. Zapomenout moji polohu → origin + prompt choice pryč.
5. Aktualizace → `maximumAge: 0` / force refresh.
6. Jediný zdroj: `LocationContext`.

## Testy (lokálně)

| Sada | Výsledek |
| --- | --- |
| Unit (`npm test` glob) | **348/348 PASS** |
| Lint | exit 0 (existující warnings) |
| Build | PASS |
| Catalog audit | PASS (7 ručních bodů beze změny dat) |
| Playwright (location + nav-sort + public) | **22/22 PASS** |
| Playwright full suite | **34/34 PASS** |

## Známé nedostatky (záměrně neodložené do „fake ready“)

- Placené balíčky / Podpoř mě / odměny: stránky existují, ale nejsou v primární navigaci; platby nejsou ostré.
- Slevy v CategoryStrip stále vedou na login gate.
- Compare zůstává na kartách (užitečné, ale lehké).
- Catalog chunk ~1,17 MB (gzip ~192 kB).
- OPERATOR / Resend / prod SQL / Vercel env: **blokery vydání**, ne kódové polish.

## Co zbývá před vydáním

1. Schválit commit + deploy.
2. Doplnit provozovatele (`OPERATOR_*`).
3. Produkční env + Auth redirecty + Resend doména.
4. Nasadit SQL place-reports/stats (nebo nechat 503).
5. Smoke na produkční URL.
