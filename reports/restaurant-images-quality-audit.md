# Audit kvality ilustrací

Vygenerováno: 2026-11-25 (deep photo quality audit)

## Souhrn

| Metrika | Před | Po |
| --- | ---: | ---: |
| Unikátních assetů v přiřazení | 144 | 365 |
| Max. opakování jedné ilustrace | 16 | 3 |
| Assetů s >3 použitími | 65 | 0 |
| Theme mismatch | 4 | 0 |
| Velikost knihovny | 179 | 400 |
| Podniků s ilustrací | 681 | 681 |
| Oficiální fotky | 93 | 93 |

## Co se změnilo

- Rozšířen Pixabay fond (káva, česká, pizza, asijská, …) přes oficiální API + cache.
- Niche témata (`bubble_tea`, `indian`, `poke`, `baguette`, `vegetarianske`) obnovena z lokálních souborů.
- Opraveny chybné přiřazení (pho/ramen/vietnamese/bageta).
- Rovnoměrné přiřazení v rámci tématu (max 3×).

## Ověření

- Automatický ledger: `reports/deep-photo-quality-ledger.json` (774 podniků).
- Contact sheet: `reports/illustration-contact-sheet.html`.
- Individuální lidská vizuální kontrola každé fotky nebyla v tomto běhu provedena; contact sheet slouží k manuální kontrole.
