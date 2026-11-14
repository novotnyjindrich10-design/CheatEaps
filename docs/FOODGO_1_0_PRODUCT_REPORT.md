# FoodGo 1.0 — Product Report

Datum: 2026-11-14  
Větev: `foodgo-launch-preview`  
Commit (před tímto sprintem): `e4d91ad`  
Preview: https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app  
Produkce (neměněna): https://cheat-eaps.vercel.app

## Verdikt

**Free katalog je technicky použitelný.** Veřejné vydání **není GO**, dokud provozovatel nedoplní právní identitu (`OPERATOR`) a neověří produkční env.

**Ostré platby: NE** — jen bezpečný stub / testovací architektura.

---

## 1. Původní problémy (nejhorší)

1. Historicky mapa vyžadovala / vypadala, že vyžaduje placený tile API klíč (Carto od 2026-09).
2. Prázdná identita provozovatele → Privacy/Terms bez právní platnosti.
3. SPA bez prerenderu → crawlers viděly prázdný `#root`.
4. Cenový filtr bere jen ověřené ceny (68/775) — uživatelé „levného oběda“ často dostali prázdný výsledek bez vysvětlení.
5. FitBounds na mapě skákal při každé změně filtrů.
6. Duplicitní `Sitemap:` v `robots.txt` po buildu.
7. Preview hostname mohl být indexován stejně jako produkce.

---

## 2. Provedené změny (tento sprint)

### Mapa a poloha
- OpenFreeMap Positron bez API klíče (už v `b7fb3e6` / `e4d91ad`); doplněno UX:
  - cena v popupu značky,
  - odlišení sponzorovaných pinů,
  - `maxBounds` kolem Brna,
  - fitBounds jen při změně množiny bodů + tlačítko „Zobrazit všechny body“,
  - jasná hláška, že podklad nepotřebuje klíč.

### Katalog / filtry UX
- Prázdný výsledek při rozpočtu / „jen ověřené“ vysvětluje omezení ověřených cen.
- Homepage a filtry říkají, že filtr nebere odhady.

### SEO
- Build hook `scripts/prerender-seo.mjs`: 6 veřejných stránek + **775** HTML snapshotů detailů.
- Preview / non-prod host → `noindex, nofollow` v runtime meta.
- Oprava duplicitního Sitemap řádku při buildu.

### Fotografie
- Rozšíření licence metadata o Unsplash / Pexels (ilustrace, ne snímky podniků).
- Atribuce v patičce a na detailu podle skutečného providera.

### Dokumentace
- Tento report + release checklist + business/payments + growth plan.

---

## 3. Mapa funkcí (stav)

| Funkce | Stav |
| --- | --- |
| Homepage | Funguje |
| Hledání | Funguje |
| Filtry | Funguje (cenový filtr omezený ověřenými cenami — záměr) |
| Mapa Leaflet + OpenFreeMap | Funguje (bez API klíče) |
| Clustering | Funguje |
| Geolokace | Funguje |
| Pěší routing (OSRM) | Vypnuto defaultně (`VITE_FOOT_ROUTING`) — vzdušná čára |
| Detail podniku | Funguje |
| Oblíbené | Funguje |
| Navigace | Funguje |
| B2B neplacený zápis | Částečně (formulář ano; e-mail potřebuje Resend) |
| Placená propagace UI | Vypnuto (`PUBLIC_V1.paidPromotionUi`) |
| Platby | Stub `enabled: false` |
| Admin | Částečně (server-side `/api/admin/me`) |
| Privacy / Terms | Nefunguje jako právní text bez OPERATOR |
| SEO prerender | Funguje po buildu |
| Auth | Částečně (degradace bez Supabase) |

---

## 4. Testy (lokálně 2026-11-14)

| Sada | Výsledek |
| --- | --- |
| Unit | **354/354 PASS** |
| Playwright E2E | **34/34 PASS** |
| Lint | exit 0 (warnings) |
| Build + prerender | PASS (775 restaurant HTML) |
| Catalog audit | PASS (0 confirmed errors, 7 manual) |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

---

## 5. Výkon (orientační)

| Metrika | Stav |
| --- | --- |
| Main JS (gzip) | ~127 kB (`index`) + lazy map ~349 kB |
| Katalog chunk (gzip) | ~193 kB |
| Map lazy-load | ano (`RestaurantMap`) |
| LCP/CLS v terénu | neměřeno Lighthouse v tomto běhu; E2E mobil 320/390 bez horizontálního overflow |

---

## 6. Známá omezení

1. **OPERATOR prázdný** — blokuje vydání.
2. **68 ověřených cen** z 775 — produktová pravda, ne bug; potřeba další ruční ověření menu.
3. **0 ověřených Google ratings** — jen odkaz na Maps search.
4. **4 místa bez souřadnic** — ne na mapě.
5. **144 kategorií „neuvedeno“**.
6. Ilustrační fotky ≠ fotky konkrétních podniků.
7. Resend / produkční env / Auth redirects — k ověření provozovatelem.
8. Ostrá platební brána není napojená.

---

## 7. Co záměrně není ve free v1

- Členské slevy UI
- Online placená propagace
- „Podpoř mě“ platba
- Ostré Comgate/GoPay/Stripe transakce
