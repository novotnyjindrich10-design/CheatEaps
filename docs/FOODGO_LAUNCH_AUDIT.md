# FoodGo — launch audit

Datum: 2026-11-11

## Verdikt

Lokálně **připraveno k trial/preview** po schválení deploye. Produkční e-maily stále závisí na ověřené Resend doméně.

## Funkce

| Oblast | Stav |
| --- | --- |
| Katalog + filtry | OK |
| Mapa | OK (Carto / konfigurovatelné) |
| Okolí / vzdálenost | OK (bez falešných čísel) |
| Fotografie | OK ilustrace; Athena/Abu Rami/BK opraveny |
| Nevím, co jíst | OK |
| Oblíbené | OK guest + auth |
| Otevřeno teď | OK jen u spolehlivých OSM |
| Hlášení chyb | OK lokálně; SQL BLOCKED |
| Recenze | OK existující |
| Propagace | OK; ceny neměněny; platby ruční |
| Statistiky | Zápis eventů OK; UI čísel ne; SQL BLOCKED |

## Bezpečnost / právní

- Žádné tajné klíče ve sledovaných souborech z tohoto běhu
- Žádný deploy / prod migrace / ostré maily
- Ilustrace nejsou vydávány za fotky provozoven
- Privacy: local favorites zdokumentovány

## Blokery spuštění

1. Deploy není proveden
2. Resend doména
3. Env + Auth redirecty na produkci
4. OPERATOR údaje dle potřeby
