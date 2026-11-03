# CheapEats – Etapa 4: audit a kvalita katalogu

Vygenerováno: 2026-11-03

## Co audit našel

| Oblast | Nález | Stav |
| --- | --- | --- |
| Záznamy | 775 unikátních ID, žádná prázdná jména/adresy | OK |
| Duplicity curated+OSM | 11 párů stejného místa | Ve výpisu skryta slabší kopie; ID zachována |
| Hledání `q=pizza` | Dříve 22 (jen název), kategorie pizza má 71 | Opraveno: hledá i typ/kategorii + synonyma |
| Rozpočet + pizza do 150 Kč | 0 ověřených (nejlevnější ověřená pizza od ~159 Kč) | Správné chování filtru, ne bug |
| Souřadnice | 4 podniky bez bodu | Nezměněno – v OSM dumpu není spolehlivá shoda |
| Kategorie `neuvedeno` | 140 → 138 | 2 overrides z jednoznačného názvu |
| Ceny | 68 ověřených, 707 odhadů, 0 bez ceny | Filtr dál bere jen ověřené |
| OSM kontakt (etapa 3) | 655 hodin, 379 telefonů | Beze změny |
| Oficiální weby | 435, filtr platí | OK |

## Opravy v této etapě

1. **Vyhledávání** – haystack zahrnuje název, adresu, typ, český label kategorie a synonyma (pizza, sushi, kebab…). Víceslovný dotaz = AND; stopslova jako Brno / levná se ignorují.
2. **Duplicity ve výsledcích** – 11 známých párů; curated zůstane, OSM kopie se ve výpisu skryje (detail přes URL funguje).
3. **Řazení** – curated záznamy mají malý bonus kvality.
4. **Kategorie** – `doe-boy-pizza-napoletana-…` → pizza; `local-cafe-restaurant-…` → kava (důvod v `categoryOverrides`).

## Co zůstalo záměrně

- **4 bez souřadnic:** `mamas-burger`, `cukrarna-vetrnik-lidicka`, `cukrarstvi-martinak`, `chicken-inn-svobody` — v `osm-brno-coords.json` není jednoznačný pár (bez vymýšlení lat/lon).
- **138 neuvedeno** — bez doloženého menu/webu se kategorie nemění.
- **707 odhadů** — nejsou ověřené ceny; rozpočtový filtr je nepoužívá.
- **Mazání ID** — neprovedeno (rozbilo by overlaye, oblíbené, odkazy).
- **Google Places / SQL** — nevoláno.

## Doporučení další etapy

1. Manuální / Overpass doplnění 4 souřadnic a další kategorie z ověřených webů.
2. Soft-merge UX u duplicit (jedna karta, odkaz na „stejný podnik“).
3. Kontrola zastaralých ověřených cen (re-open menu URL).
4. Až potom samostatné SEO / performance splitting.
