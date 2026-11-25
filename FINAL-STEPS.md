# FoodGo 1.0 — postup vydání

Jediný hlavní návod. Větev: `foodgo-launch-preview`.  
**Vývojová fáze je ukončená.** Zbývá provozní konfigurace (e-mail, platby, doména) a schválení vydání.

Tajné hodnoty sem nepatří.

---

## Stav Preview (2026-11-25)

| Kontrola | Výsledek |
| --- | --- |
| Větev / alias | `foodgo-launch-preview` → `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app` |
| Supabase Preview | `jnyxjyyvzxriuyvyiuxe` (foodgo-preview) |
| Runtime session | `supabaseHost=jnyxjyyvzxriuyvyiuxe.supabase.co` |
| Schema bootstrap | **Hotovo** — `published_places`, `place_overrides` (`configured: true`), poptávky RPC OK |
| `PUBLIC_SITE_URL` | Preview větev nastavená → runtime `publicSiteUrl: true` |
| `EMAIL_FROM` / `INQUIRY_TO_EMAIL` | Preview větev nastavené (`FoodGo <onboarding@resend.dev>`, `foodgocz@gmail.com`) |
| `RESEND_API_KEY` | **Chybí** na Preview → `emailConfigured: false` |
| Auth SMTP (Resend) | **Nenastaveno** — výchozí Supabase SMTP (jen team + 2/h) |
| Ostré platby | Vypnuté (`paymentsLive: false`, `gateway-not-connected`) |
| Protection bypass | `protectionBypassConfigured: true` (Comgate push připravený až budou credentials) |
| Produkční DB `pcptzyfoojmnspumcmsi` | Nedotčená |
| `main` | Nemergováno |

Kód recovery: `email_address_not_authorized` se tváří jako úspěch (bez enumerace účtů). Dokumentace: `docs/FOODGO_RESEND_SETUP.md`.

---

## HOTOVO (automaticky / agent)

- Preview DB bootstrap SQL spuštěný uživatelem, ověřený přes API.
- `PUBLIC_SITE_URL` jen Preview / `foodgo-launch-preview`.
- `EMAIL_FROM` + `INQUIRY_TO_EMAIL` jen Preview / `foodgo-launch-preview`.
- Redeploy Preview s opravou recovery anti-enumerace.
- Skript: `npm run preview:auth-smtp` (= `scripts/configure-preview-auth-smtp.mjs`) nastaví Auth SMTP + Site/Redirect URL **jen** na `jnyxjyyvzxriuyvyiuxe`.
- Ověřeno bez tajemství: health, session host, place-overrides, published-places, payments status (inquiry), admin vyžaduje login, uložení testovací poptávky.

---

## Ty osobně (minimum)

### 1) Resend API klíč (blokuje Auth i transakční maily)

1. Přihlas se na [resend.com/api-keys](https://resend.com/api-keys) (nebo založ účet — agent nemůže dokončit login).
2. Vytvoř Sending API key.
3. Lokálně: `npm run resend:key` (uloží do `.env`, hodnota se nevypisuje).
4. Na Vercel Preview (větev `foodgo-launch-preview`):

```text
npx vercel env add RESEND_API_KEY --environment preview --git-branch foodgo-launch-preview --type secret --scope jindrichcompany
```

(vlož klíč na výzvu; necommitovat)

### 2) Auth SMTP + redirects na foodgo-preview (jeden příkaz)

1. [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens) → vytvoř token → do `.env` jako `SUPABASE_ACCESS_TOKEN=…`
2. Ověř, že `.env` má `RESEND_API_KEY` (krok 1).
3. Spusť:

```text
npm run preview:auth-smtp
```

Skript nastaví jen `jnyxjyyvzxriuyvyiuxe`: custom SMTP Resend + Site URL Preview + Redirect `/nove-heslo` (+ localhost). Produkci odmítne.

### 3) Redeploy Preview po `RESEND_API_KEY`

```text
npx vercel redeploy https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app --scope jindrichcompany --environment preview
```

Očekávané: `/api/health` → `emailConfigured: true`.

### 4) Ruční smoke Auth + admin (5 min)

1. Registrace na Preview s **e-mailem Resend účtu** (trial `onboarding@resend.dev` doručí typicky jen sem).
2. Potvrď e-mail → přihlas se.
3. V SQL Editoru **jen** foodgo-preview:

```sql
update public.profiles set is_admin = true where email = '<tvůj test>';
```

4. `/admin` — žádosti / poptávky / reporty.
5. Zapomenuté heslo → odkaz v mailu → `/nove-heslo`.
6. `/pro-podniky` — podnikatelský účet / poptávka (už ověřeno API; UI smoke stačí jednou).

---

## Připraveno na později (zatím nespouštěj)

### Comgate (sandbox, ne LIVE)

| Proměnná | Poznámka |
| --- | --- |
| `PAYMENT_PROVIDER=comgate` | Preview |
| `PAYMENT_MERCHANT_ID` / `PAYMENT_SECRET` | z [portal.comgate.cz](https://portal.comgate.cz) po KYC |
| `PAYMENTS_SANDBOX_OUTBOUND=true` | Preview |
| `PAYMENTS_LIVE=false` | **nechat** |
| Result URL | `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app/api/payments/webhook?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>` |

Detail: `FOODGO-LAUNCH.md` sekce D. Bypass secret už runtime hlásí jako nakonfigurovaný.

### Vlastní doména

1. Vercel → Domains → Add → DNS dle Vercelu.  
2. Production `PUBLIC_SITE_URL=https://tvoje-domena.cz`.  
3. Supabase **produkční** Auth redirects na stejný origin + `/nove-heslo`.  
4. Resend: ověř doménu → `EMAIL_FROM=FoodGo <noreply@tvoje-domena.cz>`.

### Produkční vydání (až po schválení)

1. Záloha produkční DB → migrace jen se souhlasem.  
2. Production env (Supabase prod, Resend, Comgate).  
3. `npm run launch:check -- --offline`.  
4. Merge `foodgo-launch-preview` → `main` **jen na výslovný pokyn**.  
5. `PAYMENTS_LIVE=true` až po sandbox E2E.

---

## Návrat

**Web:** Vercel → předchozí deployment → Promote.  
**SQL preview:** foodgo-preview lze smazat/znovu vytvořit — produkce zůstane.
