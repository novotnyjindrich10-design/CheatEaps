import { Link } from 'react-router-dom'
import OperatorSlot from '../components/OperatorSlot'

export default function Privacy() {
  return (
    <main className="page legal-page">
      <h1>Zásady ochrany osobních údajů</h1>
      <p className="deal-warning" role="status">
        Tohle není platný právní text. Je to kostra stránky. Než se na ni odkáže jako na informace o
        zpracování údajů, musí provozovatel doplnit označené části a nechat si text zkontrolovat.
      </p>

      <OperatorSlot title="Kdo je správce">
        <p>Sem patří název nebo jméno, adresa, případně IČO a kontaktní e-mail správce. Aplikace je sama nedoplňuje.</p>
      </OperatorSlot>

      <section>
        <h2>Co aplikace umí uložit</h2>
        <p>
          Následující seznam je technický přehled z kódu. Není to právní slib. Provozovatel ho musí potvrdit,
          opravit, nebo z něj vyškrtnout položky, které se ve skutečnosti nezpracovávají.
        </p>
        <ul>
          <li>Účet: e-mail a heslo přes přihlašovací službu. Heslo v odpovědi aplikace nevrací.</li>
          <li>Volitelná přezdívka u recenze. Do recenze se e-mail neukládá.</li>
          <li>Oblíbené restaurace vázané na účet.</li>
          <li>Text a hodnocení recenze. Veřejně se ukáže až po schválení administrátorem.</li>
          <li>Žádost podniku: název, adresa, e-mail, popis a web, pokud je vyplněný.</li>
          <li>Po zapnutí věrnosti: stav bodů, historie pohybů a uplatněný slevový kód. Odměny se nezapnou bez skutečných kódů.</li>
        </ul>
        <p>Poloha pro vzdálenost zůstává v prohlížeči. Na server CheapEats se neposílá.</p>
      </section>

      <OperatorSlot title="Proč se údaje zpracovávají a na jakém základě">
        <p>Sem patří účely a právní základy. Aplikace je nevymýšlí.</p>
      </OperatorSlot>

      <OperatorSlot title="Komu údaje odcházejí">
        <p>
          Sem patří hosting, databáze, odesílání e-mailů a další zpracovatelé, včetně toho, jestli jsou mimo EU.
          Kód umí mluvit s databází účtů a s e-mailovou službou, jen když jsou na serveru nastavené. To samo o sobě
          není seznam zpracovatelů.
        </p>
      </OperatorSlot>

      <OperatorSlot title="Jak dlouho údaje zůstanou">
        <p>Sem patří doby uložení účtu, recenzí, žádostí a e-mailů.</p>
      </OperatorSlot>

      <OperatorSlot title="Jak uplatnit práva">
        <p>
          Sem patří postup pro přístup, opravu, výmaz, omezení, námitku a stížnost u dozorového úřadu, včetně
          kontaktu, kam se člověk obrátí.
        </p>
      </OperatorSlot>

      <OperatorSlot title="Cookies a podobné údaje">
        <p>
          Přihlášení používá technické cookies relace. Sem patří jejich výčet, doba platnosti a to, jestli jde jen o
          cookies nutné k účtu. Právní formulaci doplní provozovatel.
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
