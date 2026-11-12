# FoodGo — Overnight Mega Build

Datum: 2026-11-11  
Stav: **dokončeno + final polish** (bez commit/push/deploy)

## Final polish

- Rozšířený katalogový audit; Leaflet lazy `map` chunk (vendor 438→253 kB)
- Twitter meta; mobilní CSS + focus; Playwright polish 9 scénářů
- `docs/FOODGO_RELEASE_READY.md`

## Baseline

- 775 podniků, React+Vite+Supabase+Vercel+Resend
- Před startem: mapa chyběla, guest favorites chyběly, „Nevím, co jíst“ chybělo, hlášení chyb chybělo

## Dokončené fáze

### 1 Průzkum
Baseline zaznamenán. Žádný git reset.

### 2 Mapa Brna
- Leaflet + markercluster (lazy chunk)
- Carto Voyager dlaždice (ne `tile.openstreetmap.org`)
- Konfigurace přes `VITE_MAP_TILE_*`
- Přepínač Seznam/Mapa na `/results?view=map`
- Sync s filtry, popup + odkaz na detail, shlukování
- Testy: `mapPlaces`, `mapTiles`

### 3 Okolí
- Existující LocationContext + Haversine + pěší route ponecháno
- Propojeno s „Nevím, co jíst“ a filtrem vzdálenosti

### 4 Fotografie
- Athena `6208833`, Abu Rami `6109976`, BK pobočky unikátní manuály
- Steak/káva audit: 5 dalších steak míst + Prime Steak
- Katalogový audit PASS

### 5–6 Hledání a filtry
- Existující smartSearch (diakritika, synonymá, překlepy) zachován
- Filtry sync seznam↔mapa přes URL

### 7 Nevím, co jíst
- Stránka `/nevim-co-jist`
- Náhodný výběr z filtrovaného poolu, reduced-motion

### 8 Oblíbené
- Guest: `localStorage cheapeats.favorites.v1`
- Auth: beze změny `/api/favorites`

### 9 Otevírací doba
- `openingStatus.js` — open/closed jen u spolehlivých OSM vzorů
- Složité zápisy → unknown (nepretendujeme)

### 10 Denní menu
- Model `dailyMenus.js`, veřejný katalog prázdný (žádná falešná menu)

### 11 Hlášení chyb
- Formulář v detailu + `/api/place-reports` (rate limit, honeypot)
- SQL připraveno: `supabase/place-reports.sql` (**BLOCKED** nasazení)

### 12 Recenze
- Existující community reviews ponechány, bez falešných dat

### 13 Reklamy
- Ceny START/PLUS/PREMIUM beze změny
- Existující poptávka/admin flow

### 14 Statistiky
- In-memory `/api/place-stats/event` (profile_view z detailu)
- SQL: `supabase/place-stats.sql` (**BLOCKED**)
- Veřejně se čísla nezobrazují

### 15–16 Design / výkon / SEO / security
- CSS mapa/surprise/report, touch targety
- Lazy mapa + SurpriseMe
- Sitemap + pageMeta pro `/nevim-co-jist`
- Privacy aktualizována o local favorites

### 17–18 Testy / launch
- Unit **331/331**
- Lint exit 0 (warnings)
- Build PASS
- Catalog audit PASS
- Playwright public **12/12**
- launch:check PASS

## Blokované (vyžadují souhlas)

- Commit / push / deploy
- Produkční SQL migrace (`place-reports`, `place-stats`)
- Ověřená Resend odesílací doména
- Živé Google Places Photo
- Skutečné platby / ostré e-maily

## Další krok po souhlasu

1. Projít diff a commitnout
2. Deploy na Vercel
3. DNS + Resend doména
4. Volitelně SQL migrace reportů/statistik
