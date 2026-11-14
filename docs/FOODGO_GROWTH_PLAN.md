# FoodGo — Growth Plan (realistický)

Datum: 2026-11-14  
Cíl: první skuteční návštěvníci v Brně, ne fiktivní „tisíce uživatelů“.

## Principy

- Žádné garantované příjmy ani návštěvnost.
- Kvalita katalogu > počet podniků.
- Měření s respektem k soukromí (bez skrytého trackingu před souhlasem).
- Placená propagace až po právní/platební připravenosti.

## První týden po spuštění free v1

1. Soft launch mezi známými v Brně (škola, práce, skupiny „kde se najíst“).
2. 10–15 ručních feedback sezení: „najdi levný oběd / pizzu poblíž“.
3. Opravit top 5 friction z feedbacku (ne nové feature).
4. Doplnit 20 ověřených cen u populárních míst v centru.
5. Základní měření: pageviews úvodu, `/results`, detail, klik na navigaci/web (až po volbě analytics + souhlas).

## První měsíc

1. Stabilizovat SEO vstupní stránky (kategorie pizza/burger/kava už existují přes filtry; nepřidávat stovky thin pages).
2. Oslovit 15–30 podniků na **neplacený** zápis / opravu údajů.
3. Vyčistit „neuvedeno“ kategorie u nejnavštěvovanějších míst.
4. Sledovat retention: návrat na Oblíbené / opakované hledání (anonymní agregáty).
5. Neslibovat podnikům počet zákazníků.

## První tři měsíce

1. Rozhodnutí: stačí free katalog, nebo spouštět sponzorované karty.
2. Pokud platby: sandbox → 2–3 pilotní podniky → teprve live.
3. Partnerské zmínky (studentské spolky, lokální newslettery) — barter/zmínka, ne fake stats.
4. Pravidelný katalogový audit (měsíčně `npm run audit:catalog`).
5. Zvážit vlastní doménu místo `cheat-eaps.vercel.app`.

## Metriky, které mají smysl

| Metrika | Proč |
| --- | --- |
| Hledání → otevření detailu | Jádro produktu |
| Detail → navigace / oficiální web | Užitečnost |
| GPS povolena vs zamítnuta | UX polohy |
| Prázdné výsledky u rozpočtu | Signál na ověřené ceny |
| Návrat do Oblíbených | Retence |

## Co nedělat

- Keyword stuffing a stovky téměř stejných SEO stránek
- Fake recenze / fake hodnocení ve structured data
- Skrytá reklama v organických výsledcích
- Slibovat ROI podnikům bez dat
