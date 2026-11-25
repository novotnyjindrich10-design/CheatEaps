# Podezřelé podniky k ruční kontrole

Stav k 2026-11-05. Automatický `npm run audit:catalog` nenašel potvrzenou chybu klasifikace (0). Níže jsou jen místa, kde data nestačí k jisté opravě. Nic z toho se v katalogu nemazalo a nic se nedoplňovalo odhadem.

## Z auditu katalogu

- `cha-do-zelny-trh-10` — OSM `tea;chinese;japanese;asian;korean`, teď kavárna. Ověřit, jestli je to čajovna, nebo asijská restaurace.
- `fenix-lounge-restaurace-masarykova-32` — OSM `teahouse;pizza;middle_eastern`, kategorie pizza. Ověřit zaměření lounge.
- `coffee4all-chironova-8` — ruční override na kavárnu, OSM má i pizzu. Vypadá záměrně, neměnit bez nové kontroly webu.
- `bar-caffe-elephant-lidicka-43` — amenity cafe a cuisine `local;regional`, kategorie česká, popis pořád mluví o kavárně.
- `park-lane-luzanecka-4a` — amenity cafe a regional, kategorie česká. Ověřit, jestli je to kavárna, nebo restaurace.
- `kimono-bayerova-572-2` — amenity cafe a japanese, kategorie asijská. Ověřit koncept.
- `plzensky-dvur-sumavska-29a` — po opravě steakhousu `neuvedeno`. Případně ručně česká kuchyně podle webu.

## 2026-11-25 — nekulinární a blízké duplicity

- `local-barber-shop-smetanova-5` — **opraveno**: skryto z veřejného katalogu (holičství).
- `point-burger-namesti-svobody-8` / `point-cafe-namesti-svobody-8` — stejná adresa, různé amenity. Bez automatického sloučení.
- `svedska-kavarna-skandinavska-4` / `svedska-restaurace-skandinavska-4` — stejná adresa, cafe vs fast_food. Bez automatického sloučení.
- `trinity-trnita-7` / `trinity-ristorante-trnita-9` — sousední adresy. Bez automatického sloučení.

## Nově při hledání, bez automatické opravy

- `let-s-steaking-dominikanska-3` (Let’s STEAKing) — OSM cuisine `burger;steak_house`, proto je v kategorii Burger. Název zní jako steakhouse. Hledání „Burger King“ ho už neshodí. Kategorii neměnit, dokud se neověří menu.
- `kebab-99-palackeho-trida-92` (Kebab 99!, Palackého třída 92, PSČ 612 00) — adresa neobsahuje „Královo Pole“, ale stejné PSČ v katalogu u 11 podniků s městskou částí patří Královu Poli a u 51 podniků městská část chybí. Hledání „kebab Královo Pole“ proto Kebab 99 nenajde. Nepřiřazovat čtvrť jen podle PSČ.
- Burger King (všech 5 poboček) — kategorie Burger je v pořádku. OSM má `diet:vegetarian`, karta proto ukazuje štítek vegetariánské nabídky. Nejde o bezmasou restauraci. Hledání „bez masa“ je už nevrací.

## Co se neopravovalo

- Prime Steak je restaurace (`neuvedeno`), ne kavárna. Regex `tea` uvnitř `steak_house` je v klasifikátoru opravený dřív a audit ho znovu nepotvrdil jako chybu.
- Podniky s chybějící cenou, fotkou nebo otevírací dobou se nemazaly.
