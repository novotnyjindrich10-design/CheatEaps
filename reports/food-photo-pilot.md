# Pilot fotografií jídel (20 podniků)

Bezplacené zdroje: HTML oficiálního webu a `/menu`, tag OSM `image`, Wikimedia Commons API, Openverse API. Google Images, Wolt a Unsplash se do použitelných dat neukládaly. Overlay 775 podniků a detail v aplikaci se **neměnily**.

## Jak šlo hledat bez placeného API

| Zdroj | Licence | Vhodnost pro „jídlo této restaurace“ |
|---|---|---|
| Oficiální web / menu | autorské právo podniku | nejlepší shoda, ale není Creative Commons |
| OSM `image=` | musí se ověřit u cílového URL | často interiér nebo cizí stánek |
| Wikimedia Commons | CC / PD v metadatech | u Brna skoro jen false positive (jméno „La Strada“, „Lokal“, „SKØG“) |
| Openverse | CC, filtr `license_type=commercial` | 1 zásah u Lokálu, ale **špatný podnik** |
| Google Images | žádná | jen by objevil URL, ne právo k užití |

Nález v katalogu obrázků **není** svolení. I ověřené jídlo z webu restaurace má `license: restaurant-copyright` — v aplikaci by šlo jen hotlinkovat s uvedením zdroje, ne stahovat a přelicencovat.

## Výsledky

**3 ověřená jídla · 5 ke kontrole · 10 zamítnuto · 2 bez nálezu**

### Ověřené jídlo (`verified_dish`) — zatím nezobrazené v UI

| Podnik | Jídlo | Zdroj | Licence |
|---|---|---|---|
| Forky's Galerie Vaňkovka | Forky's burger (PNG výřez) | [stránka pobočky](https://www.forkys.cz/pobocka/oc-vankovka/) | copyright Forky's |
| Prova Bistro & Pizza | Pizza Margherita | [menu](https://provapizza.cz/menu/) | copyright Prova |
| Úvozna burger & beer | burger s hranolky | [uvozna.cz](https://www.uvozna.cz/) | copyright Úvozna |

### Ke kontrole (`needs_review`) — neukazovat jako ověřené jídlo

| Podnik | Problém |
|---|---|
| Dhaba Beas Panská | kuchař s logem řetězce, ne porce z Panské |
| Stopkova | krásné porce z webu Kolkovny, může to být sdílená fotka sítě |
| Lokofu | oficiální galerie, ale vypadá jako stock miso |
| Oh! Phở | oficiální ChoiceQR koláž sushi, ne jedno jídlo |
| 7days | v HTML byly URL burgeru/pizzy, stažení vrátilo **404** |

### Zamítnuto nebo nic

Špatné místo: Flickr „Lokal“ (jiná kavárna), Wikimedia „La Stampa“, OSM foto **Yakitori** u Monogramu, obecné Brno u SKØG.  
Interiér / výloha: Rebio Špalíček, Mama's, La Strada, Bageterie Vaňkovka, Větrník Lidická.  
Logo: Bistro FRANZ og:image, Ilegal (Wix ilustrace).  
Bez webu: Kurdský Kebab Cejl, Antalya Döner Kebap.

## Chyby skeneru

- Hádané cesty `/menu`, `/nabidka` často 404.
- Wix a ChoiceQR neschovávají jídlo v klasickém `<img>` — bez parseru 0 kandidátů (Ilegal, Oh Pho).
- Commons API bere první slovo názvu (`La`, `Oh`) a vrací nesouvisející soubory včetně PDF.
- OSM dump match podle `name` trefil špatný objekt (Monogram → Yakitori).
- Wikimedia 429 při stahování náhledu.
- `foodora` ikony a `*-icon.png` prošly slovníkem „food“.

Strukturovaná data: `src/data/placeFoodPhotos.pilot.js` (není importované do `demoRestaurants.js`). Surové kandidáty: `reports/food-photo-pilot.raw.json`.

## Návrh rozšíření na 775 (až po tvém souhlasu)

1. **Hlavní kanál:** crawl oficiálních webů + rozpoznání menu (WordPress `/menu`, Shoptet, Wix `wixstatic`, ChoiceQR `cdn-media.choiceqr.com`).
2. **Klasifikace:** logo / interiér / výloha / jídlo (název souboru + vizuální kontrola fronty, ne Google).
3. **Pobočka:** URL nebo alt musí obsahovat název pobočky; u řetězce označit `chain_product`, ne tvrdit „foceno v této hale“.
4. **Licence:** `verified_dish` jen u oficiálního jídla; Commons/Openverse jen když metadata obsahují **celý název + Brno**.
5. **Fronta `needs_review`** v datech, v UI dál ilustrace.
6. **Bez webu (~340):** nechat ilustraci, dokud podnik nedodá foto nebo OSM/Commons nepůjde ověřit.
7. Placené Places/Google Search **nespouštět**, dokud to výslovně neschválíš.
