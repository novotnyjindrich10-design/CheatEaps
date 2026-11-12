# FoodGo — další kroky

Datum: 2026-11-11

## Teď (vyžaduje tvůj souhlas)

1. Projdi diff overnight buildu a schval **commit / push / deploy**.
2. Vercel Production env: `SUPABASE_*`, `RESEND_*`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL`, `PUBLIC_SITE_URL`.
3. Resend: ověř doménu, pak nastav `EMAIL_FROM` na ověřenou adresu.
4. Supabase Auth Redirect URLs na produkční origin + `/nove-heslo`.
5. Volitelně nasadit SQL `supabase/place-reports.sql` a `place-stats.sql`.

## Až bude deploy

- Ověřit `/results?view=map`, `/nevim-co-jist`, oblíbené bez loginu, hlášení chyby.
- Zvážit vlastní tile provider přes `VITE_MAP_TILE_URL`, pokud Carto nebude stačit.

## Neměnit bez souhlasu

- Ceny START/PLUS/PREMIUM
- Produkční DB data
- Živé Google Places Photo
