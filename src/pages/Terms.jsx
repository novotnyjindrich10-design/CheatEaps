import { Link } from 'react-router-dom'
import OperatorSlot from '../components/OperatorSlot'

export default function Terms() {
  return (
    <main className="page legal-page">
      <h1>Obchodní podmínky</h1>
      <p className="deal-warning" role="status">
        Tohle nejsou platné obchodní podmínky. Je to kostra stránky. Než podle nich někdo jedná, musí provozovatel
        doplnit označené části a nechat si text zkontrolovat.
      </p>

      <OperatorSlot title="Kdo službu provozuje">
        <p>Sem patří název nebo jméno, adresa, případně IČO a kontakt. Aplikace je sama nedoplňuje.</p>
      </OperatorSlot>

      <section>
        <h2>Co web dnes dělá</h2>
        <p>Tenhle odstavec jen popisuje současné chování aplikace. Není to smluvní slib.</p>
        <ul>
          <li>CheapEats ukazuje podniky s jídlem v Brně a umí je filtrovat.</li>
          <li>Cena, web a další údaje jsou jen tam, kde je k nim zdroj. Chybějící údaj se nedoplňuje odhadem jako fakt.</li>
          <li>Účet slouží k oblíbeným, recenzím a k detailu slev, které už v katalogu jsou.</li>
          <li>Recenze je vidět ostatním až po schválení administrátorem. Body se připíšou až tím schválením.</li>
          <li>Odměny za body zůstávají vypnuté, dokud k nim nejsou skutečné slevové kódy.</li>
          <li>Žádost podniku se nezveřejní sama. Platba z webu se nestrhává.</li>
        </ul>
      </section>

      <OperatorSlot title="Účet a věk">
        <p>Sem patří, kdo si smí účet založit, jak se ruší a co se stane s recenzemi a body.</p>
      </OperatorSlot>

      <OperatorSlot title="Ceny, otevírací doba a cizí nabídky">
        <p>
          Sem patří, za co CheapEats neodpovídá: jídelní lístek, provoz restaurace a slevy třetích stran. Konkrétní
          omezení odpovědnosti doplní provozovatel.
        </p>
      </OperatorSlot>

      <OperatorSlot title="Podniky a propagace">
        <p>
          Sem patří, jestli je žádost objednávka, kdy začíná propagace a že se z téhle stránky samo nic neúčtuje.
          Ceník v aplikaci není smlouva.
        </p>
      </OperatorSlot>

      <OperatorSlot title="Změny podmínek a rozhodné právo">
        <p>Sem patří postup změny textu, rozhodné právo a příslušný soud nebo jiný způsob řešení sporů.</p>
      </OperatorSlot>

      <p className="page-subtitle">
        <Link to="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link>
        {' · '}
        <Link to="/">Zpět na úvod</Link>
      </p>
    </main>
  )
}
