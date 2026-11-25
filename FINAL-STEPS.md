# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
**Vývojová fáze je ukončená.** Zbývá provozní konfigurace (doména, Comgate, právní) a schválení vydání.

Tajné hodnoty sem nepatří.

---

## Stav Preview (2026-11-25)

| Kontrola | Výsledek |
| --- | --- |
| Větev / alias | `foodgo-launch-preview` → `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app` |
| Supabase Preview | `jnyxjyyvzxriuyvyiuxe` (foodgo-preview) |
| Runtime session | `supabaseHost=jnyxjyyvzxriuyvyiuxe.supabase.co` |
| Schema bootstrap | **Hotovo** — katalog API, overrides, poptávky RPC |
| `PUBLIC_SITE_URL` | Preview OK → `publicSiteUrl: true` |
| Resend (FoodGo transakční) | Preview `RESEND_API_KEY` + `EMAIL_FROM` + `INQUIRY_TO_EMAIL` → `emailConfigured: true` |
| Auth SMTP (Resend) | **Nastaveno ručně** v foodgo-preview (custom SMTP) |
| Ostré platby | Vypnuté (`paymentsLive: false`, `gateway-not-connected`) |
| Protection bypass | `protectionBypassConfigured: true` |
| Produkční DB | Nedotčená |
| `main` | Nemergováno |

### Ověřeno agentem (API / CLI)

- Health, session host Preview, published-places, sponsorships
- Admin bez session → `auth-required` / `admin: false`
- Guest place-stats → Forbidden; place-reports bez platného místa odmítnuté
- **Žádosti podniků** → `ok: true`, `status: pending` (oprava: UUID + `return=minimal`, anon bez SELECT)
- Poptávky → `stored: true`, `paid: false`, status `inquiry` (e-mail trial → `emailed: false`)
- Registrace na `foodgocz@gmail.com`: Auth vrací `email-delivery-failed` (Resend trial — doručení mimo účet Resend)
- Offline/online `launch:check`: PASS + WARNING (lokální `.env` → produkční Supabase) + BLOCKED `legal-approval`

### SQL grants (doporučeno spustit i když API už funguje)

Hardened skript je ve Windows schránce / v gitu:

`supabase/preview-fix-business-grants.sql` (jen foodgo-preview)

- `anon`: jen INSERT (bez SELECT/UPDATE/DELETE)
- SELECT/UPDATE žádostí jen přes RLS `is_cheapeats_admin()`
- INSERT `WITH CHECK` = pending/start/not_sent + prázdná admin pole
- Očekávané: `anon_can_insert=true`, `anon_can_select/update/delete=false`

### Resend trial — důležité

S `EMAIL_FROM=FoodGo <onboarding@resend.dev>` Resend doručí spolehlivě jen na **e-mail přihlášený v Resend účtu**.  
Pro Auth i poptávky používej při testu tuto schránku, nebo ověř vlastní doménu v Resend.

---

## HOTOVO

- Preview DB oddělená, bootstrap SQL, env Preview (Supabase + Resend + PUBLIC_SITE_URL)
- Auth SMTP Resend v foodgo-preview (ručně)
- Anti-enumerace recovery + jasnější chyby signup při SMTP fail
- Žádosti podniků na Preview funkční + hardened grants SQL
- Skripty: `npm run resend:key`, `preview:email-stack`, `preview:auth-smtp`, `preview:email-wait`
- Comgate kód připravený, LIVE vypnuté

---

## Ty osobně (ke kompletnímu Auth E2E)

1. (Volitelně) Spusť SQL ze schránky v foodgo-preview — potvrzení grantů/RLS.
2. Registrace na Preview s **přesně e-mailem Resend účtu**.
3. Potvrď odkaz z e-mailu → přihlášení → Zapomenuté heslo.
4. V SQL **jen** foodgo-preview:  
   `update public.profiles set is_admin = true where email = '<tvůj test>';`
5. UI: `/admin`, `/pro-podniky` (žádost + poptávka).

---

## Zbývá k veřejnému vydání

### Musí provozovatel (nelze dokončit bez tebe)

1. **Právní texty** — schválit Obchodní podmínky / GDPR / kontakt (`legal-approval` BLOCKED).
2. **Provozovatel v kódu** — doplnit `src/constants/operator.js` (IČO, adresa, e-mail).
3. **Vlastní doména** — Vercel Domains + DNS + Production `PUBLIC_SITE_URL`.
4. **Resend doména** — ověřit DNS → `EMAIL_FROM=FoodGo <noreply@tvoje-domena.cz>` (+ Auth SMTP produkce).
5. **Comgate** — KYC, Merchant ID/Secret, sandbox E2E, teprve potom `PAYMENTS_LIVE` (výslovně).
6. **Produkční Supabase** — Auth redirects na produkční origin; migrace SQL jen po záloze a schválení.
7. **Merge** `foodgo-launch-preview` → `main` jen na výslovný pokyn.

### Volitelné / až po doméně

- Auth redirects produkce + Preview v allow listu
- Resend Production env
- `npm run launch:check` + ruční smoke Production
- SEO index až na ostré doméně

---

## Návrat

**Web:** Vercel → předchozí deployment → Promote.  
**SQL preview:** foodgo-preview lze smazat/znovu vytvořit — produkce zůstane.
