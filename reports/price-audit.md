# Audit cen CheapEats Brno

Stav sloučeného katalogu (curated + OSM + `verifiedPrices` + `estimatedPrices`) z 16. 10. 2026.

**Tento audit neověřoval ceny na internetu.** Neprocházel jsem menu na webech podniků. Nálezy níže vycházejí jen z dat a kódu v repozitáři. Nic jsem v aplikaci ani datech neměnil.

## Shrnutí počtů (775 podniků)

| Typ ceny | Počet | Podíl |
| --- | ---: | ---: |
| Přesná cena z jídelního lístku (`priceKind: menu`) | **26** | 3,4 % |
| Ověřené cenové rozpětí (`priceKind: range`) | **42** | 5,4 % |
| Pouze odhad (`priceKind: estimate`) | **707** | 91,2 % |
| Neznámá / chybějící cena | **0** | 0 % |
| **Ověřené celkem (menu + range)** | **68** | 8,8 % |

Další rozklad:

- Odhad medium: 512
- Odhad low: 195
- Odhad high: 0
- Všechny ověřené záznamy mají `priceChannel: venue` a `priceSourceType: official`
- Všech 68 ověřených má stejné datum `priceVerifiedAt: 2026-10-10`
- Overlaye bez sirotků: všech 68 ověřených i 707 odhadů míří na existující id
- Žádný podnik nemá zároveň záznam v `verifiedPrices` i `estimatedPrices` (překryv 0)
- Neúplný ověřený ani odhadový záznam (podle `hasVerifiedPrice` / `hasEstimatePrice`): 0

## Jak se cena skládá

1. `demoRestaurants.js` sloučí `estimatedPrices[id]` a potom `verifiedPrices[id]`.
2. Ověřený overlay má přednost. Odhad nesmí mít `priceSource` ani `priceVerifiedAt` (`check:places` to hlídá).
3. UI bere `formatCardPrice` / `formatPlacePrice` z `src/utils/price.js`.
4. Filtr rozpočtu bere jen `getBudgetComparePrice` → nejnižší ověřenou cenu. Odhad vrací `null` a filtr ho vyřadí.

## Rozlišení ověřená / odhad / neznámá

| Místo | Ověřená | Odhad | Neznámá |
| --- | --- | --- | --- |
| Karta | částka + štítek **Ověřeno** (zelený caption) | `~min–max Kč` + **Odhad** (oranžový caption) | `—` + **Neověřeno** |
| Detail | „Ověřená cena“, položka, datum, odkaz na zdroj | „Odhad ceny“ / nízká jistota + `priceNote` | „Cena neověřena“ |
| Filtr | label „Max. ověřená cena“ + nápověda o nejnižší ověřené ceně | neprojde limitem | neprojde limitem |
| Řazení | tier 0 (první) | tier 1 | tier 2 (nakonec; teď 0 podniků) |

**Závěr k rozlišení:** V kódu se odhad za ověřenou cenu nevydává. `hasVerifiedPrice` odhad výslovně odmítá. Karty i detail mají samostatný text i tón. Vizuálně je rozdíl spíš ve štítku a vlnovce `~` než v barvě samotné částky (ověřená i odhadová částka jsou tmavé; odhad je o něco šedší).

Neznámá cena se dnes v UI prakticky neobjeví, protože odhad má každý podnik bez ověření.

## Filtr rozpočtu a řazení

### Filtr

- Odhad ani neznámá cena limit nesplní. Při limitu 150 Kč projde 27 podniků: 6× menu + 21× range, **0 odhadů**.
- U ověřeného rozpětí se bere **dolní mez**. Podnik s 120–360 Kč limitem 150 Kč projde.
- To je v souladu s nápovědou („nejnižší ověřená cena“), ale může překvapit: u 21 z 27 výsledků při limitu 150 Kč je horní mez > 150 Kč (např. Colatransport 120–360, Hladový vlk 139–330).

### Řazení podle ceny

- Ověřené jsou vždy před odhady.
- U ověřeného **menu** se řadí konkrétní cena.
- U ověřeného **range** se řadí **horní mez** (`getVerifiedPriceCeiling`), zatímco filtr bere dolní mez.
- Příklad: Marmite 95–169 Kč se při řazení od nejlevnějších chová jako 169 Kč, ale limitem 150 Kč projde.
- Řazení tedy **není spolehlivé srovnání „kolik zaplatím“** napříč menu vs. širokým range vs. odhadem. Mezi čistými menu položkami je spolehlivější.

## Podezřelé nebo problematické záznamy

Ceny z webu jsem neověřoval. Níže jsou nálezy z datové konzistence a sémantiky položek.

### 1. Duplicitní ověřená cena u jednoho podniku

`bistro-franz` a `bistro-franz-veveri-461-14` mají stejnou cenu 245 Kč, stejnou položku „Anglická snídaně“ a stejný zdroj. Jde o pravděpodobnou duplicitu curated + OSM (už zmíněnou v `reports/data-quality.md`).

### 2. Reprezentativní položka nemusí být „běžné hlavní jídlo“

| Id | Položka | Cena | Poznámka |
| --- | --- | ---: | --- |
| `padowetz-masarykova-34` | Zebří guláš na ovocném bourbonu | 389 Kč | prémiová / netypická položka jako jediná ověřená cena |
| `bistro-franz` (+ OSM duplikát) | Anglická snídaně | 245 Kč | snídaně, ne oběd/večeře |
| `no-gluten-no-problem-…` | sýrové placky, batátové hranolky | 280 Kč | spíš sada / specialita |
| `taiyo-solnicni-636-3a` | rizoto a polévka | 159 Kč | vypadá jako polední set |

### 3. Polední ceny vs. celodenní nabídka

Asi 15 ověřených záznamů je vázaných na polední / obědové menu. V katalogu vypadají levněji než večerní nabídka téhož podniku, ale aplikace to jako „jen oběd“ na kartě nezdůrazní (detail položku ukáže).

Příklady: Ilegal, Il Capo, Himalaya, Veg8Cafe, Charlie’s Mill, Globus, Al Capone, Fako Club, …

### 4. Velmi široká ověřená rozpětí

| Id | Rozpětí | Šířka |
| --- | --- | ---: |
| `colatransport-pisniky-409` | 120–360 Kč | 240 |
| `gusto-plzenka-husova-16` | 170–380 Kč | 210 |
| `hatsu-udolni-33` | 185–395 Kč | 210 |
| `hladovy-vlk-jiraskova-51` | 139–330 Kč | 191 |
| `don-antonio-pizza-burger-…` | 179–339 Kč | 160 |

U filtru stačí dolní mez. U řazení rozhoduje horní mez. Uživatel tedy vidí levný vstup do limitu, ale v řazení „nejdražší“ skáče podnik nahoru.

### 5. Stejné datum ověření u všech 68

Všechna ověření mají `2026-10-10`. Buď šlo o jednu dávku, nebo se datum neudržuje po jednotlivých kontrolách. Bez kontroly webů nelze říct, které ceny jsou zastaralé.

### 6. HTTP zdroje (5)

`mr-sushito`, `na-knofliku`, `park-lane`, `u-richarda`, `u-trech-certu` odkazují na `http://…`. Neznamená to špatnou cenu, jen slabší / přesměrovaný zdroj.

### 7. Odhad je heuristika, ne měření

`scripts/generate-price-estimates.mjs` skládá odhady z kategorie, názvu a malého „jitter“ z id. Důsledek:

- Desítky podniků sdílí stejné pásmo (např. 45× `154–264 Kč` „běžné hlavní jídlo“ low; 44× `99–169 Kč` „snídaně nebo bageta ke kávě“).
- 195 odhadů má nízkou jistotu.
- Cukrárny mají odhad zákusku (ok sémanticky), kavárny snídani/bagetu, steak housy široké prémiové pásmo.
- Odhad **není** vydáván za ověřenou cenu, ale na kartě vypadá jako reálné číslo s `~` a štítkem Odhad.

### 8. Pokrytí kategorií ověřenými cenami

| Kategorie | Celkem | Ověřeno | Odhad |
| --- | ---: | ---: | ---: |
| kebab | 15 | 0 | 15 |
| sladke | 31 | 0 | 31 |
| vegetarianske | 1 | 0 | 1 |
| burger | 25 | 2 | 23 |
| kava | 186 | 4 | 182 |
| neuvedeno | 209 | 16 | 193 |
| pizza | 62 | 12 | 50 |
| asijske | 87 | 12 | 75 |
| ceske | 82 | 11 | 71 |

## Vydává se někde odhad za ověřenou cenu?

**Ne v aplikační logice.** Kontrola:

- `hasVerifiedPrice` vrací false pro `priceKind === 'estimate'`
- žádný odhad nemá `priceSource` / `priceVerifiedAt`
- filtr rozpočtu odhady vyřazuje
- karta i detail mají explicitní štítek Odhad / text „Toto není ověřená cena z menu“
- `check:places` selže, když by odhad předstíral zdroj nebo datum ověření

Riziko je spíš UX: při vypnutém filtru rozpočtu uživatel vidí ~91 % katalogu s číselnou cenou, z toho naprostá většina jsou odhady. Štítek „Odhad“ je malý.

## Nejdůležitější problémy (priorita)

1. **Jen 8,8 % katalogu má ověřenou cenu** – filtrování a srovnávání podle ceny pokrývá malou část Brna.
2. **Filtr bere dolní mez range, řazení horní mez** – stejný podnik se chová jinak ve filtru a v sortu.
3. **Široká ověřená rozpětí** (120–360 atd.) oslabují smysl limitu „do X Kč“.
4. **Polední / netypické položky** jako jediná ověřená cena zkreslují srovnání.
5. **Duplicita Bistro Franz** se stejnou ověřenou cenou.
6. **Odhady jsou šablonové pásma** – vhodné jako orientace, nevhodné jako podklad pro „kolik to stojí“.
7. **Jedno společné datum ověření** – bez reauditů webů nevíme, co je aktuální.
8. **Neznámá cena prakticky neexistuje** – každý podnik bez ověření dostane odhad, takže nejde oddělit „nevíme nic“ od „máme hrubý odhad“.

## Co jde opravit automaticky vs. co vyžaduje ověření menu

### Lze řešit v kódu / datech bez nového scrapingu

- Sjednotit, jestli filtr i řazení berou min, max, nebo střed ověřeného range; popsat to v UI.
- U range na kartě / ve filtru jasněji říct „od X Kč“ místo dojmu pevné ceny.
- Označit polední položky (už je v `priceItem`) výraznějším captionem.
- Odstranit nebo sloučit duplicitní `bistro-franz` / OSM variantu v cenovém overlayi.
- Volitelně: podniky jen s odhadem neřadit mezi „cenově srovnatelné“ stejně agresivně, nebo defaultně zapnout „Jen ověřené ceny“.
- Převést `http://` zdroje na `https://`, pokud redirect existuje (syntaktická úprava, ne ověření ceny).

### Vyžaduje ověření skutečných cen na webu / v provozu

- Aktualizace všech 68 ověřených položek (znovu otevřít zdroj, zapsat dnešní cenu a datum).
- Doplnění ověřených cen u kategorií bez pokrytí (kebab, sladké, většina burgerů a kaváren).
- Výběr reprezentativní položky místo zebřího guláše / snídaně tam, kde má jít o běžné hlavní jídlo.
- Zúžení podezřele širokých range podle konkrétního menu.
- Nahrazení šablonových odhadů doloženými cenami u prioritních podniků.
- Rozhodnutí, jestli cukrárny a kavárny mají v „ceně hlavního jídla“ vůbec figurovat stejně jako restaurace.

## Zdroje v repozitáři

- Data: `src/data/verifiedPrices.js`, `src/data/estimatedPrices.js`, sloučení v `src/data/demoRestaurants.js`
- Logika: `src/utils/price.js`, filtr v `src/utils/filterRestaurants.js`
- UI: `src/components/RestaurantCard.jsx`, `src/pages/RestaurantDetail.jsx`, `src/components/ResultsFilters.jsx`
- Generátor odhadů: `scripts/generate-price-estimates.mjs`
- Kontrola integrity: `scripts/check-places.mjs` (souhlasí s počty 26 / 42 / 707 / 0)
