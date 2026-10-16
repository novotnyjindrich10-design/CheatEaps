# Audit diverzity a přiřazení ilustrací

Vygenerováno: 2026-10-16T21:30:09.191Z

Pravidlo: maximálně **3** přiřazení stejného ilustračního obrázku (Openverse ID / SHA souboru).

## Souhrn

| Metrika | Počet |
| --- | ---: |
| Podniků celkem | 775 |
| Oficiální fotky (ponechány) | 93 |
| S ilustrací | 682 |
| Bez ilustrace (fallback SVG) | 0 |
| Unikátních ilustračních assetů | 236 |
| Assetů na limitu 3× | 213 |
| Assetů nad limitem 3× | 0 |
| Výjimky (nelze nahradit – překročen limit) | 0 |

## Potřeba vs dostupný pool

| Dish key | Podniků | Potřeba (≥ ceil(n/3)) | Máme |
| --- | ---: | ---: | ---: |
| kava | 176 | 59 | 59 |
| neuvedeno | 172 | 58 | 58 |
| ceske | 73 | 25 | 25 |
| asijske | 63 | 21 | 21 |
| pizza | 55 | 19 | 19 |
| sladke | 28 | 10 | 10 |
| fastfood | 24 | 8 | 8 |
| burger | 22 | 8 | 8 |
| kebab | 21 | 7 | 7 |
| cina | 14 | 5 | 5 |
| mexiko | 7 | 3 | 3 |
| sushi | 7 | 3 | 3 |
| zdrave | 5 | 2 | 2 |
| pho | 5 | 2 | 2 |
| fried_chicken | 5 | 2 | 2 |
| ramen | 2 | 1 | 1 |
| vegetarianske | 1 | 1 | 1 |
| veganske | 1 | 1 | 1 |
| baguette | 1 | 1 | 1 |

## Výjimky nad limitem 3

- Žádné.

## Bez vhodné fotky

- Žádné.

## Ověření

- **Tematická shoda:** scoring Openverse title/tags + dish rules (název/kategorie).
- **Diverzita:** ověřeno programově — žádné Openverse ID / SHA není použito více než 3×.
- **Vizuální spot-check:** Chicken Inn (smažené stripsy), KFC (jiná fried-chicken varianta), Subway (bageta), oficiální fotky nedotčeny.
- Plná vizuální kontrola všech ~236 assetů člověkem **neproběhla** — neuvádíme 100% vizuální správnost.
- Regenerace: `npm run data:food-illustration-diversify`
