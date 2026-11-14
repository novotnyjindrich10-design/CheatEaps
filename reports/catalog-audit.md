# FoodGo – audit katalogu (kategorie, popisy, fotografie)

Vygenerováno: 2026-11-14T14:53:23.925Z

## Souhrn

1. **Zkontrolováno podniků:** 775 (očekáváno 775)
2. **Podezřelé záznamy:** 7 (suspected + ruční kontrola)
3. **Potvrzené chyby teď v datech:** 0
4. **Chyby klasifikačních pravidel:** 0
5. **Steakhousy s bezpečnou kategorií + steak fotkou:** 6
6. **Overrides:** 100

## Kategorie (počty)

| Kategorie | Počet |
| --- | ---: |
| kava | 191 |
| neuvedeno | 144 |
| ceske | 123 |
| asijske | 93 |
| pizza | 72 |
| fastfood | 37 |
| sladke | 32 |
| burger | 25 |
| kebab | 21 |
| cina | 12 |
| mexiko | 11 |
| zdrave | 10 |
| vegetarianske | 2 |
| veganske | 2 |

## Zjištěné chyby klasifikačních pravidel

- Žádné.

## Potvrzené chyby v datech

Žádné potvrzené chyby — audit prošel.

## Opravené steakhousy (probe)

- `buffalo-american-steakhouse-krizkovskeho-416-22`
- `butcher-s-dobrovskeho-96-29`
- `monte-bu-udolni-76`
- `plzensky-dvur-sumavska-29a`
- `prime-steak-palackeho-trida-162`
- `steak-house-k1-bubenickova-11`

## Seznam oprav v této vlně (katalog 2026-11-04)

Potvrzené chyby způsobené regexem `/tea/` ⊆ `steak_house` + kávové Pixabay ilustrace:

| ID | Změna |
| --- | --- |
| `prime-steak-palackeho-trida-162` | kava→neuvedeno/Restaurace; popis; foto 1869598→617430 |
| `buffalo-american-steakhouse-krizkovskeho-416-22` | kava→neuvedeno; popis; foto 1983334→2430575 |
| `butcher-s-dobrovskeho-96-29` | kava→neuvedeno; popis; foto 2178268→3640560 |
| `monte-bu-udolni-76` | kava→neuvedeno; popis; foto 7963438→2484999 |
| `plzensky-dvur-sumavska-29a` | kava→neuvedeno; foto 1572741→3676796 |
| `steak-house-k1-bubenickova-11` | kava→neuvedeno; popis; foto 2590789→3676808 |
| `amici-pizza-burgers-palackeho-trida-82` | popis (kavárna)→(pizzerie) |
| `tri-kocketyri-nadrazni-22` | popis (kavárna)→(burger restaurace) |

**Pravidla:** sdílený `src/utils/cuisineClassify.js` (tokenová klasifikace); generátor OSM bere popisek podle kategorie, ne jen amenity.

**Počet skutečně opravených chyb v této vlně:** 8 podniků (+ 1 sdílený klasifikátor).

## Podezření (automatická)

- Žádná silná automatická podezření.

## Ruční kontrola

- `cha-do-zelny-trh-10` — OSM tea;chinese;japanese;asian;korean — teď kava; ověřit zda čajovna nebo asijská restaurace
- `fenix-lounge-restaurace-masarykova-32` — OSM teahouse;pizza;middle_eastern — kategorie pizza; ověřit zaměření lounge
- `coffee4all-chironova-8` — Override kava, OSM má i pizza — záměrná kavárna, držet
- `bar-caffe-elephant-lidicka-43` — Amenity cafe + cuisine local;regional → ceske; popis stále „kavárna“
- `park-lane-luzanecka-4a` — Amenity cafe + regional → ceske; ověřit zda kavárna nebo restaurace
- `kimono-bayerova-572-2` — Amenity cafe + japanese → asijske; ověřit koncept
- `plzensky-dvur-sumavska-29a` — Po opravě neuvedeno (steak+regional); případně ručně ceske podle webu

## Poznámky

- Potvrzené vs podezření: potvrzené = jednoznačný rozpor (např. `steak_house` + kategorie `kava`).
- Fotografie: hodnotíme URL/téma Pixabay, ne pixelový obsah — nejisté případy patří do ruční kontroly.
- Spuštění: `npm run audit:catalog`
