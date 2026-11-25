import { Link } from 'react-router-dom'
import LegalMissing from '../components/LegalMissing'
import OperatorSlot from '../components/OperatorSlot'
import { CONTACT_EMAIL } from '../constants/brand'

export default function Privacy() {
  return (
    <main className="page legal-page">
      <h1>Zásady ochrany osobních údajů</h1>
      <p className="deal-warning" role="status">
        Tohle není platný právní text a není právně schválený. Popisuje, co aplikace podle kódu umí.
        Části označené „Doplní provozovatel“ nejsou hotový údaj. Než se na stránku odkáže jako na
        informace o zpracování, musí je provozovatel doplnit a nechat text zkontrolovat.
      </p>

      <LegalMissing />

      <OperatorSlot title="Kdo je správce">
        <p>
          Jméno, adresa, IČO a DIČ tu nejsou. Aplikace je nedoplňuje. Provozovatelem má být živnost,
          pod kterou se projekt vede. Dokud údaje v konfiguraci chybí, nejde o hotovou identitu
          správce. Provozní kontakt značky je{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          ; není to sám o sobě právní identifikace správce.
        </p>
      </OperatorSlot>

      <section>
        <h2>Jaké údaje se ukládají</h2>
        <p>Níže je, co aplikace ukládá. Není to právní základ ani slib, jak dlouho údaj zůstane.</p>
        <h3>Účet</h3>
        <ul>
          <li>E-mail a heslo jdou do přihlašovací služby. Heslo se v odpovědi aplikace nevrací.</li>
          <li>Profil drží e-mail účtu a volitelnou přezdívku. Přezdívka nesmí být e-mail.</li>
          <li>Oprávnění správce se neřídí tím, co pošle prohlížeč.</li>
        </ul>
        <h3>Oblíbené, recenze a hlášení</h3>
        <ul>
          <li>Oblíbená restaurace je vazba účtu a identifikátoru podniku.</li>
          <li>
            Recenze drží hodnocení, text do 1000 znaků a veřejnou přezdívku. E-mail autora se do
            recenze neukládá. Ostatním se ukáže až po schválení administrátorem.
          </li>
          <li>
            Hlášení cizí recenze drží důvod do 280 znaků a účet, který ji nahlásil. Vlastní recenzi
            nahlásit nejde. Jedna osoba nahlásí stejnou recenzi jen jednou.
          </li>
        </ul>
        <h3>Žádost podniku</h3>
        <ul>
          <li>
            Žádost o zveřejnění může obsahovat název, adresu, lokalitu, kategorii, zaměření, popis,
            e-mail majitele, web a fotografii, pokud ji formulář pošle.
          </li>
          <li>K žádosti se ukládá zkrácený otisk adresy odesílatele, ne celá adresa v čitelné podobě.</li>
          <li>Schválení může poslat e-mail majiteli, jen když je odesílání na serveru nastavené.</li>
        </ul>
        <h3>Poptávka placené propagace</h3>
        <ul>
          <li>
            Poptávka může obsahovat název podniku, firmu, IČO, DIČ, kontaktní osobu, e-mail, telefon,
            fakturační adresu, web a zvolený balíček.
          </li>
          <li>Veřejný seznam poptávek není. Cizí údaje bez klíče poptávky ani bez práv administrátora stránka neukáže.</li>
          <li>Aktivní reklama na webu ukáže jen identifikátor podniku, balíček a dobu umístění. Kontakt firmy v seznamu výsledků není.</li>
        </ul>
        <h3>Poloha</h3>
        <p>
          Souřadnice pro vzdálenost zůstávají jen v tomto prohlížeči. Na server FoodGo se neposílají.
          Vzdálenost v katalogu se počítá v prohlížeči. Vypnutím polohy se záznam smaže.
        </p>
        <h3>Věrnostní body</h3>
        <p>
          Věrnostní body teď nejsou zapnuté. Z veřejné stránky se nic neodečítá.
        </p>
      </section>

      <OperatorSlot title="Proč se údaje zpracovávají a na jakém základě">
        <p>
          Účely viditelné z funkcí jsou účet, oblíbené, recenze, hlášení recenze, žádost o zveřejnění
          podniku a výpočet vzdálenosti v prohlížeči. Právní základ k nim aplikace nepřiřazuje.
        </p>
      </OperatorSlot>

      <section>
        <h2>Kam údaje odcházejí</h2>
        <p>Údaje mohou odejít těmto službám:</p>
        <ul>
          <li>Účet, profil, oblíbené, recenze, hlášení a žádosti podniků jdou do databáze nastavené na serveru.</li>
          <li>E-mail se odesílá přes Resend, jen když je odesílání zapnuté.</li>
          <li>Stránky běží na Vercel.</li>
          <li>Písmo Plus Jakarta Sans a Fraunces je uložené u FoodGo. Prohlížeč ho nenačítá z cizího serveru. Analytický ani reklamní skript v aplikaci není.</li>
          <li>
            Podklad mapy se načítá z mapové služby (OpenFreeMap, nebo z vlastní šablony dlaždic, pokud je nastavená).
            Souřadnice podniků zůstávají u FoodGo.
          </li>
        </ul>
      </section>

      <OperatorSlot title="Jak dlouho údaje zůstanou">
        <p>
          Doba uložení účtu, recenzí, hlášení, žádostí a e-mailů tu není. Aplikace sama záznamy po čase
          nemaže. Technické cookies a údaje v prohlížeči mají chování popsané níže.
        </p>
      </OperatorSlot>

      <section>
        <h2>Cookies a podobné údaje</h2>
        <p>Analytické a marketingové cookies aplikace nenastavuje. Lišta se souhlasem tu proto není.</p>
        <h3>Nezbytné technické</h3>
        <ul>
          <li>ce_access drží přihlášení. Je HttpOnly, SameSite Lax a na https má příznak Secure. Platnost bere z přihlášení, jinak jedna hodina.</li>
          <li>ce_refresh drží obnovu přihlášení. Stejné příznaky, platnost 30 dní.</li>
          <li>ce_pkce kód umí smazat. Běžné přihlášení ho nenastavuje.</li>
        </ul>
        <h3>Jen v prohlížeči</h3>
        <ul>
          <li>Poloha zvolená pro vzdálenost zůstává v tomto prohlížeči, dokud ji nevypneš nebo nesmažeš data stránek.</li>
          <li>Oblíbené podniky bez přihlášení zůstávají v tomto prohlížeči.</li>
          <li>Porovnání podniků zůstává jen do zavření panelu.</li>
          <li>Návrat po změně hesla zůstává jen do zavření panelu.</li>
        </ul>
        <h3>Analytické</h3>
        <p>Žádné.</p>
        <h3>Marketingové</h3>
        <p>Žádné. Reklamní měření se nespouští.</p>
      </section>

      <section>
        <h2>Co v účtu uděláš sám</h2>
        <ul>
          <li>Po přihlášení vidíš oblíbené a můžeš je odebrat.</li>
          <li>Vlastní recenzi upravíš nebo smažeš. Cizí recenzi můžeš nahlásit.</li>
          <li>Stažení všech údajů v jednom souboru aplikace neumí.</li>
          <li>
            Smazání celého účtu tlačítkem aplikace neumí. Když se účet smaže ve přihlašovací službě,
            navázaný profil, oblíbené, recenze a hlášení mají v databázi kaskádu. Samo se to z webu
            nespustí a e-mail žádosti o výmaz tu není.
          </li>
        </ul>
      </section>

      <OperatorSlot title="Jak uplatnit práva">
        <p>
          Přístup, oprava, výmaz, omezení, námitka a stížnost u dozorového úřadu nemají zveřejněný
          kontakt. Dokud provozovatel nedoplní způsob spojení, web tuhle žádost nepřijme a výmaz
          nepředstírá.
        </p>
      </OperatorSlot>

      <p className="page-subtitle">
        <Link to="/obchodni-podminky">Obchodní podmínky</Link>
        {' · '}
        <Link to="/">Zpět na úvod</Link>
      </p>
    </main>
  )
}
