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

## Co chybí pro skutečné odesílání

1. Uložený `RESEND_API_KEY` v lokálním `.env` (dialog výše).
2. Stejné proměnné ve **Vercel Environment Variables** (Production + Preview) — bez `VITE_*`.
3. Ověřená odesílací doména v Resend (DNS).
4. `EMAIL_FROM` změněný z `onboarding@resend.dev` na adresu na ověřené doméně.
5. Výslovný souhlas k zkušebnímu odeslání (aplikace sama ostré testy neposílá).

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
