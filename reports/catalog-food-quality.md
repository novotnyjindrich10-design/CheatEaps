# Catalog food quality audit

Vygenerováno: 2026-11-25 (FoodGo data quality pass)

## Souhrn

- Podniků v surovém merge (curated + OSM): **775**
- Veřejný katalog po exclusions: **774**
- Potvrzené nekulinární (opraveno skrytím): **1**
- Nejisté položky k ruční kontrole: **4**
- Známé duplicitní páry (skrývané ve výpisu): **11**
- Nové blízké souřadnice + podobný název (neskrýváno): **3**
- Podezřelé ceny / souřadnice mimo Brno / divné weby: **0**

## Potvrzené nekulinární — změny

| ID | Název | Akce |
| --- | --- | --- |
| `local-barber-shop-smetanova-5` | LOCAL BARBER SHOP | Skryto z veřejného katalogu (`catalogExclusions.js`). OSM `amenity=cafe` je chybné; web `localbarber-shop.cz` dokládá holičství. Data v `osmPlaces.js` zůstávají pro audit. |

## Nejisté (ruční kontrola, bez automatické změny)

- `point-burger-namesti-svobody-8` / `point-cafe-namesti-svobody-8` — stejná adresa (~13 m). Burger a kavárna mohou být dva provozy.
- `svedska-kavarna-skandinavska-4` / `svedska-restaurace-skandinavska-4` — stejná adresa (~12 m). OSM cafe vs fast_food.
- `trinity-trnita-7` / `trinity-ristorante-trnita-9` — Trnitá 7 vs 9 (~19 m). Pravděpodobně sousední provozy.
- `restaurace-hotel-lazaretni-lazaretni-6` — hotelový web, ale název je restaurace; ponecháno ve veřejném katalogu.

## Co se neměnilo

- Chybějící ceny, fotky a otevírací doby se nedoplňovaly.
- Nejisté duplicity se neskrývaly.
- Produkční databáze beze změny.
