# FoodGo — nastavení Resendu

Datum: 2026-11-11

## Proč původní zadávání klíče nefungovalo

Skript `scripts/write-resend-env.ps1` dřív používal jen `Read-Host -AsSecureString`.

Terminál Cursor Agenta **nedokáže spolehlivě předat interaktivní skrytý vstup** do běžícího procesu. Skript proto zůstal viset na výzvě, nic nevypisoval a `RESEND_API_KEY` do `.env` nezapsal. Stejný problém se projevil i při pokusu v jiném Agent terminálu.

To není chyba Resend API klíče — klíč se prostě nikdy nedostal do procesu.

## Co je teď implementované

1. **Lokální Windows dialog** (WinForms) s maskovaným polem.
2. Klíč se neposílá do AI chatu, neběží jako argument CLI, nejde do temp souboru ani do clipboardu vlastním kódem.
3. Klíč se zapíše jen do lokálního `.env` (soubor je v `.gitignore`).
4. E-maily se nastaví na:
   - `INQUIRY_TO_EMAIL=foodgocz@gmail.com`
   - `EMAIL_FROM=FoodGo <onboarding@resend.dev>`
5. Kontrola bez výpisu tajemství: `npm run check:resend`
6. Hlavní kontrola projektu: `npm run check:ready`

Záloha pro klasický terminál mimo Agent:  
`powershell -STA -ExecutionPolicy Bypass -File scripts\write-resend-env.ps1 -Console`

## Jak bezpečně zadat klíč

Jednoduchý příkaz:

```powershell
npm run resend:key
```

Otevře se okno **FoodGo – Resend API klic**.

1. Vlož klíč začínající `re_`.
2. Klikni **Ulozit do .env**.
3. V PowerShellu se objeví `Hotovo` (bez hodnoty klíče).

## Jak ověřit konfiguraci

```powershell
npm run check:resend
```

Úspěch = exit code `0` a `readyForTrialSend: true`.  
Skript hlásí jen přítomnost, délku a základní formát — **nikdy hodnotu klíče**.

Kompletní lokální připravenost (testy + lint + build + katalog + Resend):

```powershell
npm run check:ready
```

## Čtyři různé stavy (nejsou totéž)

| Stav | Význam |
| --- | --- |
| 1. Klíč v `.env` | Lokálně uložený a načitatelný |
| 2. Přístup k Resend API | Klíč funguje vůči `api.resend.com` |
| 3. Skutečné doručení | Zpráva dorazí do schránky |
| 4. Ostré odesílání zákazníkům | Ověřená vlastní doména + správný FROM |

Stav 1 ověř: `npm run check:resend`  
Stav 2 ověř bez odeslání e-mailu: `npm run check:resend-api`

**2026-11-11 (oprava):** Oficiální Resend klíč má **přesně 36 znaků** (`re_` + 8 + `_` + 24). Dřívější kontrola „≥ 40 znaků“ byla chybná.  
HTTP 401 na `GET /domains` u sending-only klíče znamená `restricted_api_key` — klíč **je platný pro odesílání**, jen nesmí spravovat domény. `check:resend-api` to teď rozlišuje a posílá jen prázdný POST probe bez doručení mailu.

Bez ověřené domény Resend obvykle dovolí trial odesílání jen na e-mail přihlášený v Resend účtu. Účet je registrovaný na **jinou** adresu než `foodgocz@gmail.com`, proto doručení na `foodgocz@gmail.com` nebo na zákazníky může selhat i s platným klíčem.

## Dvě oddělené e-mailové cesty

| Cesta | Kdo posílá | Co | Kde se nastaví |
| --- | --- | --- | --- |
| **Supabase Auth** | SMTP v projektu Auth | registrace / potvrzení / zapomenuté heslo | Supabase → Authentication → Emails → SMTP |
| **FoodGo transakční** | Resend HTTP API | poptávky, schválení podniku | Vercel `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_TO_EMAIL` |

`emailConfigured` v `/api/health` sleduje **jen** FoodGo/Resend. Obnova hesla **nejde** přes Resend API aplikace — jde přes Auth SMTP.

### Výchozí SMTP Supabase (bez custom SMTP)

- Doručuje **jen** na e-maily členů organizace (Team).
- Limit **2 e-maily / hodinu** na projekt.
- Jiná adresa → `email_address_not_authorized` (e-mail nedorazí).
- Neexistující účet → Auth vrátí úspěch **bez** odeslání (anti-enumerace).

Proto na `foodgo-preview` (`jnyxjyyvzxriuyvyiuxe`) bez Resend SMTP „Zapomenuté heslo“ na běžný e-mail nedorazí.

### Auth SMTP přes Resend (Preview i později Production)

1. V Resend měj API klíč `re_…` (nic nekupuj navíc, pokud už účet máš).
2. Pro ostré doručení ověř vlastní doménu (DNS). Trial: `onboarding@resend.dev` doručí typicky jen na e-mail Resend účtu.
3. Jen v projektu **foodgo-preview**: [Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/auth/smtp)
   - Enable Custom SMTP: **on**
   - Sender email: např. `FoodGo <onboarding@resend.dev>` (trial) nebo `FoodGo <noreply@tvoje-domena.cz>`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: stejný Resend API klíč (do chatu/gitu nepatří)
4. Redirect URLs (stejný projekt): [URL Configuration](https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/auth/url-configuration)
   - Site URL: `https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app`
   - Redirect URLs: `…/nove-heslo` (+ lokální `127.0.0.1` / `localhost` pokud testuješ lokálně)
5. Auth logy: [Logs → Auth](https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/logs/auth-logs) — hledej `recover`, `email_address_not_authorized`, `over_email_send_rate_limit`.

Produkční projekt `pcptzyfoojmnspumcmsi` v tomto kroku **neměň**.

### FoodGo transakční e-maily (Vercel Preview)

Stejný Resend klíč (nebo oddělený sending key), **bez** `VITE_*`:

| Proměnná | Preview hodnota (příklad) |
| --- | --- |
| `RESEND_API_KEY` | `re_…` (Secret) |
| `EMAIL_FROM` | `FoodGo <onboarding@resend.dev>` nebo ověřená doména |
| `INQUIRY_TO_EMAIL` | schránka provozovatele (u trial musí sedět s Resend účtem) |

Po nastavení: redeploy **jen** větve `foodgo-launch-preview`. `/api/health` → `emailConfigured: true`.

## Co chybí pro skutečné odesílání

1. Uložený `RESEND_API_KEY` v lokálním `.env` (dialog výše).
2. Stejné proměnné ve **Vercel Environment Variables** (Production + Preview) — bez `VITE_*`.
3. **Custom SMTP Resend v Supabase Auth** (viz výše) — bez něj Auth e-maily na Preview nechodí.
4. Ověřená odesílací doména v Resend (DNS).
5. `EMAIL_FROM` změněný z `onboarding@resend.dev` na adresu na ověřené doméně.
6. Výslovný souhlas k zkušebnímu odeslání (aplikace sama ostré testy neposílá).

Poptávka propagace se i bez e-mailu **uloží** do evidence; e-mail je doplňkové upozornění.

## Jak připravit vlastní doménu

1. V Resend → Domains přidej doménu (např. `tvuj-domena.cz`).
2. Do DNS u registrátora vlož záznamy, které Resend ukáže (typicky SPF/DKIM; přesné hodnoty ber jen z Resend dashboardu — tady se nevymýšlejí).
3. Po ověření nastav např. `EMAIL_FROM=FoodGo <noreply@tvuj-domena.cz>`.
4. Stejné hodnoty dej do Vercel env a nasaď novou verzi.
5. Teprve potom vyzkoušej odeslání na vlastní schránku.

## Související příkazy

| Příkaz | Účel |
| --- | --- |
| `npm run resend:key` | GUI uložení API klíče |
| `npm run resend:emails` | Nastaví jen TO/FROM (bez klíče) |
| `npm run check:resend` | Kontrola env bez tajemství |
| `npm run check:ready` | Unit + lint + build + katalog + Resend |
