# Slevy a výhody, Brno — kontrola 29. 10. 2026

Kontrola je ruční otevření stránek, ne hromadný import. Datum kontroly všech níže otevřených zdrojů je 29. 10. 2026. Žádná nabídka nemá v katalogu stav `verified`: zdroj nikde neuvádí zároveň začátek i konec. Veřejný štítek proto není garantovaná aktivní sleva. Detail to říká explicitně.

Do aplikace šly jen nabídky, u kterých stránka mluví o celé ČR nebo o brněnské pobočce, kterou v datasetu máme. Kde stránka říká „zkontroluj mapu poboček“ a mapu jsem neotevřel, nabídka v aplikaci není.

## Otevřené zdroje

| Zdroj | Co je na stránce | V aplikaci |
| --- | --- | --- |
| https://www.isic.cz/slevy/cr/kfc/709 | 2× Twister za 149 Kč, Qurrito + hranolky 80 g za 100 Kč, Cheeseburger za 35 Kč. Celá ČR. Online kódy TWIST2ISIC, QURRITOISIC, CHEESEISIC. Bez data konce. | Ano, všechny 4 brněnské KFC |
| https://www.isic.cz/slevy/cr/mcdonald-s/729 | Velké McMenu 155 Kč (Big Mac, McRoyal, McChicken, 6 McNuggets), McMuffin menu 89 Kč, café latte 0,3 l nebo cappuccino 0,2 l za 55 Kč. Jednou denně. Čtvrtý blok na stránce nemá název produktu, ten jsem nepřevzal. | Ano, Masarykova i náměstí Svobody |
| https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/burger-king/720 | Steakhouse menu 189 Kč, kuřecí combo 129 Kč. Česká verze stejného záznamu v převodu ceny v nadpisu neukázala, částky jsou z anglické verze. Bez vyloučené pobočky a bez data konce. | Ano, všech 5 brněnských Burger King |
| https://www.isic.cz/slevy/cr/ugo/7125 | Fresh č. 9 za 79 Kč, salát od 165 Kč, bowl 189/209 Kč, grill menu 129 Kč. Jednou denně. Mimo hru jsou jen freshbary na letišti v Praze. | Fresh na obou brněnských UGO. Jídla jen u salaterie Campus Square, ne u freshbaru Cimburkova |
| https://www.isic.cz/slevy/cr/starbucks/9265 | Upsize: Venti za cenu Grande, vlastní kelímek dalších 10 Kč (to není −10 %). Neplatí ve Starbucks Reserve Jungmannova. Limitovaná akce: dva nápoje Venti, levnější zdarma, konec 17. 11. 2026, začátek neuveden. | Ano, jen náměstí Svobody 5 |
| https://www.isic.cz/slevy/cr/bageterie-boulevard/6946 | Studentská nabídka je v aplikaci v sekci kupóny. Částka, procento ani kód na webu nejsou. | Ano, Masarykova, Netroufalky a Vaňkovka, bez vymyšlené hodnoty |

## Nenaimportováno

- Subway, anglická stránka https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/subway/724 : 1+1 je jen Praha (mimo hlavní nádraží). Menu 30 cm za 199 Kč platí v Brně, Olomouci a Ostravě, ale stejná stránka říká ověřit mapu poboček. Mapu jsem neotevřel, takže Vaňkovka konkrétně potvrzená není. Menu za 109 Kč a −10 % také říkají „zkontroluj mapu“ a Brno výslovně nejmenují. V aplikaci není nic.
- U Mamlasů, Náměstí Svobody 74/10 je v datasetu. Vyhledání ukázalo text o 10 % z účtu za jídlo a nápoje, ale přímé otevření https://www.isic.cz/slevy/cr/pizzerie-francesco-u-mamlasu/7692 i anglické adresy vrátilo 404. Nabídku jsem proto nepřevzal.
- ILEGAL Mexican street food je na ISIC jako Brno (quesadilla do 31. 12. 2026, polední menu, tacos). V datasetu CheapEats ten podnik není, takže se nepřidával.
- Jídelna 17 a Mama's Burger na Pankráci v datasetu nejsou. Prague-only akce se na Brno nepřenášely.
- Aplikace McDonald's, Starbucks Rewards, Bageterie Boulevard a Alive jsem neotevřel. Kupóny, které jsou jen v nich, v katalogu nejsou. Výjimka je věta na webu ISIC, že Bageterie má studentské kupóny v aplikaci — bez částky.
- Běžná denní menu a nízké ceny z ceníku nejsou slevy. Procento bez doloženého základu v datech není.

## Počty v aplikaci

38 řádků nabídka × pobočka, 15 šablon, všechny stav `listed`, žádná `verified`, žádná prošlá v katalogu.

| Typ | Řádků | Štítek |
| --- | ---: | --- |
| Studentská pevná cena nebo upsize | 34 | Studentská sleva |
| 1+1 (Starbucks Venti do 17. 11. 2026) | 1 | 1+1 zdarma |
| Věrnostní aplikace (Bageterie, bez částky) | 3 | Studentská sleva a Věrnostní výhoda |
| Procento −10 % nebo −20 % | 0 | štítek je v kódu, v datech ho nic nespouští |

Kódy KFC nejsou ve veřejném datovém souboru. Vrací je `/api/deal-detail` až po přihlášení.
