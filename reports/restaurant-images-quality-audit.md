# Audit kvality přiřazení fotografií (detail)

Vygenerováno: 2026-10-16T20:56:02.022Z

Automatická kontrola porovnává **název, kategorii** (a u neuvedeno i popis) s **dish key** a metadaty assetu.
Neprovádí se vizuální kontrola všech 775 fotek člověkem — **neuvádíme 100% správnost**.

## Souhrn (poslední běh opravného skriptu)

| Metrika | Počet |
| --- | ---: |
| Zkontrolovaných podniků | 775 |
| Nalezených problémů před opravou (tento běh) | 5 |
| Opravených přiřazení v tomto běhu | 5 |
| Problémů zbývajících po opravě (automaticky) | 0 |
| K ruční kontrole | 0 |

### Hlavní opravy v celé kvalitní fázi (ověřené)

- **Chicken Inn / KFC** → `fried_chicken` (stripsy + hranolky, CC0) místo pečiva
- **Obecný fastfood** → hranolky (ne bageta/pečivo)
- **Bageterie / Subway** → `baguette` (původní pečivový asset jen sem)
- **Sushi v názvu** → `sushi`; **ramen** → `ramen`; **pho** → `pho`
- OSM multi-tagy v popisu už **nepřebíjí** primární kategorii

## Chicken Inn nám. Svobody

- ID: `chicken-inn-svobody`
- Kategorie: fastfood
- Dish key: **fried_chicken** (name_specific)
- Jídlo: smažené kuře / stripsy
- Asset: Chicken strips and sweet potato fries (`/food-illustrations/shared/fried_chicken-73034d3c.jpg`)
- Licence: cc0

## Pravidla (zkráceně)

- Silný tip z názvu/id (Chicken Inn → smažené kuře, Sushi Mix → sushi, Bageterie → bageta) má přednost před kategorií.
- OSM cuisine v popisu nepřebíjí kategorii (často multi-tag).
- Obecný `fastfood` používá hranolky, ne pečivo.
- Oficiální fotky se nepřepisují.
- Nejisté případy jdou do ruční kontroly.

## Ukázka oprav

- Faircafe (`faircafe-rybarska-202-19`): `neuvedeno` → `kava` (name)
- Pivnice Masný růžek (`pivnice-masny-ruzek-krenova-70`): `neuvedeno` → `ceske` (name)
- Pivnice Na pískách (`pivnice-na-piskach-bayerova-23`): `neuvedeno` → `ceske` (name)
- Pivnice Pegas (`pivnice-pegas-jakubska-120-4`): `neuvedeno` → `ceske` (name)
- Pivnice U Tygra (`pivnice-u-tygra-vrchlickeho-sad-3`): `neuvedeno` → `ceske` (name)

## K ruční kontrole

- Žádné automaticky označené.

## Aktualizace diverzity (2026-10-16T21:26:01.423Z)

Spuštěna diverzifikace: max 3× stejný obrázek. Unikátních assetů: 221. Výjimky nad limitem: 41. Detail: `restaurant-images-diversity-audit.md`.

## Aktualizace diverzity (2026-10-16T21:27:24.118Z)

Spuštěna diverzifikace: max 3× stejný obrázek. Unikátních assetů: 232. Výjimky nad limitem: 10. Detail: `restaurant-images-diversity-audit.md`.

## Aktualizace diverzity (2026-10-16T21:30:09.191Z)

Spuštěna diverzifikace: max 3× stejný obrázek. Unikátních assetů: 236. Výjimky nad limitem: 0. Detail: `restaurant-images-diversity-audit.md`.
