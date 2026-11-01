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

## Podpoř mě

Stránka `/podpor-me` je osobní výzva k dobrovolné podpoře vývoje. Podpora není spojená s umístěním restaurace, reklamou ani jinou protislužbou. Stará adresa `/pro-podniky` přesměruje sem.

Tlačítko „Podpořit CheapEats“ platbu nespouští. V projektu není ověřená platební adresa, příjemce, podmínky služby ani souhlas zákonného zástupce. Až to bude, doplní se to v `src/constants/supportPayment.js`. Do prohlížeče nepatří tajný klíč a CheapEats neukládá údaje o kartě.

Starší kód nezávazné žádosti o propagaci (`api/promotion-request.js`, `api/quote-promotion.js`) stránka už nevolá. Kdyby někdo zavolal to API přímo, e-mail by dál šel přes [Resend](https://resend.com). Názvy proměnných jsou v `.env.example`: `RESEND_API_KEY`, `INQUIRY_TO_EMAIL` a `EMAIL_FROM`, bez předpony `VITE_`. Lokální obsluha `/api/promotion-request` je ve `vite.config.js`.
