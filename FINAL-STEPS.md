# FOODGO 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
**Vývojová fáze je ukončená.** Zbývá provozní konfigurace (doména, Comgate, právní) a schválení vydání.

Tajné hodnoty sem nepatří.

---

## Stav Preview (2026-11-25)

| Kontrola | Výsledek |
| --- | --- |
| Větev / alias | `foodgo-launch-preview` → `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app` |
| Značka | FOODGO (logo SVG, favicon, PWA, e-mailové šablony) |
| Supabase Preview | `jnyxjyyvzxriuyvyiuxe` (foodgo-preview) |
| Kontakt | `foodgocz@gmail.com` (mailto + Reply-To; ne odesílací doména) |
| Resend | Preview `RESEND_API_KEY` + `EMAIL_FROM` + `INQUIRY_TO_EMAIL` → `emailConfigured` vyžaduje všechny tři |
| Auth SMTP (Resend) | Nastaveno ručně v foodgo-preview |
| Ostré platby | Vypnuté (`paymentsLive: false`) |
| Produkční DB | Nedotčená |
| `main` | Nemergováno |

### Resend trial

S `EMAIL_FROM=FoodGo <onboarding@resend.dev>` Resend doručí spolehlivě jen na **e-mail přihlášený v Resend účtu**.  
Pro Auth i poptávky používej při testu tuto schránku, nebo ověř vlastní doménu v Resend. Gmail (`foodgocz@gmail.com`) je kontakt / Reply-To, ne neověřený From.

---

## HOTOVO (kód / Preview)

- Oddělená Preview DB, bootstrap, env Preview
- Auth SMTP Resend (ručně)
- Žádosti podniků + hardened grants SQL + admin resend e-mailu (`email_status`)
- Poptávky propagace (HTML šablony) — uložení v DB i když e-mail selže
- Hlášení údajů — best-effort upozornění provozovateli bez PII
- Anti-enumerace recovery, rate limity formulářů (+ quote-promotion)
- Bezpečnostní hlavičky (XFO, nosniff, Referrer-Policy, Permissions-Policy, COOP)
- Admin přes `profiles.is_admin` / `is_cheapeats_admin()` — **ne** přes znalost kontaktního e-mailu
- Comgate kód připravený, LIVE vypnuté
- Úvod: hledání → kategorie → Prozkoumat nabídku → Nejbližší / Objev podniky; nativní GPS

---

## Ty osobně (ke kompletnímu Auth E2E na Preview)

1. (Volitelně) SQL `supabase/preview-fix-business-grants.sql` v foodgo-preview.
2. Registrace s **přesně e-mailem Resend účtu**.
3. Potvrď odkaz → přihlášení → Zapomenuté heslo.
4. V SQL **jen** foodgo-preview:  
   `update public.profiles set is_admin = true where email = '<tvůj test>';`
5. UI: `/admin`, `/pro-podniky` (žádost + poptávka).

---

## Zbývá k veřejnému vydání

### Musí provozovatel

1. **Právní texty** — schválit OP / GDPR / kontakt (`legal-approval`).
2. **Provozovatel** — doplnit `src/constants/operator.js` (IČO, adresa).
3. **Vlastní doména** — Vercel Domains + DNS + Production `PUBLIC_SITE_URL` (nahradí `cheat-eaps.vercel.app` v meta).
4. **Resend doména** — ověřit DNS → `EMAIL_FROM=FOODGO <noreply@tvoje-domena.cz>` (+ Auth SMTP produkce). `INQUIRY_TO_EMAIL` / Reply-To = `foodgocz@gmail.com`.
5. **Comgate** — KYC, sandbox E2E, teprve potom výslovně `PAYMENTS_LIVE`.
6. **Produkční Supabase** — Auth redirects; migrace SQL jen po záloze a schválení.
7. **Merge** `foodgo-launch-preview` → `main` jen na výslovný pokyn.

### Volitelné po doméně

- Auth redirects produkce + Preview v allow listu
- Resend Production env
- `npm run launch:check` + ruční smoke Production
- SEO index až na ostré doméně (Preview zůstává noindex)

### Známé mezery (neblokují Preview smoke)

- Persistovaný stav e-mailu u poptávek propagace (admin resend) — zatím HTTP/`admin_note`, ne sloupec jako u žádostí
- Veřejné UI claim ownership + transakční maily po ověřené platbě (LIVE vypnuté)
- Auto-retry e-mailů — ruční resend u žádostí; poptávky bez admin resend UI

---

## Záloha a návrat

**Web:** Vercel → předchozí Ready deployment → Promote / Assign alias.  
**DB Preview:** foodgo-preview lze znovu bootstrapovat — produkční DB neměnit.  
**DB Production (až bude):** snapshot před migrací; rollback = restore snapshot + Promote předchozího deploymentu.
