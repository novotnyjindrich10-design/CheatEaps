# SEO a výkon — 5. 11. 2026

Build umí kanonickou adresu, sitemapu a statické HTML veřejných stránek i bez proměnné na Vercelu. Živý web `https://cheat-eaps.vercel.app` pořád servíruje starý prázdný shell, protože tenhle běh nic nenasazoval.

## Co se změnilo

- Kanonická adresa je v kódu: `https://cheat-eaps.vercel.app` (`src/constants/site.js`). Prázdné nebo ne-https `PUBLIC_SITE_URL` se do sitemapu nedostane. Platné https v prostředí buildu ji přepíše.
- Sitemap má úvod, výsledky, Pro podniky, Podpoř mě, obě právní stránky a 775 detailů restaurací. Nemá přihlášení, registraci, nové heslo, oblíbené, odměny, porovnání, nabídky, administraci ani API.
- Veřejné stránky a detaily restaurací se při buildu zapíšou jako HTML s titulkem, popisem, canonical, Open Graph a viditelným textem. Detail má název, adresu a stav ceny (ověřená, nebo odhad). JSON-LD je `FoodEstablishment` bez hodnocení a bez otevírací doby. Soukromé cesty mají vlastní soubor s `noindex, nofollow` a bez katalogového textu.
- React Router zůstává. Po načtení aplikace se statický blok schová. Soukromé stránky (přihlášení, odměny, oblíbené, porovnání, administrace, nabídka, právní texty, formuláře) jdou do samostatných chunků.
- Katalog dat je vlastní chunk. Pořád se stahuje s první stránkou, protože úvod a detail ho potřebují.
- Ilustrace nad 180 kB se zmenšily na nejvýš 1280 px. JPEG quality 72. Dvě fotografie bez průhlednosti (`8021417`, `10359850`) jsou JPEG se stejnou cestou v knihovně. Výběr fotografií se neměnil.
- `vercel.json` má `cleanUrls: true` a `trailingSlash: false`. Podle dokumentace Vercelu má soubor na disku přednost před přepisem na `/index.html`.

## Bundle

Měřeno `npm run build` (Vite 8.3.0), před rozdělením a po něm.

| | před | po |
| --- | --- | --- |
| vstupní JS | `index-ePoQW_PH.js` 1 703,68 kB (gzip 344,71 kB) | `index-CKkE6_I3.js` 117,39 kB (gzip 36,57 kB) |
| React a knihovny | v tom samém souboru | `vendor-CzjRjdel.js` 259,07 kB (gzip 82,23 kB) |
| katalog | v tom samém souboru | `catalog-uxH0mx3F.js` 1 256,07 kB (gzip 206,48 kB) |
| CSS | 58,35 kB (gzip 12,37 kB) | 58,73 kB (gzip 12,45 kB) |

První návštěva pořád stáhne vstup, vendor, katalog a runtime (0,58 kB / gzip 0,36 kB), protože `dist/index.html` má na ně `modulepreload`. Součet těchto čtyř souborů je 1 633,11 kB, gzip 325,64 kB. Dřív to byl jeden soubor 1 703,68 kB / gzip 344,71 kB. Všechny JS soubory v `dist/assets` dohromady mají 1 708 934 bajtů; navíc jsou v tom lazy stránky, které úvod nenačítá. Katalog pořád hlásí chunk nad 500 kB. Jsou to data podniků, ne stránky.

## Sitemap a canonical

`dist/sitemap.xml` má 781 adres, 72 007 bajtů. Z toho 775 je `/restaurant/…`. Kontrola nenašla přihlášení, odměny, oblíbené, porovnání, nabídku, administraci ani API. `dist/robots.txt` končí řádkem `Sitemap: https://cheat-eaps.vercel.app/sitemap.xml` a zakazuje i `/oblibene`, `/odmeny`, `/porovnani` a `/nabidka`.

Úvod v `dist/index.html` má canonical `https://cheat-eaps.vercel.app/`. Detail Dhaba Beas Panská má titulek `Dhaba Beas Panská | CheapEats Brno`, vlastní canonical a text ceny. Nemá `aggregateRating` ani `openingHours`.

Živý `https://cheat-eaps.vercel.app` v době kontroly vrátil 200 a titulek CheapEats Brno, ale tělo mělo 1 396 bajtů. To je starý shell bez canonical a bez sitemapu. Nové HTML se na produkci objeví až po deployi.

Projekt v `.vercel/project.json` je `cheat-eaps` (`prj_BDmb0MtTFlQR6Ao7lY1fkcwidQH9`). Čtení projektu přes Vercel API skončilo 403 pro tým `jindrichcompany`. Proměnná se odsud nezapsala.

Build sitemapu a prerenderu na téhle adrese už proměnnou nepotřebuje. Pro e-maily a pro případnou jinou doménu ji stejně nastav:

1. Vercel → tým jindrichcompany → projekt cheat-eaps → Settings → Environment Variables.
2. `PUBLIC_SITE_URL` = `https://cheat-eaps.vercel.app` pro Production, Preview i Development. Bez lomítka na konci.
3. Supabase → Authentication → URL Configuration: Site URL stejná adresa, Redirect URLs obsahují `https://cheat-eaps.vercel.app/nove-heslo`.
4. Redeploy. Bez něj produkce nové soubory neposílá.

## Indexovatelnost

Veřejná HTML jsou v `dist` a mají text i metadata. `vite preview` bez lomítka na konci spadne na SPA shell; s lomítkem (`/restaurant/dhaba-beas-panska/`) vrátí soubor detailu. Na Vercelu to má srovnat `cleanUrls`. Nasazení jsem nespouštěl, takže tohle chování na živé doméně ověřené není.

V prohlížeči na `vite preview` přímá adresa detailu vykreslila Dhaba Beas Panská, úvod hledání a karty, klik na Pizzu otevřel výsledky a `/odmeny` načetl stránku Slevy a odměny. `/prihlaseni` načetl přihlášení. Formulář se neukázal, protože preview nemá API a stránka správně hlásí, že přihlášení není k dispozici.

## Fotografie

Složka `public/food-illustrations` má po úpravě 689 souborů a 76 679 773 bajtů. Žádný nepřesahuje 400 kB. Před úpravou byly v gitu 440 souborů o 110 260 986 bajtech. 439 cest, které zůstaly, má teď 47 760 271 bajtů. `8021417.png` je nahrazený JPEG. Celkový součet všech 689 souborů před kompresí nemám: první průchod stihl část souborů přepsat dřív, než vznikl jeden výchozí součet. Největší tehdy naměřený soubor byl `neuvedeno-2c628d6f.jpg`, 1 216,5 kB.

Karty mají `loading=lazy` kromě prvních tří. Kategorie v marquee kopii taky. Hero detailu zůstává `eager`, protože je to hlavní snímek stránky. Rozměry karet a kategorií už v markupu byly.

## Testy

- `npm test`: 282 prošlo, 0 selhalo.
- `npm run lint`: skončil 0. Zůstávají starší warningy (fast refresh, `setState` v effectu, nepoužité proměnné ve skriptech).
- `npm run build`: prošel. Sitemap a HTML detailu zkontrolované skriptem nad `dist`.
- Prohlížeč: úvod, pizza výsledky, přímý detail, přihlášení a odměny na `http://127.0.0.1:4173`.
- Lighthouse v PATH není, Chrome ani Edge taky ne. Mobilní skóre jsem neměřil.

## Zbývá

- Nasadit tenhle build. Bez deploye produkce sitemap ani prerender nemá.
- Doplnit provozovatele na právních stránkách. Ty stránky jsou pořád kostra a v sitemapu jsou.
- Věrnostní tabulky v Supabase pořád chybí. `/odmeny` se neindexuje.
- Katalogový chunk 1 256 kB je pořád součástí první návštěvy.
- Přihlášení, oblíbené a recenze jsem v tomhle kole nejel proti živému účtu.
- `cleanUrls` na Vercelu není ověřené nasazením. `vite preview` bez koncového lomítka statický detail nepodá.
