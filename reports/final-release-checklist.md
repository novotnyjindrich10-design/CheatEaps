# CheapEats Brno — finální checklist před vydáním

Datum: 2026-11-05. Kontrola běžela v `C:\Users\novot\Desktop\cheapeats`. Commit, push, deploy ani produkční SQL se nespouštěly. `supabase/loyalty.sql` se nespouštěl. Žádný produkční účet se nezakládal a žádný produkční e-mail se neposílal.

Verdikt: **NOT READY TO LAUNCH**

Katalog, hledání, filtry a statické HTML v novém buildu fungují. Veřejné vydání pořád brzdí tři věci: na živé adrese je starý build, právní stránky nemají údaje provozovatele a přihlášení nebylo projeté reálným účtem. Mockované testy to nenahrazují.

---

## Stav

| Oblast | Stav | Důvod |
| --- | --- | --- |
| Unit testy | PASS | 282/282, 0 selhání |
| Lint | PASS | `oxlint` skončil 0, jen starší varování |
| Build | PASS | `vite build` dokončen |
| E2E, mock | PASS | Playwright 13/13, bez Supabase a bez e-mailu |
| Auth, živý účet | BLOCKER | Reálné přihlášení, odhlášení, obnova hesla a návrat na slevy nejsou ověřené |
| Supabase, kód cookies a redirect | PASS | HttpOnly, SameSite=Lax, Secure jen na HTTPS, cizí Origin u resetu hesla se odmítá |
| Supabase, produkční Auth URL | NOT TESTED | Site URL a Redirect URLs v dashboardu se z tohoto přístupu neověřily |
| RLS v produkční databázi | NOT TESTED | SQL se nespouštělo. Kontraktní testy souborů prošly, nasazení tabulek ne |
| Rate limit | WARNING | Limity jsou v paměti jednoho procesu a mezi instancemi Vercelu se nesdílejí |
| CSRF | WARNING | Samostatný CSRF token není. Změny jdou přes POST a cookie je SameSite=Lax |
| Rewards | WARNING | Stránka má zůstat „Připravujeme“. Živé API to ještě říká starou hláškou s názvem SQL souboru |
| Právní stránky | BLOCKER | Chybí jméno, adresa, IČO, kontaktní e-mail a právní status. Text není platný právní dokument |
| Produkční web | BLOCKER | https://cheat-eaps.vercel.app pořád servíruje starý SPA shell |
| SEO v novém buildu | PASS | Kanonické adresy, sitemap 781 URL, robots, statické HTML |
| SEO na živém webu | BLOCKER | Úvod nemá canonical. Sitemap navíc obsahuje `/odmeny` a `/oblibene` |
| Výkon | WARNING | Bundle je změřený. Lighthouse v prostředí není, skóre se neměřilo |
| `PUBLIC_SITE_URL` na Vercelu | NOT TESTED | K projektu v týmu `jindrichcompany` není z tohoto účtu přístup. Lokální build má záložní kanonickou adresu |

---

## Co bylo opraveno

- Kanonický odkaz, který React vytváří až v prohlížeči, dostane atribut `href`. Dřív se u nového `<link>` zapisoval `content`, takže `href` zůstával prázdný. Už existující odkaz v hotovém HTML se dál aktualizuje.
- Ochrana osobních údajů a obchodní podmínky mají stejný seznam chybějících údajů. Jméno, adresa, IČO, e-mail ani právní status se nedoplňují.
- Playwright je vývojová závislost. `npm run test:e2e` spouští `e2e/`. Testy mockují `/api` a spadnou, když by volaly `supabase.co` nebo `resend.com`.
- Výstupy Playwright jsou v `.gitignore`.

Rewards zůstávají ve stavu „Připravujeme“. `supabase/loyalty.sql` se nespouštěl.

---

## Co bylo testováno

### Unit testy — PASS

`npm test`: 282 testů, 75 sad, 0 selhání, 0 přeskočených. Doba běhu 3,2 s.

### Lint — PASS

`npm run lint` skončil kódem 0. Varování, která už v projektu byla a nesouvisí s tímto kolem: nepoužité symboly ve skriptech ilustrací, fast refresh u contextů a `setState` v efektu na administraci a odměnách.

### Build — PASS

`npm run build` dokončen. Výstup `dist`.

| Soubor | Velikost | gzip |
| --- | --- | --- |
| `index-D50XdcQL.js` | 117,38 kB | 36,57 kB |
| `vendor-CzjRjdel.js` | 259,07 kB | 82,23 kB |
| `catalog-uxH0mx3F.js` | 1 256,07 kB | 206,48 kB |
| `index-CfL5zg7x.css` | 58,73 kB | 12,45 kB |

Vite u katalogu hlásí chunk nad 500 kB. První načtení katalogu pořád stahuje tento soubor.

### E2E — PASS

`npx playwright test`: 13 prošlo, 0 selhalo, 1 worker, asi 1,0 min. Desktop 1280×800, mobilní test 390×844. Žádný test nezaložil účet a žádný nevolal produkční Supabase ani Resend.

Prošlo:

- úvod, hydratace, schování statického bloku, titulek, kanonický odkaz na dev serveru
- hledání „pizza“ bez Gelateria Piazza, s Prova Bistro
- kategorie Pizza a rozpočet `budget=150`
- přímý detail Dhaba Beas Panská a stránka 404
- obrázky na úvodu, které prohlížeč načetl, nejsou rozbité
- slevy bez přihlášení vedou na přihlášení
- odměny při odpovědi 503 `not-ready` ukážou „Připravujeme.“
- výpadek API neshodí úvod; slevy přesměrují na přihlášení s hláškou, že stav účtu nejde ověřit; odměny ukážou chybu načtení
- geolokace s vrácenými souřadnicemi 49.19522, 16.60796
- zamítnutá geolokace ukáže „Přístup k poloze je zakázán“
- mobilní menu a přímý detail

### Auth E2E — PASS jen jako mock, živě NOT TESTED

`e2e/auth.mock.spec.js` proti falešnému API prošel:

- registrace s výzvou k potvrzení e-mailu
- přihlášení a návrat na `/results?deals=1`
- obnova session po obnovení stránky
- oblíbené
- uložení recenze
- odhlášení
- žádost o nové heslo a uložení hesla z falešného odkazu

Samostatný živý integrační test v sadě není. Bez schváleného testovacího účtu se živé E2E nepředstírá.

### Prohlížeč — PASS na novém buildu přes `vite preview`, s omezením

`vite preview` na `http://127.0.0.1:4173` po tomto buildu:

- úvod se vykreslil, titulek sedí, statický blok je `display: none`, kanonický odkaz má `href`, 85 obrázků a 0 rozbitých mezi těmi, které už byly načtené
- `/ochrana-osobnich-udaju` ukáže nadpis, varování, že text není platný, a checklist pěti chybějících údajů
- `/restaurant/dhaba-beas-panska` po hydrataci ukáže Dhaba Beas Panská a adresu Panská 12
- `/odmeny` na preview skončí „Odměny se nepodařilo načíst.“ Preview na `/api/loyalty/rewards` vrací HTML úvodu, ne JSON. To není chování Vercelu

`vite preview` bez lomítka na konci adresy vrací HTML úvodu. Adresa s lomítkem vrací vygenerovanou stránku podniku. Vercel má `cleanUrls: true` a `trailingSlash: false`, takže po nasazení má čistá adresa servírovat soubor ve složce. Tohle na novém buildu na Vercelu ověřené není, protože se nenasazovalo.

### Živý web — BLOCKER

Stažení 2026-11-05, bez přihlášení:

- `https://cheat-eaps.vercel.app/` vrací 200 a 1396 B. Je to starý shell: jen `<div id="root">`, bez kanonického odkazu a bez statického HTML. Skript je `/assets/index-CxrdEX_s.js` (1 588 736 B), ne soubory z dnešního buildu.
- `robots.txt` naživo ještě nezakazuje `/oblibene`, `/odmeny`, `/porovnani` a `/nabidka`. Nový `dist/robots.txt` je zakazuje.
- Živá sitemap má 783 adres. Nový build jich má 781. Navíc jsou naživo jen `https://cheat-eaps.vercel.app/odmeny` a `https://cheat-eaps.vercel.app/oblibene`.
- `GET /api/auth/session` vrací 200, `ok: true`, `configured: true`, `authenticated: false`. E-mail v odpovědi nebyl. Cookie se neukládají a neopisují.
- `GET /api/loyalty/rewards` vrací 503 a `error: "not-ready"`. Text odpovědi pořád říká, ať se v SQL editoru spustí `supabase/loyalty.sql`. Lokální kód už vrací „Věrnostní body teď nejsou zapnuté. Připravujeme je.“ Nasazená funkce je starší.

### Lighthouse — NOT TESTED

Příkaz `lighthouse` v systému není. Žádné skóre se neměřilo a žádné se neodhaduje.

---

## Auth

| Kontrola | Stav |
| --- | --- |
| Mock registrace, přihlášení, odhlášení, obnova session, obnova hesla, návrat na slevy, oblíbené, recenze | PASS |
| Živý účet | BLOCKER / NOT TESTED |
| Produkční session endpoint bez účtu | PASS, server je nakonfigurovaný a hosta nepustí dál |
| HttpOnly, Path=/, SameSite=Lax | PASS v kódu |
| Secure jen když je požadavek HTTPS (`x-forwarded-proto` nebo URL) | PASS v kódu. Na starém nasazení se cookie po přihlášení neměřila |
| Obnova hesla odmítne cizí Origin | PASS v unit testu |
| PKCE `prepare-recovery`, `token_hash` i `code` | PASS v unit testu. E-mailový odkaz je schválně `implicit`, aby šel otevřít v jiném prohlížeči |
| Samostatný CSRF token | WARNING, není. Stav mění POST |

### Ruční postup s reálným účtem

Účet založ sám. Automaticky se nezakládal.

1. Otevři `https://cheat-eaps.vercel.app/registrace` až po nasazení tohoto buildu. Založ účet e-mailem, který smíš použít.
2. Otevři potvrzovací e-mail a dokonči ho. Ověř, že stránka nehlásí úspěch, dokud e-mail nepřijde.
3. Přihlas se na `/prihlaseni?next=%2Fresults%3Fdeals%3D1`. Po úspěchu musíš být na slevách, ne na úvodu.
4. Obnov stránku. Pořád jsi přihlášený a v aplikaci není vidět heslo ani anon klíč.
5. V DevTools zkontroluj cookies `ce_access` a `ce_refresh`: HttpOnly, SameSite=Lax, na https i Secure. Hodnoty nikam nekopíruj.
6. Přidej a odeber jednu oblíbenou restauraci. Po obnovení stránky musí seznam sedět.
7. Ulož jednu recenzi u podniku, který smíš použít. Veřejně se ukáže až po schválení.
8. Odhlas se. Slevy (`/results?deals=1`) tě znovu pošlou na přihlášení.
9. Na „Zapomněl jsem heslo“ pošli odkaz. Otevři ho a nastav nové heslo na `/nove-heslo`. Starým heslem už se přihlásit nesmí jít.
10. Když odkaz skončí na cizí doméně nebo na úvodu bez tokenu, v Supabase doplň Redirect URL níže a test zopakuj. SQL nespouštěj.

---

## Supabase

| Kontrola | Stav |
| --- | --- |
| Session endpoint naživo | PASS, nakonfigurováno, host bez účtu |
| Cookies a bezpečný redirect v kódu | PASS |
| RLS a granty v SQL souborech | PASS jako kontraktní test, ne jako nasazená databáze |
| `loyalty.sql` | BLOCKER nespouštět, dokud odměny nemají být zapnuté. Teď nemají |
| Site URL a Redirect URLs | NOT TESTED |
| Rate limit 8 pokusů o přihlášení a 12 o obnovu hesla za 15 minut | WARNING, platí jen v paměti dané instance |
| `x-forwarded-for` bere první adresu | WARNING, spoléhá na to, že Vercel hlavičku nepřepisuje klientem |

---

## Právní stránky

Stav: **BLOCKER**. Stránky nejsou dokončené.

`/ochrana-osobnich-udaju` a `/obchodni-podminky` říkají, že text není platný. Obě mají checklist „Co v textu ještě chybí“ a sloty „Doplní provozovatel“. Footer na ně odkazuje. V textu není e-mail, IČO ani vymyšlený provozovatel. Unit test to hlídá.

Doplní provozovatel, a pak právní kontrola:

- [ ] Jméno nebo název provozovatele
- [ ] Adresa
- [ ] IČO, pokud ho provozovatel má
- [ ] Kontaktní e-mail
- [ ] Právní status projektu
- [ ] Účel a právní základ zpracování
- [ ] Zpracovatelé a přenos mimo EU
- [ ] Doby uložení
- [ ] Postup pro práva subjektu
- [ ] Formulace k technickým cookies relace

Bez těchto údajů se stránky nesmí označit za hotové.

---

## Produkční konfigurace

`vercel.json` v repozitáři:

- framework `vite`
- build `npm run build`
- output `dist`
- `cleanUrls: true`, `trailingSlash: false`
- `/api/:path*` jde na `/api`
- ostatní cesty na `/index.html`
- ilustrace a `/assets` mají cache na rok

Kanonická adresa v kódu je `https://cheat-eaps.vercel.app`. Build bez `PUBLIC_SITE_URL` tuto adresu použije. Nový `dist` má:

- `sitemap.xml` se 781 URL: úvod, `/results`, `/pro-podniky`, `/podpor-me`, obě právní stránky a 775 detailů
- `robots.txt` se zákazem administrace, API, přihlášení, registrace, nového hesla, oblíbených, odměn, porovnání a nabídky
- `dist/index.html` 3020 B, canonical `https://cheat-eaps.vercel.app/`, statický nadpis „Najdi jídlo v Brně“
- 775 složek `dist/restaurant/<id>/index.html` s vlastním nadpisem a canonical
- přihlášení bez kanonického odkazu a bez katalogu ve statickém HTML

Proměnné na Vercelu a Auth URL v Supabase se nečetly. Dřívější pokus o projekt `cheat-eaps` v týmu `jindrichcompany` skončil 403. Nic se tam neměnilo.

---

## SEO

| Kontrola | Nový build | Živý web |
| --- | --- | --- |
| Statické HTML veřejných stránek | PASS | BLOCKER, starý prázdný shell |
| Titulek a popis | PASS | PASS, titulek na úvodu sedí i ve starém shellu |
| Canonical | PASS | BLOCKER, na úvodu chybí |
| Sitemap | PASS, 781 URL | WARNING, 783 URL včetně odměn a oblíbených |
| Robots | PASS | WARNING, chybí novější zákazy |
| Přímý detail | PASS ve vygenerovaném HTML a po hydrataci | NOT TESTED na novém HTML, živý web ho ještě nemá |
| Hydratace | PASS | NOT TESTED na novém buildu |
| Rozbité obrázky na úvodu | PASS, 0 z 85 načtených | NOT TESTED na novém buildu |
| Mobil 390 px | PASS v Playwright | NOT TESTED na živém novém buildu |

---

## Výkon

Změřený výstup buildu je v tabulce výše. Lighthouse se nespouštěl.

Katalog 1 256 kB (gzip 206 kB) je pořád velký pro první načtení. Není to pád funkce. Je to WARNING, ne důvod mazat katalog.

---

## Zbývající blockery

1. Nasadit tento build. Živý web je starý shell a staré API odměn pořád radí spustit SQL.
2. Doplnit údaje provozovatele a nechat právní text zkontrolovat.
3. Ručně projet přihlášení, session, odhlášení, oblíbené, recenzi a obnovu hesla na nasazeném webu.
4. V Supabase nastavit Site URL a Redirect URLs a ověřit, že odkaz z e-mailu končí na `/nove-heslo`.

Warnings, které samy o sobě vydání nezastaví, ale mají být známé: paměťový rate limit, chybějící samostatný CSRF token, velký katalogový chunk, Lighthouse neměřený, odměny vypnuté.

---

## Kroky pro majitele

### Vercel

1. Otevři tým `jindrichcompany`, projekt `cheat-eaps`.
2. Settings → Environment Variables. `PUBLIC_SITE_URL` = `https://cheat-eaps.vercel.app` pro Production, Preview i Development. Žádné lomítko na konci.
3. Build Command nech `npm run build`. Output Directory nech `dist`. Framework Vite.
4. Nenasazuj, dokud nechceš vydat i necommitnuté změny v pracovní kopii. Tenhle checklist commit ani push nedělal.
5. Po nasazení otevři `/`, `/restaurant/dhaba-beas-panska`, `/sitemap.xml` a `/robots.txt`. Úvod musí mít canonical a statický nadpis. Sitemap nesmí obsahovat `/odmeny` ani `/oblibene`.
6. `GET /api/loyalty/rewards` musí zůstat 503 `not-ready` a text nesmí zmiňovat SQL soubor. `loyalty.sql` nespouštěj.

### Supabase

1. Authentication → URL Configuration.
2. Site URL: `https://cheat-eaps.vercel.app`.
3. Redirect URLs musí obsahovat `https://cheat-eaps.vercel.app/nove-heslo`.
4. SQL editor neotevírej kvůli odměnám. Tabulky věrnosti se nezapínají.

### Právní text

Doplň pět údajů v checklistu na obou právních stránkách a nech text zkontrolovat, než se na něj budeš odkazovat jako na platnou informaci.

### Ruční auth

Postup je v sekci Auth. Účet zakládej jen ty.

---

## Nasazení a návrat

Nasazení se v tomto kole neprovedlo.

1. Ulož pracovní kopii do commitu, až o to požádáš. V commitu nesmí být `.env` ani klíče.
2. Push a deploy až na výslovné požádání. Vercel build má být `npm run build`, výstup `dist`.
3. Po deployi zkontroluj úvod, jeden detail, sitemap, robots, session endpoint a rewards 503.
4. Pak teprve ruční auth postup.

Návrat, když nový deploy rozbije web:

1. Vercel → projekt `cheat-eaps` → Deployments.
2. Otevři poslední nasazení, které ještě servírovalo funkční web.
3. Promote / Rollback na něj. Nový deploy nemaž, ať je vidět, co se vracelo.
4. Ověř `/` a `/api/auth/session`.
5. SQL nevracej a nespouštěj. Rollback nasazení databázi nevrátí. Proto se `loyalty.sql` nespouští, dokud odměny nemají být zapnuté.

---

## Rozhodnutí

**NOT READY TO LAUNCH**

Kritické cesty katalogu jsou v testech a v novém buildu ověřené. Veřejné vydání ještě nejde: živý web není tento build, právní stránky nemají provozovatele a živé přihlášení není ověřené.
