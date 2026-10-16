# Audit generování cenových odhadů

Stav k 16. 10. 2026. **Kód ani ceny jsem neměnil.** Ceny na internetu jsem neověřoval.

Legenda:

- **Fakt** — ověřitelné z kódu nebo z uložených dat v repozitáři.
- **Předpoklad** — interpretace nebo návrh, ne měření reálných menu.

---

## 1. Jak se odhady počítají

### Zdroj (fakt)

Jediný generátor je `scripts/generate-price-estimates.mjs`. Výstup zapisuje do `src/data/estimatedPrices.js` a shrnutí do `reports/price-coverage.json`. Regenerace: `npm run data:price-estimates`.

Sloučení v aplikaci (`src/data/demoRestaurants.js`): nejdřív odhad, pak `verifiedPrices`. Podnik s ověřenou cenou **odhad nedostane** (přeskočí se v generátoru).

Aktuální pokrytí (fakt, souhlasí s `price-coverage.json` i `check:places`):

| | Počet |
| --- | ---: |
| Podniků celkem | 775 |
| Přeskočeno kvůli ověřené ceně | 68 |
| Odhadů | 707 |
| confidence medium | 512 |
| confidence low | 195 |
| confidence high | 0 |

### Algoritmus zařazení (fakt)

`estimateFor(place)` jde shora dolů a **první shoda vyhrává**:

1. **Ruční výjimky podle id** — Rebio (2×), Dhaba Beas (1×). U Rebio poznámka cituje 43,90 Kč / 100 g a odhaduje porci 300–400 g.
2. **Heuristiky podle názvu řetězce** — McDonald’s, KFC, Burger King, Subway, Bageterie Boulevard, Starbucks, UGO.
3. **Heuristiky podle textu** (`name` + `type` + `description`):
   - jídelna / menza / canteen / automat
   - steak / hotel / grandezza / pavillon / gourmet / fine dining → prémiové pásmo, `low`
   - sushi → sushi pásmo
4. **Tabulka podle `place.category`** — kebab, fastfood, burger, pizza, asijske, cina, mexiko, ceske, kava, sladke, zdrave, vegetarianske, veganske.
5. **Fallback** — pokud kategorie není v tabulce (typicky `neuvedeno`): pásmo 139–249 Kč + jitter, položka „běžné hlavní jídlo“, `low`.

### Výpočet čísel v pásmu (fakt)

```text
jitter = (hash(id) % 5) * 5          → 0, 5, 10, 15 nebo 20 Kč
extra  = adresa obsahuje PSČ 602 00 ? 10 : 0
min'   = baseMin + jitter + extra
max'   = baseMax + jitter + extra
max'   = max(min' + 30, max')
```

Rozdíly mezi podniky ve stejné kategorii jsou tedy **deterministický posun o desítky korun**, ne naměřená data z menu.

`priceCategory` u odhadu se počítá jako `derivePriceCategory(max')` (budget ≤120, standard ≤200, jinak premium). **V UI štítku kategorie ceny se u odhadů nepoužívá** — `RestaurantDetail` bere `priceCategory` jen při `hasVerifiedPrice`.

### Co odhad **nepoužívá** (fakt)

- Ověřené ceny jiných podniků stejné kategorie (žádný průměr z `verifiedPrices`)
- OSM tagy ceny / `price` / lunch menu částky
- Scraping menu
- Google Places cenovou hladinu
- Ruční ceníky mimo 3 id výjimky a pevná pásma

---

## 2. Liší se odhady podle typu podniku?

**Ano částečně (fakt)** — pokud má podnik správnou `category` nebo padne na jmennou heuristiku.

### Pevná základní pásma podle kategorie (fakt)

| Kategorie | Základ min–max (před jitter/centrem) | Položka | Jistota |
| --- | --- | --- | --- |
| sladke | 49–89 | zákusek | medium |
| kava | 89–159 | snídaně nebo bageta ke kávě | medium |
| kebab | 109–159 | kebab / wrap | medium |
| fastfood | 99–159 | rychlé občerstvení | medium |
| cina | 129–189 | čínské hlavní jídlo | medium |
| asijske | 139–229 | asijské hlavní jídlo | medium |
| vegetarianske | 139–199 | vegetariánské hlavní jídlo | medium |
| veganske | 149–199 | veganské hlavní jídlo | medium |
| zdrave | 149–219 | bowl / zdravé hlavní jídlo | medium |
| mexiko | 159–229 | taco / burrito | medium |
| ceske | 149–249 | české hlavní jídlo | medium |
| pizza | 159–269 | pizza | medium |
| burger | 159–279 | burger | medium |
| *(neuvedeno fallback)* | 139–249 | běžné hlavní jídlo | **low** |

Speciální pásma mimo tabulku (fakt): jídelna ~79–129, sushi ~189–349, „prémiové“ ~289–459 (`low`), řetězce (McD/KFC/… ) vlastní užší pásma.

### Pokrytí odhadů podle kategorie (fakt)

| category | Odhadů | Dominantní položka |
| --- | ---: | --- |
| kava | 182 | snídaně/bageta (176), 5× prémiové kvůli jménu |
| neuvedeno | 193 | 180× běžné hlavní jídlo (`low`) |
| asijske | 75 | 61× asijské + 14× sushi |
| ceske | 71 | české hlavní jídlo |
| pizza | 50 | pizza (1× steak heuristika) |
| fastfood | 45 | rychlé občerstvení |
| sladke | 31 | zákusek |
| burger | 23 | burger / běžný burger řetězce |
| kebab | 15 | kebab |
| … | … | … |

**Předpoklad:** Rozdělení podle typu je záměrně hrubé (kavárna ≠ kebab ≠ steak), ale uvnitř kategorie jsou podniky téměř zaměnitelné.

---

## 3. Opírají se o reálná data, nebo o pevná pásma?

### Fakt

| Část | Opora o data |
| --- | --- |
| 3 ruční id (Rebio, Dhaba) | Částečně — poznámka odkazuje na oficiální logiku váhy / Kč za 100 g; **konkrétní rozmezí porce je odhad** |
| ~24 šablon poznámek | Pevný text v generátoru |
| Tabulka `byCat` | Pevná čísla v kódu, ne výpočet z `verifiedPrices` |
| Jitter + +10 Kč za centrum (602 00) | Syntetické |
| 707 záznamů v `estimatedPrices.js` | Regenerovaný snapshot těchto pravidel |

Porovnání s ověřenými cenami v projektu (fakt — průměry z `verifiedPrices`, ne z webu):

| Kategorie | Ověřených | Ø dolní ověřená | Ø horní ověřená | Ø dolní odhad | Ø horní odhad |
| --- | ---: | ---: | ---: | ---: | ---: |
| pizza | 12 | 180 | 261 | 176 | 287 |
| asijske | 12 | 155 | 236 | (základ 139–229 + jitter) | |
| ceske | 11 | 163 | 230 | (základ 149–249) | |
| burger | 2 | 202 | 202 | (základ 159–279) | |

U pizzy jsou odhadová pásma **řádově blízko** ověřeným průměrům v datech. To **nedokazuje**, že generátor čte ověřená data — jen že pevná konstanta 159–269 není úplně mimo. U burgerů je vzorek ověření příliš malý (2).

**Závěr (fakt + předpoklad):** Odhady jsou primárně **pevná obecná pásma + jitter**. Nejde o model natrénovaný na menu. Několik výjimek má slabší vazbu na oficiální ceník (váha).

---

## 4. Může špatná kategorie způsobit zavádějící cenu?

**Ano (fakt).** Kategorie vzniká hlavně v `scripts/generate-osm-places.mjs`:

- Preferuje OSM `cuisine`.
- Jinak amenity: `cafe` → kava, `fast_food` → fastfood, `restaurant` / `canteen` bez cuisine → **`neuvedeno`**.
- Všech 193 odhadů s `neuvedeno` má `type: "Restaurace"`.

### Důsledky (fakt)

1. **`neuvedeno` → fallback 139–249 Kč, low**  
   I když název naznačuje typ. Příklady, kde název sedí na jinou kategorii, ale odhad je „běžné hlavní jídlo“:
   - `doe-boy-pizza-napoletana-brno-stefanikova-39` — pizza v názvu, odhad 149–259
   - `pizzeria-la-gamba-okruzni-9b` — totéž
   - `bep-vietnamese-village-cuisine-koblizna-9` — vietnamské, odhad jako obecné hlavní
   - `an-wok-grill-krizova-55-5` — wok, totéž
   - `aida-cafe-restaurant-josefska-21`, `cafe-rudolf-…`, `coffee-trail-lidicka-…` — cafe v názvu, ale `neuvedeno` + běžné hlavní (ne kavárenské pásmo)

2. **Špatná OSM kategorie + silná jmenná heuristika**  
   Prémiové pásmo se bere **před** `byCat`, pokud text obsahuje `steak` / `hotel` / …:
   - `steak-house-k1-zarosicka-24` má `category: pizza`, ale odhad 294–464 („dražší restaurace“)
   - `buffalo-american-steakhouse-…` má `category: kava`, odhad 309–479
   - `prime-steak-…`, `monte-bu-…`, `butcher-s-…` také `kava` + prémiový odhad  

   Tady odhad ceny může být rozumnější než kategorie filtru; **filtr „Kavárny“ ale podnik stále ukáže** (to je problém kategorie, ne samotného pásma).

3. **Heuristika `steak|hotel|…` může přehlasovat správnou kategorii**  
   Např. burger podnik s „grill“/steak v názvu skončí v prémiovém pásmu místo burger 159–279.

4. **Pizza kategorie u nesouvisejícího podniku**  
   Příklad: `bat-beerhouse-julianovske-namesti-3878-2` je v datech jako pizza a má odhad „pizza“ 174–284 Kč. **Předpoklad:** jde o chybné OSM `cuisine`/klasifikaci; odhad pak kopíruje chybu.

---

## 5. Jak zvýšit přesnost bez vymýšlení konkrétních cen

Cíl: lepší orientace, stále jako odhad (ne falšovat ověření).

### A. Kalibrace pásem z vlastních ověřených dat (fakticky proveditelné)

Pro každou kategorii spočítat z `verifiedPrices` percentily (např. p25–p75) a ty použít jako `byCat` místo ručních konstant.  
- **Nevymýšlí** ceny jednotlivých podniků.  
- Opírá se jen o už doložené položky v repu.  
- Slabina: malý vzorek (kebab 0 ověřených, burger 2, sladke 0).

### B. Lepší klasifikace před odhadem

Doplnit do generátoru (nebo do OSM classify) pravidla z názvu/type, která už částečně existují pro sushi/steak, i pro pizza/kebab/cafe/wok — **před** fallbackem `neuvedeno`.  
Největší zásah na 180 low odhadů „běžné hlavní jídlo“.

### C. Odhad jen při dostatečné jistotě kategorie

Pokud zůstane `neuvedeno` a žádná heuristika: **negenerovat odhad** (neznámá cena). Filtr rozpočtu je už teď nebere; karta ukáže „Neověřeno“.  
To zvyšuje upřímnost, snižuje falešný dojem porovnatelnosti.

### D. Sdílení pásma u stejného řetězce / duplicit

Kde už existuje ověřená pobočka (Forky’s, McD), ostatní pobočky stejného brandu mohou dostat pásmo odvozené z ověřené ceny ± tolerance, s poznámkou „odvozeno od ověřené pobočky X, ne z ceníku této adresy“. Stále odhad, ne menu položka.

### E. Oddělit „typ položky“ od „hladiny“

Kavárna / cukrárna už mají jiné `priceItem` (fakt). Doplnit totéž konzistentně u `neuvedeno` po dořešení klasifikace, ať se zákusek neporovnává s gulášem.

### F. Co nedělat (v souladu se zadáním)

- Nepřiřazovat náhodné „konkrétní“ ceny (169 Kč) bez zdroje.  
- Nebrat střed Brna jako cenu.  
- Neoznačovat kalibrovaný odhad jako `menu` / `range` ověřený.

---

## 6. Největší zlepšení při malém zásahu

Seřazeno podle poměru přínos / zásah do projektu:

| Priorita | Úprava | Proč | Zásah |
| ---: | --- | --- | --- |
| 1 | **Name/cuisine fallback před `neuvedeno`** v `estimateFor` (pizza, cafe, pho/wok, kebab v názvu) | Hned opraví desítky zavádějících „běžných hlavních“ | Malý diff v generátoru + regenerace `estimatedPrices.js` |
| 2 | **Kalibrovat `byCat` z percentilů `verifiedPrices`** kde je ≥5 ověření (pizza, asijske, ceske) | Pásma sedí na data projektu, bez scrapingu | Malý výpočet na začátku generátoru |
| 3 | **U `neuvedeno` bez heuristiky nepsat odhad** (nebo jen velmi široké pásmo s forced `low` a výraznějším UI) | Méně falešné přesnosti u 180 podniků | Generátor + případně text na kartě (už umí Neověřeno) |
| 4 | **Zpřesnit OSM `classify`** pro časté názvy / cuisine mezery | Jedna oprava pomůže filtrům i odhadům | `generate-osm-places.mjs` + regenerace osmPlaces (větší datový diff) |
| 5 | **Zúžit prémiovou regex** (např. vyžadovat `steak` jako slovo, ne každé `hotel` v adrese textu) a nepouštět ji přes správnou levnější kategorii bez kontroly | Méně 289–459 u sporných záznamů | Pár řádků v generátoru |
| 6 | Testy generátoru: stejná kategorie → pásmo v očekávaném intervalu; pizza v názvu + neuvedeno → pizza pásmo; verified id přeskočeno | Chrání regressi | Nový `*.test.js`, bez změny produkčních cen dokud se nespustí regenerace |

Úpravy **2 a 1** dávají největší skok kvality bez nutnosti ověřovat stovky menu. Úplná náhrada odhadů ověřenými cenami je jiný projekt (audit `reports/price-audit.md`).

---

## Vztah k filtru a testům (fakt)

- Odhad **nikdy** neprojde rozpočtovým filtrem (`getBudgetComparePrice` → null). Testy v `price.test.js` / `filterRestaurants.test.js` to hlídají.
- Řazení odhady řadí až za ověřené, podle dolní meze odhadu.
- **Žádný test nekontroluje** samotný `generate-price-estimates.mjs` (pásma, jitter, přeskočení verified).

---

## Shrnutí odpovědí

1. **Výpočet:** pevná pravidla + jitter (+10 Kč centrum); zařazení podle id → jméno řetězce → textové heuristiky → `category` → fallback.  
2. **Rozdíl podle typu:** ano přes `category` a pár heuristik; uvnitř kategorie jen malý jitter.  
3. **Reálná data:** skoro ne; výjimky Rebio/Dhaba a pevná pásma „podle Brna“ v komentářích.  
4. **Špatná kategorie:** ano, hlavně `neuvedeno` a chybné OSM kategorie (pizza/kava u steaků atd.).  
5. **Přesnost bez vymýšlení:** kalibrace z ověřených, lepší klasifikace, méně odhadů u neznámého typu, odvození od ověřené pobočky řetězce.  
6. **Nejmenší zásah / největší efekt:** name fallback před `neuvedeno` + kalibrace pásem z `verifiedPrices` + volitelně žádný odhad u zbylého `neuvedeno`.

Nic nebylo commitováno ani nasazeno.
