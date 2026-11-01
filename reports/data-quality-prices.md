# Kvalita cen, štítků a filtrů

Stav katalogu po kontrole 29. 10. 2026. Počty jsou ze sloučení ručních záznamů, OpenStreetMap, `verifiedPrices` a `estimatedPrices`.

## Ceny

| | Před touto úpravou | Po úpravě |
| --- | ---: | ---: |
| Podniků | 775 | 775 |
| Ověřená cena (`menu` + `range`) | 68 | 68 |
| Z toho konkrétní položka | 26 | 26 |
| Z toho rozmezí | 42 | 42 |
| Odhad | 707 | 707 |
| Bez ceny | 0 | 0 |

Ověřených záznamů nepřibylo. U tří už ověřených položek se po otevření zdroje upravila částka, rozmezí nebo datum. Odhad se dál za ověřenou cenu nevydává: `hasVerifiedPrice` ho odmítá a rozpočtový filtr bere jen horní mez ověřené ceny. Žádné rozmezí nemá horní mez nižší než dolní.

Odhady vznikají ve `scripts/generate-price-estimates.mjs` z kategorie, názvu, typu, popisu, PSČ centra a drobného posunu podle ID. Nejsou to ceny z menu. Hromadně jsem je nepřepisoval.

### Stránky, které se v téhle kontrole opravdu otevřely

- `https://ceniky.mcdonalds.cz/cenik/cenik.jsp?podtyp=11&restaurace=066` — ceník pobočky 066. Big Mac je **125 Kč**. Uložených 115 Kč je proto nahrazeno, datum ověření je 2026-10-29. Stejná stránka má i Smažák Fresh za 85 Kč, tedy bezmasou položku v burgerové provozovně. Cenu druhé pobočky na náměstí Svobody jsem z tohoto ceníku nepřebíral.
- `https://www.forkys.cz/pobocka/oc-vankovka/` — stránka pobočky Galerie Vaňkovka. Forky’s burger je pořád **169 Kč** (s menu 219 Kč). Částka zůstala, datum ověření je 2026-10-29. Ostatní pobočky Forky’s jsem neotevíral.
- `https://www.veganaframen.cz/menu` — oficiální lístek k záznamu Marešova 14. Ramen je **249–259 Kč**. Předchozí rozmezí 139–259 Kč začínalo u sójových žebírek, ne u ramenu. Rozmezí je zúžené na ramen a datum je 2026-10-29. Lístek je veganský, záznam má proto i veganský příznak.
- `https://rudspizza.cz/menu` — společné menu řetězce, na stránce je věta o výběru pobočky. Brněnskou cenu jsem z něj nezapsal.

Starý `reports/menu-scan.json` jsem jako zdroj cen nepoužil. Umí z HTML vytáhnout i dopravu, hotel, holičství nebo slevové texty. Zbylých ověřených zdrojů, včetně pěti `http://` odkazů, jsem v téhle kontrole znovu neotevíral.

## Duplicity

Stejné souřadnice a české dvojí číslování domu (orientační / popisné). Jde o jeden podnik dvakrát, ruční záznam a OSM. Nesloučeno: smazání jednoho ID by rozbilo uložené overlaye a odkazy na detail.

| Pár | Adresy | Souřadnice |
| --- | --- | --- |
| `bistro-franz` a `bistro-franz-veveri-461-14` | Veveří 14 a Veveří 461/14 | 49.199536, 16.602491 |
| `stopkova-plzenska-pivnice` a `stopkova-plzenska-pivnice-ceska-5` | Česká 163/5 a Česká 5 | 49.195568, 16.606515 |
| `lokal-u-caipla` a `lokal-u-caipla-kozi-3` | Kozí 115/3 a Kozí 3 | 49.195873, 16.609449 |
| `monogram-espresso-bar` a `monogram-espresso-bar-kapucinske-namesti-12` | Kapucínské náměstí 310/12 a 12 | 49.191717, 16.609925 |

U Franz má ruční záznam ověřenou snídani 245 Kč a kategorii Zdravé, OSM kopie stejnou cenu a kategorii Kavárna. U Stopkovy má ruční záznam ověřený guláš 239 Kč, OSM kopie jen odhad. U Monogramu se odhady liší (99–169 Kč a 109–179 Kč), protože posun odhadu závisí na ID. U Lokálu má OSM kopie vegetariánský příznak, ruční záznam ne.

Dalších 30 shodných názvů má jinou adresu. To jsou pobočky, ne duplicita jednoho místa. Žádný záznam nemá prázdné ID, název nebo adresu. Mimo vymezené Brno není žádný se souřadnicemi.

Chybí souřadnice, vzdálenost se u nich nespočítá:

- `mamas-burger`
- `cukrarna-vetrnik-lidicka`
- `cukrarstvi-martinak`
- `chicken-inn-svobody`

## Štítky a filtry

OSM `diet:vegetarian=yes` u McDonald’s Masarykova 32 znamená vegetariánskou položku v nabídce, ne vegetariánskou restauraci. Kuchyně v OSM je `burger`. Štítek na kartě je proto **Vegetariánská jídla**. Štítek **Veganské** nebo **Bez masa** zůstává podnikům v kategorii Vegan a Bez masa. Ostatní s veganským příznakem mají **Veganská jídla**.

Veganský filtr dál pouští jen `veganFriendly` a vegetariánská nabídka jím neprojde. Veganský podnik vegetariánským filtrem projde. Popisek filtru je „Pouze s veganskými jídly“. Reset vyprázdní adresu výsledků. Rozpočet, kategorie, vzdálenost, řazení a „Jen ověřené ceny“ se skládají do adresy společně.

## Testy

- `npm test`: 97 testů, 0 chyb
- `npm run lint`: kód 0, stará varování ve skriptech ilustrací a u Fast Refresh v `LocationContext.jsx`
- `npm run build`: prošel, upozornění na velký balík dat zůstává
