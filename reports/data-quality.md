# Kvalita dat restaurací

Audit sloučeného seznamu v aplikaci (ruční záznamy, OpenStreetMap a uložené overlaye) ze 14. 10. 2026. Externí weby, otevírací dobu ani aktuálnost cen jsem neověřoval. Nic jsem z dat nemazal.

## Stav seznamu

- 775 záznamů, 775 unikátních id. Název a adresa nechybí u žádného.
- Ceny v datech: 68 ověřených (26 konkrétních položek, 42 rozmezí) a 707 odhadů. Záznam bez ceny ani bez odhadu není.
- Souřadnice v Brně má 763 záznamů. Mimo vymezené Brno není žádný.
- Cenové zdroje u ověřených záznamů jsou syntakticky platné `http`/`https` odkazy. Jestli stránky pořád ukazují tu cenu, jsem nekontroloval.

## Chybějící souřadnice

Těchto 12 záznamů nemá v `placeCoordinates` souřadnice, takže u nich aplikace vzdálenost nespočítá:

- `forkys-vankovka`
- `statl-brno`
- `prova-bistro-pizza`
- `mamas-burger`
- `smash-burgers-moravske`
- `cukrarna-vetrnik-lidicka`
- `cukrarstvi-martinak`
- `bageterie-boulevard-vankovka`
- `chicken-inn-svobody`
- `campus-river-palachovo-namesti-2`
- `kavarna-cukrarna-smile-s-r-o-namesti-28-dubna-10-40`
- `la-corrida-namesti-28-dubna-2`

Souřadnice jsem nedoplňoval. V repozitáři pro ně není uložený bod, který bych mohl jen přepsat.

## Pravděpodobné duplicity

Stejné souřadnice na pět desetinných míst a velmi podobný název. Vypadá to na jeden podnik uložený dvakrát (ruční záznam a OSM, případně dva OSM zápisy). Nesmazáno.

- `bistro-franz` a `bistro-franz-veveri-461-14`
- `lokal-u-caipla` a `lokal-u-caipla-kozi-3`
- `stopkova-plzenska-pivnice` a `stopkova-plzenska-pivnice-ceska-5`
- `uvozna-burger` a `uvozna-uvoz-39`
- `kurdsky-kebab-cejl` a `kurdsky-kebab-cejl-93`
- `annapurna-brno` a `annapurna-josefska-14`
- `roburrito-pekarska` a `roburrito-pekarska-20`
- `skog-urban-hub` a `sk-g-urban-hub-dominikanske-namesti-5`
- `monogram-espresso-bar` a `monogram-espresso-bar-kapucinske-namesti-12`
- `yakitori-netroufalky-770` a `yakitori-sushi-poke-bar-netroufalky-770`

Další pravděpodobný pár se neshoduje v souřadnicích, protože ručnímu záznamu chybí: `statl-brno` (nám. Svobody 97/3, web statlbrno.cz) a `statl-namesti-svobody-3` (náměstí Svobody 3, stejná doména, souřadnice v datech jsou). Nesloučeno.

Stejný název na jiné adrese je u 35 názvů. To jsou spíš pobočky, ne duplicita jednoho místa.

## Odkazy

- Rozbitý OSM web u `palazzo-silingrovo-namesti-2` (`http://https%3A%2F%2Fwww.facebook.com%2F…`) se jako oficiální web nezobrazí. Filtr ho zahodí. Facebookové odkazy taky.
- Jako oficiální web se zobrazují i `local-barber-shop.cz`, `nahasicce.sweb.cz` a `rajhlinky.wz.cz`. Jestli stránky fungují a patří k podniku, jsem neověřoval.
- U `kavarna-cukrarna-smile-s-r-o-namesti-28-dubna-10-40` byla v adrese zdvojená PSČ (`63500;635 00`). Nechal jsem jednu, `635 00`, a sjednotil vyhledávací odkaz na Mapy. Ulice a číslo zůstaly.

## Co audit neměnil

Ceny, zdroje menu a data ověření jsem nevymýšlel. Odhad se dál neslučuje přes ověřenou cenu: generátor odhadů ověřená id přeskakuje.
