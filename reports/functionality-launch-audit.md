# CheapEats Brno — audit před vydáním

Datum: 2026-11-05. Kontrola běžela v `C:\Users\novot\Desktop\cheapeats` (aktuální pracovní kopie, ne starší ZIP). Commit, push, deploy ani produkční SQL se nespouštěly. `supabase/loyalty.sql` se nespouštěl.

Verdikt: **NOT READY TO LAUNCH**

Web umí hledat, filtrovat a oddělit ověřenou cenu od odhadu. Veřejné vydání brzdí chybějící údaje provozovatele na právních stránkách, prázdné `PUBLIC_SITE_URL` (sitemap se při buildu nezapíše) a to, že živé přihlášení, oblíbené a recenze nebyly v prohlížeči projeté s reálným účtem. Věrnostní body jsou v databázi vypnuté a stránka to teď říká jako „Připravujeme“, neslibuje jejich čerpání.

---

## 1. Co bylo v této vlně změněno

- Hledání bere slovo celé. „pizza“ už netrefí Gelateria Piazza a „Burger King“ už netrefí Let’s STEAKing. Krátký prefix pro našeptávač („pi“) zůstává. Přesný název kategorie se mimo kategorii neshoduje jen kvůli jednomu překlepu.
- Dotaz „bez masa“ bere podniky v kategorii Bez masa / Vegan a veganské podniky. Nestačí OSM příznak jedné vegetariánské položky. Filtr vegetariánské nabídky ve formuláři se nemění.
- Filtr vzdálenosti nepočítá prozatímní vzdušnou čáru jako pěší trasu. Řazení pořád může použít dočasné číslo, na kartě je pořád „…“, ne „pěšky“.
- Stejná ověřená cena se řadí dál podle názvu a ID.
- Stránka Odměny při chybějících věrnostních tabulkách ukáže „Připravujeme“ a neschová ISIC odkaz. Veřejné hlášky už neříkají, ať se v SQL editoru spustí migrace. Odeslání recenze neslibuje 5 bodů.
- Fotka na kartě má přístupné jméno odkazu (název podniku). Vizuální štítek „Ilustrační fotografie“ zůstává.
- `vercel.json` cacheuje ilustrace a `/assets` na rok.
- Do `index.html` přibyl JSON-LD typu WebSite bez hodnocení, otevírací doby a recenzí.
- Regresní testy: `src/utils/catalogSearch.test.js` a doplnění stávajících testů.

## 2. Nalezené chyby

- Hledání „pizza“ bralo i „Piazza“ (jedna vložená hláska). Hledání „Burger King“ bralo Let’s STEAKing, protože „king“ bylo uvnitř „STEAKing“.
- „bez masa“ vracelo i Burger King jen kvůli OSM `diet:vegetarian`.
- Filtr „do X km“ mohl během načítání trasy použít vzdušnou čáru.
- API věrnosti a komunity při chybějících tabulkách vracelo návod se souborem SQL.
- Recenze po uložení slibovala body, i když loyalty tabulky v Supabase nejsou.
- Odměny šly získávat a utrácet v textu stránky, ačkoli remote tabulky chybí.
- `PUBLIC_SITE_URL` je prázdné, build proto nezapsal `sitemap.xml`.

## 3. Opravené chyby

Vše z bodu 2 kromě sitemap. Sitemap se nezapne, dokud majitel nenastaví veřejnou `https://` adresu. To je konfigurace, ne tichá domněnka.

## 4. Soubory změněné v této vlně

- `src/utils/smartSearch.js`
- `src/utils/filterRestaurants.js`
- `src/utils/discovery.test.js`
- `src/utils/filterRestaurants.test.js`
- `src/utils/catalogSearch.test.js` (nový)
- `src/server/loyalty.js`
- `src/server/loyalty.test.js`
- `src/server/community.js`
- `src/pages/Rewards.jsx`
- `src/components/RestaurantCard.jsx` (jen přístupné jméno odkazu na fotku; zbytek diffu proti HEAD je starší necommitnutá práce)
- `index.html`
- `vercel.json`
- `package.json` (test script)
- `reports/catalog-audit.md` a `reports/catalog-audit.json` (znovu vygenerovaný audit)
- `reports/catalog-manual-review.md`
- `reports/functionality-launch-audit.md`

Starší necommitnuté změny v pracovní kopii se nemazaly a nepřepisovaly.

## 5. Testy

`npm test` — **279 testů, 0 selhání** (2026-11-05).

Nové kontroly nad sloučeným katalogem 775 podniků:

- pizza, burger, kebab, sushi, kavárna / kavarna vrací výsledky bez duplicit
- pizza neshodí Gelateria Piazza, piza také ne
- Burger King = 5 poboček, bez Let’s STEAKing
- Prime Steak se najde a není kavárna
- Pekařská a pekarska vrací stejný seznam ulic
- „jídlo do 150 Kč“ a „pizza do 200 Kč“ berou jen ověřenou cenu pod stropem
- „bez masa“ zahrne Dhaba Beas a vynechá Burger King
- „kebab Královo Pole“ nesmí vrátit jinou kuchyni (v datech je 0 podniků, jejichž adresa čtvrť obsahuje)
- „levný oběd“ smí vrátit jen záznam s `lunchMenu` a ověřenou cenou do 120 Kč (teď 0, v datech jsou jen 2 polední menu a nesplňují ověřený strop)

To nejsou end-to-end testy v prohlížeči.

## 6. Lint

`npm run lint` (oxlint) skončil bez erroru. Zůstávají starší warningy (fast refresh u contextů, setState v effectu u admin stránek a u načtení odměn, dva nepoužité symboly ve skriptech).

## 7. Build

`npm run build` prošel (Vite 8.3.0, asi 2,4 s).

- `dist/assets/index-ePoQW_PH.js` — 1 703,68 kB (gzip 344,71 kB)
- `dist/assets/index-DnZJmPN7.css` — 58,35 kB (gzip 12,37 kB)
- Vite hlásí chunk nad 500 kB. Katalog a Pixabay knihovna jedou v jednom balíku.

`dist/sitemap.xml` nevznikl, protože `PUBLIC_SITE_URL` je prázdné. `dist/robots.txt` je z `public/robots.txt` a bez řádku Sitemap.

## 8. Výkon

**NOT TESTED** jako Lighthouse. Cíle LCP, CLS a INP se neměřily, takže se neuvádějí jako splněné.

Po buildu je hlavní JS velký (viz výše). Předchozí velikost balíku se v téhle vlně neměřila, srovnání před/po tedy není.

V prohlížeči na šířce 360 px úvod nepřetékal (`scrollWidth` 360).

## 9. Stav katalogu — PASS s WARNING

- 775 unikátních ID, audit 2026-11-05: 0 potvrzených chyb klasifikace.
- Prime Steak: restaurace, ne kavárna. Burger King: kategorie Burger.
- Ruční seznam: `reports/catalog-manual-review.md`.
- **WARNING:** vygenerované věty typu „Jde o kavárna“ jsou gramaticky špatně. Hromadně se nepřepisovaly.
- **WARNING:** „kebab Královo Pole“ nic nenajde, protože žádný kebab v adrese čtvrť nemá.

## 10. Stav ověřených cen — PASS

- 68 podniků má ověřenou cenu se zdrojem a datem, 707 má označený odhad, 0 má obojí najednou jako platný druh ceny.
- Rozpočtový filtr i dotazy „do 150 / do 200“ odhad neberou.
- Karta ukazuje „Ověřeno“ nebo „~… Odhad“. V prohlížeči to bylo vidět u Burger Kingu (odhad) a u Forky’s / Bistro FRANZ (ověřeno).
- Nové ceny se nevytvářely.

## 11. Stav fotografií — WARNING

- Test knihovny kontroluje, že přiřazené Pixabay soubory v `public/` existují. V této vlně prošel.
- Největší soubory mají kolem 1,0–1,2 MB (PNG/JPG v `public/food-illustrations`). Nepřeváděly se na WebP, aby se nerozbily cesty a výběr fotek.
- Ilustrace mají vizuální označení. Odkaz na fotku karty má teď jméno podniku.
- Kategorie na úvodu se v prohlížeči načetly (Slevy, Pizza, Burger, Bez masa a další).

## 12. Stav Supabase — WARNING

Read-only kontrola `node scripts/check-supabase-schema.mjs` (klíč se nevypisuje):

- `profiles`, `favorites`, `reviews`, `review_reports`, `business_applications`, `published_places`: tabulka existuje (část je pro anon správně nečitelná).
- Loyalty: všech 5 tabulek **MISSING**.

## 13. Stav Auth — WARNING

- Kód drží HttpOnly cookie, Secure na HTTPS, SameSite=Lax, obnovu session a PKCE/token_hash. Pokrývají to jednotkové testy v `memberHttp.test.js`.
- **NOT TESTED** v prohlížeči: registrace, špatné heslo, odhlášení, obnovení hesla a výpadek Supabase s živým účtem.
- Rate limit je v paměti procesu. Na více instancích Vercelu se nesdílí. Návrh: jeden sdílený čítač (Redis / tabulka), ne další in-memory mapa. Bez toho to není důkaz odolnosti proti opakovaným pokusům.
- CSRF u zápisů drží SameSite=Lax u session cookie (prohlížeč cookie nepošle na cizí POST). Samostatný CSRF token v kódu není.

## 14. Stav slev — PASS s WARNING

- V prohlížeči `/results?deals=1` bez session skončí na `/prihlaseni?next=/results?deals=1`. Text říká, že přihlášení nenahrazuje ISIC a že body se neodečítají.
- Testy drží kód nabídky na serveru a běžnou kartu bez slevového štítku.
- Platnost v datech je do 2026-12-04 jako datum další kontroly, ne jako konec akce u ISIC. Zdroj se v téhle vlně znovu neotevíral. Před tímto datem nabídky znovu ověřit, jinak je nenechat viset jako jisté.

## 15. Stav Rewards — WARNING

- Remote tabulky chybí. Stránka `/odmeny` v prohlížeči ukázala „Připravujeme“ a neschovává odkaz na ISIC slevy. Uplatnění bodů se nenabízí.
- SQL kontrakt `loyalty.sql` testy prošly. Soubor se nespouštěl.
- Dokud tabulky a skutečné kódy partnerů nejsou, body nezapínat.

## 16. Stav SEO — WARNING

- Úvod má title, description, jeden H1 a JSON-LD WebSite bez smyšleného hodnocení.
- Title výsledků, přihlášení a 404 se v prohlížeči mění až po JavaScriptu.
- Aplikace je SPA. Vercel posílá stejné `index.html` na všechny cesty. Bez JS vyhledávač neuvidí seznam podniků. Prerender ani změna frameworku se nedělaly.
- `robots.txt` zakazuje `/admin/`, `/api/` a přihlášení. Sitemap chybí, dokud není `PUBLIC_SITE_URL` ve tvaru `https://…`.
- Canonical a Open Graph URL skládá klient z aktuální adresy. Ve statickém HTML pro všechny URL jeden canonical není, aby se restaurace neoznačily za úvod.

## 17. Stav právních stránek — BLOCKER

- `/ochrana-osobnich-udaju` a obchodní podmínky jsou v kódu označené jako kostra. Jméno, adresa, IČO a e-mail provozovatele v nich nejsou a nevymýšlely se.
- Test `publicCopy` to hlídá. Stránky nejsou hotové právní texty.

## 18. Zbývající problémy

- Chybí identita provozovatele a právní revize.
- Chybí produkční `PUBLIC_SITE_URL` a tím sitemap.
- SPA bez prerenderu.
- Balík ~1,7 MB a ilustrace až ~1,2 MB.
- In-memory rate limit na serverless.
- Loyalty tabulky chybí (UI to přiznává).
- 7 + 3 podniky k ruční kontrole v `reports/catalog-manual-review.md`.
- „levný oběd“ a „kebab Královo Pole“ nemají v datech co vrátit. To není závada vyhledávače.
- Gramatika generovaných popisů („Jde o kavárna“).
- Živé E2E auth, oblíbených, recenzí a GPS v prohlížeči.
- Žádný zátěžový test.

## 19. Co musí udělat majitel

1. Doplnit správce: jméno nebo název, adresa, IČO, kontaktní e-mail.
2. Doplnit účely a právní základy, doby uložení, seznam zpracovatelů (nejméně hosting, Supabase, e-mail) a nechat text zkontrolovat.
3. Nastavit na Vercelu `PUBLIC_SITE_URL` na produkční `https://` adresu a v Supabase stejnou Site URL plus Redirect URL na `/nove-heslo`.
4. Rozhodnout, jestli se věrnostní body mají zapnout. Pokud ano, nejdřív dodat skutečné partnerské odměny a kódy, pak teprve spustit `supabase/loyalty.sql`. Bez toho SQL nespouštět.
5. Do 2026-12-04 znovu otevřít ISIC stránky a buď prodloužit kontrolu, nebo nabídku vypnout (`active: false`).
6. Ručně rozhodnout podniky v `reports/catalog-manual-review.md`.
7. Před tvrzením o tisících návštěvnících udělat zátěžový test. Tenhle audit ho nedělal.

## 20. Doporučení před nasazením

- Nesdílet web jako hotový právní a věrnostní produkt.
- Po doplnění `PUBLIC_SITE_URL` znovu spustit build a zkontrolovat, že v `dist` je `sitemap.xml` a v `robots.txt` řádek Sitemap.
- Rate limit přesunout do sdíleného úložiště, až půjde provoz mimo jednu instanci.
- Velké PNG ilustrace zmenšit jednotlivě a nechat stávající výběr fotek.
- Prerender veřejných URL řešit až jako samostatný krok, ne výměnou frameworku těsně před vydáním.
- Monitoring bez nové analytiky: hlídat 5xx na `/api/auth/session`, `/api/favorites`, `/api/reviews` a podíl odpovědí 503 `not-ready` u loyalty. Logovat status a cestu, ne e-mail, heslo ani tělo recenze. Alert při opakovaných 5xx. Rollback je předchozí Vercel deployment, databázi to samo nevrací.

---

## Stav po oblastech

| Oblast | Stav |
| --- | --- |
| Hledání | PASS |
| Poloha a vzdálenost | WARNING — logika a testy ano, živé GPS v prohlížeči NOT TESTED |
| Katalog | WARNING |
| Ověřené a odhadované ceny | PASS |
| Fotografie | WARNING |
| Výkon | NOT TESTED (Lighthouse); balík je velký |
| Auth | WARNING |
| Supabase schéma | WARNING |
| ISIC slevy | WARNING |
| Oblíbené a recenze | WARNING — testy API ano, prohlížeč s účtem NOT TESTED |
| Rewards | WARNING |
| SEO | WARNING |
| Právní stránky | BLOCKER |
| Přístupnost a mobil | WARNING — 360 px úvod bez vodorovného scrollu; 390, 430, 768, 1024 a 1440 se v téhle vlně neměřily |
| Monitoring a kapacita | NOT TESTED jako zátěž |

## Prohlížeč (není to plné E2E)

Ověřeno na `http://127.0.0.1:5173`:

- `/results?q=pizza` — 73 míst, bez Gelateria Piazza, odhady označené
- `/results?q=Burger%20King` — 5 míst, všechna Burger King, cena jako odhad
- `/odmeny` — text Připravujeme, bez uplatnění bodů
- `/results?deals=1` — přesměrování na přihlášení s `next`
- `/` na šířce 360 px — menu, kategorie, karty, bez vodorovného přetečení
- `/tato-stranka-neexistuje` — 404

Neověřeno v prohlížeči: registrace, přihlášení, odhlášení, obnovení hesla, uložení oblíbených, odeslání recenze, povolení a zákaz GPS, ostatní šířky.

## NOT READY TO LAUNCH

Chybí povinné údaje provozovatele, produkční kanonická adresa a sitemap, a kritické účty (přihlášení, oblíbené, recenze) nejsou ověřené v prohlížeči. Věrnostní body jsou schválně vypnuté, dokud v databázi nejsou tabulky a skutečné odměny. Hledání, oddělení cen a brána slev jsou v kódu a v prohlížeči na vyzkoušených cestách v pořádku, to ale samo o sobě vydání neuzavírá.
