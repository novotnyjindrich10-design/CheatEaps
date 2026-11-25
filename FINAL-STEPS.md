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

- Health, session host, place-overrides, published-places, sponsorships
- Admin bez session → `auth-required` / `admin: false`
- Guest place-reports / place-stats → Forbidden
- Poptávky se **ukládají** (`stored: true`, status `inquiry`, nezaplaceno)
- Transakční e-mail na trial `onboarding@resend.dev` → `foodgocz@gmail.com` často **nedoručí** (Resend trial: typicky jen e-mail Resend účtu) → `emailed: false` očekávatelné
- Registrace přes API: při chybě doručení potvrzovacího mailu teď vrací `email-delivery-failed` (ne „špatné heslo“)
- Offline `launch:check`: PASS s WARNING (lokální `.env` ještě míří na produkční Supabase URL) + BLOCKED `legal-approval`

### Resend trial — důležité

S `EMAIL_FROM=FoodGo <onboarding@resend.dev>` Resend doručí spolehlivě jen na **e-mail přihlášený v Resend účtu**.  
Pro Auth i poptávky používej při testu tuto schránku, nebo ověř vlastní doménu v Resend.

---

## HOTOVO

- Preview DB oddělená, bootstrap SQL, env Preview (Supabase + Resend + PUBLIC_SITE_URL)
- Auth SMTP Resend v foodgo-preview (ručně)
- Anti-enumerace recovery + jasnější chyby signup při SMTP fail
- Skripty: `npm run resend:key`, `preview:email-stack`, `preview:auth-smtp`, `preview:email-wait`
- Comgate kód připravený, LIVE vypnuté

---

## Ty osobně (ke kompletnímu Auth E2E)

1. Registrace na Preview s **e-mailem Resend účtu** (ne libovolný Gmail při trial FROM).
2. Potvrď odkaz z e-mailu → přihlášení.
3. V SQL **jen** foodgo-preview:  
   `update public.profiles set is_admin = true where email = '<tvůj test>';`
4. UI: `/admin`, Zapomenuté heslo, `/pro-podniky`.

---

## Zbývá k veřejnému vydání

### Musí provozovatel

1. **Právní texty** — schválit Obchodní podmínky / GDPR / kontakt provozovatele (`legal-approval` BLOCKED).
2. **Provozovatel v kódu** — doplnit `src/constants/operator.js` (IČO, adresa, e-mail), pokud ještě prázdné.
3. **Vlastní doména** — Vercel Domains + DNS + Production `PUBLIC_SITE_URL`.
4. **Resend doména** — ověřit DNS → `EMAIL_FROM=FoodGo <noreply@tvoje-domena.cz>` (Production + Auth SMTP produkce).
5. **Comgate** — KYC, Merchant ID/Secret, sandbox E2E, teprve potom `PAYMENTS_LIVE` (výslovně).
6. **Produkční Supabase** — Auth redirects na produkční origin; migrace SQL jen po záloze a schválení.
7. **Merge** `foodgo-launch-preview` → `main` jen na výslovný pokyn.

### Volitelné / až po doméně

- Auth redirects produkce + Preview v allow listu
- Resend Production env
- `npm run launch:check` (online) + ruční smoke Production
- SEO index až na ostré doméně

---

## Návrat

**Web:** Vercel → předchozí deployment → Promote.  
**SQL preview:** foodgo-preview lze smazat/znovu vytvořit — produkce zůstane.
