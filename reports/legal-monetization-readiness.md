# CheapEats Brno — právní připravenost a monetizace

Datum: 2026-11-05. Kontrola je z kódu v `C:\Users\novot\Desktop\cheapeats`. Commit, push, deploy ani produkční SQL se nespouštěly. Právní texty nejsou právně schválené. Identifikační údaje se nevymýšlely.

Verdikt: **NOT READY** pro veřejný provoz s účty ani pro platby a reklamu.

Autor projektu chce být provozovatelem a na stránce Podpoř mě uvádí, že je nezletilý. Potvrzené podnikatelské oprávnění ani schválený komerční provoz v projektu nejsou. Samostatná výdělečná činnost proto zůstává vypnutá.

---

## Co bylo upraveno

- Ochrana osobních údajů a obchodní podmínky popisují funkce, které v kódu jsou. Chybějící identita, právní základ, doby uložení a kontakt jsou dál označené „Doplní provozovatel“ a netváří se jako hotový údaj.
- Checklist chybějících údajů je i v `reports/legal-owner-inputs.md`.
- Cookie lišta se nepřidávala. Analytické a marketingové cookies v aplikaci nejsou.
- Ceník pro podniky už neříká FREE a neukazuje přeškrtnutou cenu jako slevu. Částka je označená jako ceník, který není v prodeji. Tlačítko Startu posílá žádost o katalog, ne objednávku. Plus a Premium odeslat nejdou.
- Sponzorovaný záznam má v kódu oddělení od organických výsledků. Dokud je `MONETIZATION_ENABLED` false, do doporučení ani do výsledků se nedostane a štítek Sponzorováno se nezobrazuje, protože žádné placené umístění neběží.
- Platby, fakturace a reklamní měření se nezapínaly.

---

## Jaké údaje se zpracovávají

| Údaj | Kde | Účel viditelný z funkce | Jak dlouho |
| --- | --- | --- | --- |
| E-mail a heslo účtu | Přihlašovací služba na adrese z nastavení serveru | Registrace a přihlášení | Není stanoveno. Heslo aplikace v odpovědi nevrací |
| E-mail a volitelná přezdívka | Profil v databázi | Účet a veřejný podpis recenze | Není stanoveno |
| Identifikátor oblíbené restaurace | Tabulka oblíbených, vazba na účet | Seznam oblíbených | Není stanoveno. Uživatel záznam v aplikaci odebere |
| Hodnocení, text recenze, přezdívka | Tabulka recenzí | Recenze po schválení administrátorem | Není stanoveno. Vlastní recenzi uživatel smaže. E-mail v recenzi není |
| Důvod hlášení a účet nahlašujícího | Tabulka hlášení | Nahlášení cizí recenze, nejvýš jednou | Není stanoveno |
| Název, adresa, lokalita, kategorie, popis, e-mail majitele, web, fotografie | Žádost podniku | Prosba o zveřejnění v katalogu | Není stanoveno |
| Zkrácený otisk adresy odesílatele | Žádost podniku | Odlišení odeslání, ne čitelná adresa | Není stanoveno |
| Souřadnice zvolené polohy | `localStorage` klíč `cheapeats.geo.origin` | Vzdálenost v prohlížeči | Dokud uživatel polohu nevypne nebo nesmaže data stránek. Na server CheapEats se neposílají |
| Identifikátory v porovnání | `sessionStorage` `cheapeats.compare.v1` | Porovnání v otevřeném panelu | Do zavření panelu |
| Návrat po změně hesla | `sessionStorage` `cheapeats-reset-next` | Návrat uvnitř webu | Do zavření panelu |
| Body, pohyby a kódy odměn | Kód to umí | Věrnost | Na produkci endpoint vrací, že věrnost není zapnutá. SQL se nespouštělo |

Právní základ se k žádnému řádku nepřiřazuje. Doby uložení se nevymýšlely.

Výmaz celého účtu tlačítkem není. Databázové tabulky profilu, oblíbených, recenzí a hlášení mají kaskádu při smazání účtu ve přihlašovací službě. Web to sám nespouští a nepředstírá, že žádost o výmaz vyřídil. Stažení všech údajů v jednom souboru není. Kontakt na provozovatele zveřejněný není.

Uživatel po přihlášení vidí oblíbené, vlastní recenzi může upravit nebo smazat a cizí recenzi nahlásit.

### Přenosy mimo vlastní server

- Prohlížeč se při zapnuté poloze ptá `routing.openstreetmap.de` a posílá souřadnice.
- Písmo Plus Jakarta Sans a Fraunces je uložené v projektu. Prohlížeč ho nenačítá z cizího serveru.
- Server volá databázi na adrese z prostředí. Oblast té databáze v repozitáři není.
- Server volá `https://api.resend.com`, jen když je odesílání e-mailu nastavené.
- Nasazení je na Vercelu. Retence provozních záznamů platformy v projektu není.

Jestli jsou tyto služby mimo EU nebo EHP, musí potvrdit provozovatel podle svého účtu. Aplikace to nehadá.

Analytický a reklamní skript v aplikaci není. Kontaktní formulář pro obecný dotaz uživatele není. Formulář pro podnik je žádost o zveřejnění.

---

## Cookies

| Druh | Název | Stav |
| --- | --- | --- |
| Nezbytná technická | `ce_access` | HttpOnly, SameSite Lax, na https Secure. Platnost z přihlášení, jinak jedna hodina |
| Nezbytná technická | `ce_refresh` | Stejné příznaky, 30 dní |
| Nezbytná technická | `ce_pkce` | Kód ji umí smazat. Běžné přihlášení ji nenastavuje |
| Analytická | žádná | — |
| Marketingová | žádná | — |

Cookie lišta se nepřidávala. Souhlas se nepředstírá. Načtení písem z Google souhlasem omezené není. To je otevřený bod pro provozovatele, ne hotové posouzení.

---

## Stav právních stránek

**NOT READY.** Stránky říkají, že nejsou platné a nejsou právně schválené. Chybí vše z `reports/legal-owner-inputs.md`.

---

## Stav monetizace

**Vypnutá.**

- Dobrovolná podpora platbu nespustí, dokud nejsou ověřené adresa, příjemce, podmínky služby a souhlas zákonného zástupce. V kódu jsou všechny tyto podmínky false.
- Ceník Start, Plus a Premium je vidět jako připravené částky. Objednat, zaplatit ani fakturovat je nejde.
- Žádost, která jde odeslat, zveřejnění v katalogu sama nezapne a reklamu nezapne.
- Sponzorované výsledky ve datech nejsou. Kód je drží mimo organický seznam, dokud se monetizace výslovně nezapne, a pak musí mít text Sponzorováno.
- Falešní partneři se nezakládali.

---

## Blokery před veřejným provozem účtů

1. Doplnit identitu správce a zveřejněný kontakt, jinak nejde vyřídit přístup a výmaz.
2. Vyřešit, že zamýšlený provozovatel je nezletilý, včetně souhlasu zákonného zástupce tam, kde ho činnost vyžaduje.
3. Nechat text zkontrolovat. Tenhle dokument ani stránky v aplikaci právním schválením nejsou.
4. Rozhodnout o písmech z Google a o oblasti databáze a e-mailové služby.

## Blokery před reklamou a platbami

1. Potvrzené oprávnění k výdělečné činnosti a souhlas zákonného zástupce, pokud je provozovatel nezletilý.
2. Doplněné a zkontrolované podmínky a informace o zpracování.
3. Zveřejněný kontakt a postup výmazu.
4. Zapnutá monetizace až ve chvíli, kdy sponzorovaný výsledek má označení a je mimo organická doporučení.
5. U podpory ověřený příjemce, podmínky platební služby a souhlas zástupce. Do té doby tlačítko platbu nespouští.
6. U podniků smlouva a fakturace mimo tenhle web. Ceník na stránce smlouvou není.

---

## Testy

`npm test`: 285 testů, 76 sad, 0 selhání. Doba běhu 2,6 s. Nové jsou tři testy oddělení sponzorovaných výsledků.

`npm run lint`: skončil kódem 0. Zůstala starší varování ve skriptech ilustrací, kontextech a efektech administrace a odměn.

`npm run build`: dokončen. Právní stránky jsou v samostatných souborech, katalog dál 1 256,07 kB.
