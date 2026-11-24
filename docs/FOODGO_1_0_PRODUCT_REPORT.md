# FoodGo 1.0 — Product Report

Datum: 2026-11-24  
Větev: `foodgo-launch-preview`  
Preview: https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app  
Produkce (neměněna): https://cheat-eaps.vercel.app

## Verdikt

**Free katalog + mapa jsou technicky použitelné.** Veřejné vydání **není GO**, dokud provozovatel nedoplní právní identitu (`OPERATOR`) a neověří produkční env.

**Ostré platby: NE** — Comgate integrace je v kódu (create + webhook auto-aktivace + test-confirm); skutečná sandbox transakce u Comgate **neproběhla** (chybí merchant účet).

---

## 1. Co bylo hotové před tímto sprinte

- Leaflet + OpenFreeMap bez placeného tile klíče
- Katalog 775 podniků, filtry, detail, geolokace, SEO prerender
- Objednávky propagace + admin workflow + inquiry formulář
- Platební stub (webhook podpis, return URL neaktivuje)

## 2. Co se dokončilo / opravilo (tento běh)

### Mapa
- Karta podniku (foto, kuchyně, adresa, ověřená cena, hodnocení, vzdálenost, detail, navigace)
- Spodní panel + synchronizace výběr seznam ↔ marker
- Barevné markery podle kategorie + zvýraznění výběru + sponzorované piny
- Tlačítka Moje poloha / Zobrazit všechny body / Zapomenout polohu
- GPS povolena i odmítnuta — mapa zůstává použitelná
- E2E polish mapa: 14/14 PASS

### Platby
- Comgate `buildGatewayPayment` + `createComgatePayment` + `POST /api/payments/create`
- Webhook po ověřeném podpisu kontroluje částku/měnu a **automaticky aktivuje** propagaci
- Test-confirm zůstává mimo Production; return URL stále neaktivuje
- UI zůstává na **Nezávazná poptávka** (žádné falešné „Zaplatit“)
- Stránka `/pro-podniky/ucet` pro stav poptávky

### Data
- **771 / 775** podniků s platnými souřadnicemi v Brně
- 4 bez coords (nemapováno, poloha nevymyšlena): `mamas-burger`, `cukrarna-vetrnik-lidicka`, `cukrarstvi-martinak`, `chicken-inn-svobody`

---

## 3. Testy (2026-11-24)

| Sada | Výsledek |
| --- | --- |
| Unit | **361/361 PASS** |
| Playwright polish | **14/14 PASS** |
| Lint | exit 0 (warnings) |
| Build (v launch:check) | PASS |
| Catalog audit | PASS |
| launch:check --offline | **BLOCKED** (`operator-identity`) |

---

## 4. Blokátory

### Veřejné vydání free katalogu
1. OPERATOR identita (legalName, IČO, adresa, email)
2. Právní kontrola Privacy/Terms
3. Produkční env + Auth redirects
4. Schválený merge → main

### Ostré platby
1. Comgate smlouva + sandbox merchant
2. Env: `PAYMENT_*`, `PAYMENTS_SANDBOX_OUTBOUND`, webhook URL
3. Skutečná sandbox transakce
4. Teprve poté `PAYMENTS_LIVE` (s explicitním souhlasem)

Detail plateb: `docs/FOODGO_BUSINESS_AND_PAYMENTS.md`
