# FoodGo 1.0 — Release Checklist

Pouze po splnění všech **POVINNÝCH** kroků smí dojít k merge do `main` a produkčnímu deployi.  
Tento dokument **nespouští** deploy — je to ruční checklist pro provozovatele.

## A. Právní a provozovatel (POVINNÉ)

- [ ] Doplnit `src/constants/operator.js`: `legalName`, `ico`, `street`, `city`, `postalCode`, `email`
- [ ] Nastavit `vatStatus` (`non-payer` / `payer`) a související DPH pole
- [ ] Právník / dospělá oprávněná osoba zkontroluje Privacy + Terms
- [ ] Kontaktní e-mail v `constants/brand.js` odpovídá skutečnému příjmu
- [ ] `npm run launch:check -- --offline` → overall **není** BLOCKED na `operator-identity`

## B. Produkční prostředí Vercel (POVINNÉ)

- [ ] `PUBLIC_SITE_URL` = finální https origin (ne preview)
- [ ] Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ service role jen server-side, nikdy do VITE_)
- [ ] Auth redirect URL v Supabase: produkční + případně preview
- [ ] Ověřit, že `.env` / secrets nejsou v gitu
- [ ] Volitelně Resend: `RESEND_API_KEY`, `EMAIL_FROM` (ověřená doména), `INQUIRY_TO_EMAIL`

## C. Supabase / data (PODLE POTŘEBY)

- [ ] Schéma dle `npm run check:supabase`
- [ ] Migrace place-reports / place-stats jen se souhlasem (ne automaticky z agenta)
- [ ] RLS: anonym nesmí spravovat cizí podniky / admin

## D. Katalog (DOPORUČENÉ před větším marketingem)

- [ ] Ruční kontrola 7 podezřelých kategorií z `reports/catalog-audit.md`
- [ ] Doplnit souřadnice u 4 míst bez coords
- [ ] Rozšířit ověřené ceny (cíl: aspoň ~150–200 menu položek)
- [ ] `npm run audit:catalog` = 0 confirmed errors

## E. Finální test před deployem

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build` (včetně prerender 775 HTML)
- [ ] `npm run test:e2e`
- [ ] `npm run launch:check` (bez `--offline`, pokud máš síť a Resend)
- [ ] Ruční smoke na Preview: úvod → hledání → filtr → mapa → detail → oblíbené → GPS

## F. Deploy (JEN PO SCHVÁLENÍ)

- [ ] Merge `foodgo-launch-preview` → `main` (ne force-push)
- [ ] Vercel Production deploy
- [ ] Ověřit commit SHA na produkci
- [ ] Ověřit `robots.txt` + `sitemap.xml` na produkčním originu
- [ ] Ověřit, že Preview URL má `noindex` (runtime) a není kanonická

## G. Rollback

1. Vercel → Previous Production Deployment → Promote
2. Případně revert merge commitu na `main`
3. **Nespouštět** destruktivní SQL rollback bez zálohy

## H. Co NEDĚLAT při free vydání

- Neaktivovat `PAYMENTS_LIVE=true`
- Nezapínat `PUBLIC_V1.paidPromotionUi` bez OPERATOR + fakturace + Resend
- Nemergovat s tajnými klíči v repu
- Nespouštět placené Google Places sync bez `--confirm-paid`
