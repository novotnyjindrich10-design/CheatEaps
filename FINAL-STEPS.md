# FOODGO 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
**Kód Preview je připravený k ručnímu vydání.** Tahle větev se nemerguje do `main`, ostré platby zůstávají vypnuté a produkční databáze se z tohohle kroku nemění.

Tajné hodnoty sem nepatří.

---

## Stav po vizuálním a provozním doladění (2026-11-28)

| Oblast | Stav |
| --- | --- |
| Kategorie na úvodu | Nadpis „Na co máš chuť?“, fotka přes celou kartu, bez rámečku kolem názvu. Mobil: nízký vodorovný pás. Desktop od 960 px: mřížka na šířku stránky. |
| Hledání | Bez diakritiky, jeden překlep, jednotné/množné u synonym, česko-anglická synonyma kategorií, našeptávání podniků, kategorií a ověřených jídel, nedávná hledání, tlačítko pro smazání textu, návrhy kategorií při nule výsledků. |
| Oficiální fotky | 93 hotlinků z webů podniků **nemá doloženou komerční licenci**. Veřejné UI je neukazuje. Nahrazuje je už přiřazená ilustrace Pixabay/Pexels/Unsplash. Evidence: `reports/official-photo-rights.md`. |
| Statistiky majitele | Otevření detailu, navigace, web a telefon se zapisují jako denní součty. Přehled 7 a 30 dní a období propagace jen z naměřených řádků, jen u ověřeného podniku. Zobrazení v seznamu se neměří a neukazuje se jako nula. |
| E-mail | `sent` znamená, že Resend požadavek přijal. Doručení do schránky se nepotvrzuje. Schválený e-mail se znovu neposílá. Neúspěšný lze zopakovat. Poptávka propagace má idempotency key podle čísla evidence. |
| Účet | Přihlášený uživatel může účet smazat na Oblíbených po napsání `SMAZAT`. |
| SEO | Preview zůstává `noindex` a `Disallow: /`. Produkční indexace je v kódu připravená a **není zapnutá**. |
| Platby | `paymentsLive` zůstává vypnuté. |

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

### Resend trial a vlastní doména

S `EMAIL_FROM=FoodGo <onboarding@resend.dev>` Resend doručí spolehlivě jen na **e-mail přihlášený v Resend účtu**. Trial se neobchází.

Až budeš mít doménu, v Resend postupuj přesně takto:

1. Resend → Domains → Add domain → zadej odesílací doménu (například `foodgo.cz`).
2. U záznamů, které Resend vypíše (SPF, DKIM a případně return-path), je přidej u registrátora DNS. Na hodnoty nesahej.
3. V Resend počkej na stav Verified. Dokud verified není, `EMAIL_FROM` neměň.
4. Teprve potom nastav Preview i Production env: `EMAIL_FROM=FOODGO <noreply@tvoje-domena>`.
5. `INQUIRY_TO_EMAIL` a Reply-To nech `foodgocz@gmail.com`.
6. V Supabase Auth (Preview i později Production) nastav SMTP na Resend a stejný From. Redirect URL doplň až pro konkrétní doménu.
7. Pošli zkušební registraci, obnovu hesla a poptávku na schránku, která není jen trial inbox, a ověř, že zpráva opravdu dorazila. Přijetí API není doručení.

Gmail (`foodgocz@gmail.com`) je kontakt / Reply-To, ne neověřený From.

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
- Zobrazení karty v seznamu se neměří. Statistiky majitele ukazují jen zapsané události (detail, navigace, web, telefon).
- Rate limit formulářů je v paměti jedné serverless instance. Sdílený limit by potřeboval novou tabulku; na produkční databázi se nepřidával.
- `sent` u e-mailu znamená přijetí Resendem, ne doručení do schránky.

### Ověření v prohlížeči (emulace, ne fyzický telefon)

- Šířky 320, 375, 390 a 430 px: kategorie jedou vodorovně, karty drží poměr 4:3, sekce zůstává nízká.
- Desktop: od 960 px mřížka na šířku stránky, 12 karet, nadpis „Na co máš chuť?“.
- Pizza na úvodu otevře `/results?type=pizza` s titulkem „Pizza v Brně | FoodGo Brno“.
- Mapa je `/results?view=map` a v emulaci 320 px vykreslí canvas. Adresa `/map` správně padá na 404.
- CSP na lokálním Vite neběží. Styl OpenFreeMap Positron bere glyfy, sprite i dlaždice z `tiles.openfreemap.org`, které CSP v `vercel.json` povoluje. Po nasazení Preview je potřeba mapu ještě jednou otevřít.
- Testy: `npm test` 423/423, `oxlint` bez nových chyb, `npm run build` prošel, Playwright 39/39. Vstupní JS po buildu: 362 kB, gzip 115 kB (dřívější zápis ~111 kB gzip). Lighthouse v tomhle kole nebyl spuštěn.

---

## Záloha a návrat

**Web:** Vercel → předchozí Ready deployment → Promote / Assign alias.  
**DB Preview:** foodgo-preview lze znovu bootstrapovat — produkční DB neměnit.  
**DB Production (až bude):** snapshot před migrací; rollback = restore snapshot + Promote předchozího deploymentu.
