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
