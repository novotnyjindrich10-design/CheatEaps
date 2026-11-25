# FOODGO – Deep restaurant photo quality audit

Vygenerováno: 2026-11-25  
Větev: `foodgo-launch-preview`

## Metoda — co bylo ověřeno a co ne

**Ověřeno automaticky u všech 774 veřejných podniků:**

- Existence fotografie (oficiální vs ilustrace).
- Soulad očekávaného dish key (`dishSpecForPlace`: override / name_specific / category / name / fallback) s `foodIllustrationTheme`.
- Licence dle zdroje (Pixabay Content License, Pexels, Unsplash, oficiální `heroImageRights`).
- Existence lokálního souboru, počet unikátů a opakování.
- Ledger řádek na podnik: `reports/deep-photo-quality-ledger.json`.

**Nebylo provedeno:**

- Individuální lidská vizuální kontrola každé z 681 ilustrací (ostrost/chuť/kompozice pixel po pixelu).
- Crawl menu všech webů a ověření konkrétních specialit podniku u každé fotky.
- Nákup stock fotek / placené API kredity.

Contact sheet pro manuální kontrolu: `reports/pixabay-contact-sheet.html` (živý Pixabay pool) a `reports/illustration-contact-sheet.html` (Openverse legacy).

## Souhrn před → po

| Metrika | Před | Po |
| --- | ---: | ---: |
| Prověřených podniků | 774 | 774 |
| Oficiální ponecháno | 93 | 93 |
| Ilustrace | 681 | 681 |
| Ponecháno (theme match / official) | — | 774 (0 mismatch) |
| Nahrazeno (nové/přeřazené ilustrace) | — | ~537 unikátních asset změn v přiřazení (144→358 unikátů) |
| Odstraněné nadměrné duplicity (>3×) | 65 assetů | **0** (zbývá 5 assetů na 4× u `neuvedeno`) |
| Unikátní ilustrace v přiřazení | 144 | **358** |
| Max. opakování | 16 | **4** |
| Theme mismatch | 4 | **0** |
| Licence neověřené (ilustrace) | 0 | 0 |
| Neověřené / nejisté oficiální rights | dle `heroImageRights` | beze změny logiky |
| Velikost knihovny | 179 | 400 |
| Disk `public/food-illustrations/pixabay` | — | ~66 MB |

## Licence

- Nové i stávající ilustrace: lokální kopie z Pixabay API (`largeImageURL`) nebo dříve ověřené Pexels náhrady AI snímků.
- Hotlink Google/Instagram/Facebook/Wolt **nepoužit**.
- UI dál zobrazuje označení **Ilustrační fotografie**.

## Nejvýraznější zlepšení

1. Kavárny: opakování kávových fotek z ~16× na ≤3–4× díky fondu 70 snímků.
2. Česká / pizza / asijská: širší pool, rovnoměrnější střídání.
3. Opravy relevance: Oh! Phở, Pho Viet nam, TOPPU RAMEN, VietPalace, Bubblify, Cha Dō, Pokecz, Subway, Jomsom, Veselá čajovna, Dhaba Beas, Vegalité.

## Výkon

| Položka | Před | Po |
| --- | --- | --- |
| `index-*.js` (gzip) | ~111 kB | ~111 kB (beze změny) |
| `demoRestaurants-*.js` | ~1.08 MB | ~1.08 MB (beze změny) |
| Ilustrace | lazy loading beze změny | beze změny |
| JS bundle | bez vložených bitmap | bez vložených bitmap |

Fotky jsou samostatné soubory pod `/food-illustrations/`; hlavní JS bundle se nezvětšil.

## Artefakty

- `reports/deep-photo-quality-ledger.json`
- `reports/deep-photo-quality-audit.json`
- `reports/deep-photo-quality-audit.before.json` (baseline)
- `reports/pixabay-contact-sheet.html`
- `scripts/deep-photo-quality-audit.mjs`
- `scripts/restore-niche-pixabay-themes.mjs`
- `scripts/generate-pixabay-contact-sheet.mjs`
