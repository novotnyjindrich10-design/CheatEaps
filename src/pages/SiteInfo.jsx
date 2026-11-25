import { Link } from 'react-router-dom'
import { BRAND_CITY, CONTACT_EMAIL } from '../constants/brand'
import { OPERATOR, operatorAddress, operatorIsComplete } from '../constants/operator'
import OperatorSlot from '../components/OperatorSlot'

const PAGES = {
  about: {
    kicker: 'O projektu',
    title: 'O FoodGo',
    lead: 'FoodGo Brno je katalog podniků s jídlem. Hledáš podle chuti, rozpočtu a vzdálenosti. Ověřené údaje oddělujeme od odhadů.',
  },
  contact: {
    kicker: 'Kontakt',
    title: 'Kontakt',
    lead: 'Napiš na e-mail značky. Provozní identitu a sídlo doplní provozovatel, až budou ověřené.',
  },
  cookies: {
    kicker: 'Cookies',
    title: 'Informace o cookies a úložišti',
    lead: 'FoodGo nepoužívá reklamní ani analytické cookies třetích stran. Některá data zůstávají jen v tvém prohlížeči.',
  },
  ads: {
    kicker: 'Reklama',
    title: 'Reklamní zvýraznění',
    lead: 'Placené umístění je označené textem Sponzorováno. Neovlivňuje hodnocení ani cenu podniku a neobchází tvé filtry.',
  },
}

export default function SiteInfo({ kind = 'about' }) {
  const page = PAGES[kind] || PAGES.about
  const ready = operatorIsComplete()

  return (
    <main className="page legal-page">
      <p className="biz-kicker">{page.kicker}</p>
      <h1>{page.title}</h1>
      <p className="section-desc">{page.lead}</p>

      {kind === 'about' ? (
        <>
          <section className="biz-section" aria-labelledby="about-what">
            <h2 id="about-what">Co FoodGo umí</h2>
            <ul>
              <li>Katalog stovek podniků v Brně s filtry a mapou.</li>
              <li>Oddělení ověřených cen od odhadů, kde to data dovolí.</li>
              <li>Účet pro oblíbené a recenze, když je databáze dostupná.</li>
              <li>Pro podniky: nezávazná poptávka propagace a žádost o zápis.</li>
            </ul>
          </section>
          <section className="biz-section" aria-labelledby="about-not">
            <h2 id="about-not">Co FoodGo neslibuje</h2>
            <ul>
              <li>Neslibujeme počet zákazníků ani návratnost reklamy.</li>
              <li>Nejsme rozvozová služba ani rezervace stolů.</li>
              <li>Obchodní podmínky a ochrana osobních údajů ještě nejsou právně schválené.</li>
            </ul>
          </section>
          <p>
            <Link to="/results">Najít podnik</Link>
            {' · '}
            <Link to="/pro-podniky">Pro podniky</Link>
            {' · '}
            <Link to="/kontakt">Kontakt</Link>
          </p>
        </>
      ) : null}

      {kind === 'contact' ? (
        <>
          <section className="biz-section" aria-labelledby="contact-mail">
            <h2 id="contact-mail">E-mail</h2>
            <p>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
            <p className="section-desc">
              Pro nahlášení chyby u podniku použij formulář na detailu restaurace. Pro propagaci stránku{' '}
              <Link to="/pro-podniky">Pro podniky</Link>.
            </p>
          </section>
          <OperatorSlot title="Provozovatel">
            {ready ? (
              <ul>
                <li>{OPERATOR.legalName}</li>
                <li>IČO: {OPERATOR.ico}</li>
                {OPERATOR.dic ? <li>DIČ: {OPERATOR.dic}</li> : null}
                <li>{operatorAddress()}</li>
                <li>
                  <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
                </li>
              </ul>
            ) : (
              <p>
                Jméno, adresa a IČO provozovatele tu zatím nejsou. Doplní je provozovatel, až budou ověřené.
              </p>
            )}
          </OperatorSlot>
        </>
      ) : null}

      {kind === 'cookies' ? (
        <section className="biz-section" aria-labelledby="cookies-list">
          <h2 id="cookies-list">Co ukládáme v prohlížeči</h2>
          <ul>
            <li>HttpOnly cookies přihlášení (ce_access / ce_refresh), když se přihlásíš.</li>
            <li>localStorage pro polohu a hostovské oblíbené — zůstává u tebe, dokud data nesmažeš.</li>
            <li>sessionStorage pro porovnání podniků a návrat po změně hesla.</li>
            <li>Žádný Google Analytics, Meta Pixel ani podobný sledovací skript v aplikaci není.</li>
          </ul>
          <p className="section-desc">
            Podrobnosti zpracování účtu a recenzí jsou v{' '}
            <Link to="/ochrana-osobnich-udaju">ochraně osobních údajů</Link>. Text ještě není právně schválený.
          </p>
        </section>
      ) : null}

      {kind === 'ads' ? (
        <section className="biz-section" aria-labelledby="ads-rules">
          <h2 id="ads-rules">Jak funguje placené zvýraznění</h2>
          <ul>
            <li>Aktivní propagace má viditelný štítek „Sponzorováno“.</li>
            <li>Zobrazí se jen po ověřené úhradě a zapnutí v administraci, v platném časovém okně.</li>
            <li>Nezaplacená poptávka reklamu nezapne. Testovací platba nesmí aktivovat produkční propagaci.</li>
            <li>Reklama nefalšuje hodnocení ani cenu a neobchází nastavené filtry.</li>
            <li>Balíčky Start / Plus / Premium jsou jednorázové (typicky 30 dní). Automatické předplatné není.</li>
          </ul>
          <p>
            <Link to="/pro-podniky">Poptávka propagace</Link>
            {' · '}
            <Link to="/pro-podniky/ucet">Stav poptávky</Link>
          </p>
        </section>
      ) : null}

      <p className="section-desc" style={{ marginTop: '2rem' }}>
        {BRAND_CITY}. Texty na této stránce nejsou právní posudek.
      </p>
    </main>
  )
}
