# CheapEats Brno

Studentská webová aplikace pro hledání jídla v Brně. Seznam obsahuje ověřené provozovny (názvy a adresy z oficiálních zdrojů).

## Struktura projektu

```
src/
  data/restaurants.js      – vstup dat (curatedPlaces + osmPlaces)
  constants/filters.js     – možnosti filtrů a řazení
  utils/filterRestaurants.js – filtrování a řazení
  components/              – UI komponenty
  pages/                   – úvod, výsledky, detail
  App.jsx                  – routování
  index.css                – styly
```

Filtry a vyhledávání na `/results` se ukládají do URL (např. `/results?budget=120&type=pizza`).

## Spuštění

```bash
npm install
npm run dev
```

V prohlížeči otevři adresu, kterou vypíše terminál (obvykle http://localhost:5173).

## Sestavení pro produkci

```bash
npm run build
npm run preview
```

## Žádost podniku o měsíc zdarma

Formulář na `/pro-podniky` posílá nezávaznou žádost na `POST /api/promotion-request`. Platba se nestrhává a propagace se sama nezapne. E-mail odchází přes [Resend](https://resend.com). Testy Resend nevolají.

1. Založ účet Resend a vytvoř API klíč.
2. Zkopíruj `.env.example` do `.env` a vyplň `RESEND_API_KEY`, `INQUIRY_TO_EMAIL` a `EMAIL_FROM`. Soubor `.env` do Gitu nepatří.
3. Bez vlastní domény Resend doručí jen na e-mail účtu. `EMAIL_FROM` je pak `CheapEats Brno <onboarding@resend.dev>` a `INQUIRY_TO_EMAIL` je e-mail toho účtu.
4. Na vlastní schránku je potřeba v Resend ověřit doménu a `EMAIL_FROM` nastavit na adresu z této domény.
5. Spusť `npm run dev` a žádost odešli z `/pro-podniky`. Úspěch se ukáže až když server e-mail přijme. `npm run preview` ani samotný Vite vývojový server bez tohoto projektu by složku `api/` neobsloužily; lokální obsluha je zapojená ve `vite.config.js`.
6. Na Vercelu přidej stejné tři proměnné v nastavení projektu. Nepoužívej předponu `VITE_`. Nasazení samo o sobě klíč do prohlížeče nedává.

Než se mají žádosti přijímat veřejně, chybí obchodní podmínky a informace o zpracování osobních údajů. Fotografie se e-mailem neposílají, jen jejich názvy.
