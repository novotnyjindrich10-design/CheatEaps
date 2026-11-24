import { Link } from 'react-router-dom'
import LegalMissing from '../components/LegalMissing'
import OperatorSlot from '../components/OperatorSlot'
import { BUSINESS_PLANS, formatKc, yearlyPrice } from '../constants/businessPlans'
import { operatorAddress, operatorIsComplete, OPERATOR, presentPrice } from '../constants/operator'

export default function Terms() {
  return (
    <main className="page legal-page">
      <h1>Obchodní podmínky</h1>
      <p className="deal-warning" role="status">
        Tohle nejsou platné obchodní podmínky a nejsou právně schválené. Popisují současné chování
        aplikace. Části označené „Doplní provozovatel“ nejsou hotový smluvní údaj.
      </p>

      <LegalMissing />

      <OperatorSlot title="Kdo službu provozuje">
        {operatorIsComplete() ? (
          <p>
            {OPERATOR.legalName}, IČO {OPERATOR.ico}
            {OPERATOR.dic ? `, DIČ ${OPERATOR.dic}` : ''}. Sídlo: {operatorAddress()}. Kontakt: {OPERATOR.email}.
          </p>
        ) : (
          <p>
            Provozovatelem má být živnost, pod kterou se projekt vede. Jméno, IČO, sídlo, DIČ a
            kontaktní e-mail v konfiguraci nejsou. Aplikace je nedoplňuje. Dokud tam nejsou, nejde
            podle tohoto textu uzavřít smlouvu.
          </p>
        )}
      </OperatorSlot>

      <section>
        <h2>Co web dnes dělá</h2>
        <p>Tenhle odstavec jen popisuje současné chování aplikace. Není to smluvní slib.</p>
        <ul>
          <li>FoodGo ukazuje podniky s jídlem v Brně a umí je filtrovat.</li>
          <li>Cena, web a další údaje jsou jen tam, kde je k nim zdroj. Chybějící údaj se nedoplňuje odhadem jako fakt.</li>
          <li>Účet slouží k oblíbeným, recenzím a k detailu slev, které už v katalogu jsou.</li>
          <li>Recenze je vidět ostatním až po schválení administrátorem. Vlastní recenzi můžeš smazat, cizí nahlásit.</li>
          <li>Odměny za body zůstávají vypnuté, dokud k nim nejsou skutečné slevové kódy.</li>
          <li>Žádost o neplacený zápis v katalogu se sama nezveřejní a platbu nestrhne.</li>
          <li>Dobrovolná podpora na stránce Podpoř mě platbu nespouští, dokud nejsou ověřené platební údaje. Za příspěvek není protislužba.</li>
          <li>Placené umístění, pokud běží, má označení Sponzorováno a je mimo organická doporučení. Není to hodnocení návštěvníků.</li>
        </ul>
      </section>

      <OperatorSlot title="Účet a věk">
        <p>
          Kdo si smí účet založit, tu není rozhodnuto. Zrušení účtu tlačítkem web neumí. Oblíbené jde
          odebrat a vlastní recenzi smazat. Výmaz celého účtu se sám nespouští.
        </p>
      </OperatorSlot>

      <section>
        <h2>Ceny, otevírací doba a cizí nabídky</h2>
        <ul>
          <li>Ověřená cena má zdroj v menu. Odhad je označený jako odhad a do limitu rozpočtu se nepočítá.</li>
          <li>Otevírací doba a telefon, pokud jsou, pocházejí z mapových dat. Web z nich neodvozuje, jestli je podnik otevřený.</li>
          <li>Slevy třetích stran, včetně ISIC, nejsou voucher FoodGo. Podmínky určuje jejich poskytovatel. Přihlášení nenahrazuje průkaz.</li>
        </ul>
      </section>

      <OperatorSlot title="Za co FoodGo neodpovídá">
        <p>
          Rozsah odpovědnosti za jídelní lístek, provoz restaurace a nabídky třetích stran tu není.
          Doplní ho provozovatel.
        </p>
      </OperatorSlot>

      <section>
        <h2>Placené služby pro podniky</h2>
        <p className="deal-warning" role="status">
          Ve veřejné free verzi není placená propagace spuštěná jako hotová služba. Online platba
          neběží. Níže je popis připraveného ceníku v kódu, ne ostrý prodej.
        </p>
        <p>
          Tahle část popisuje nabídku v aplikaci. Není to hotová smlouva, dokud ji provozovatel a
          právní kontrola nepotvrdí. Hledání restaurací zůstává zdarma a je oddělené od reklamy.
        </p>
        <ul>
          {BUSINESS_PLANS.map((plan) => {
            const monthly = presentPrice(plan.monthlyPrice)
            const yearly = yearlyPrice(plan.monthlyPrice)
            return (
              <li key={plan.id}>
                {plan.name}: ceníková částka {formatKc(plan.monthlyPrice)} za 30 dní, nebo {formatKc(yearly)} za 12 měsíců.
                {' '}
                {monthly.finalAmount == null ? monthly.vatNote : `Konečná částka měsíční varianty je ${formatKc(monthly.finalAmount)}. ${monthly.vatNote}`}
              </li>
            )
          })}
          <li>Obě délky jsou jednorázová platba. Služba se sama neobnovuje. Není co vypínat, dokud obnovení nebude později samostatně zapnuté a schválené.</li>
          <li>Web negarantuje návštěvnost, počet prokliků ani tržby podniku. Placené umístění není hodnocení a nemění pořadí „Nejblíž ke mně“.</li>
          <li>Z webu teď nejde zaplatit kartou. Poptávka úhradu nestrhne. Fakturu a zapnutí reklamy řeší provozovatel po ověření platby.</li>
          <li>Reklama má začátek a konec. Po konci zvýraznění skončí samo. Podnik v běžném katalogu tím nemizí.</li>
          <li>Smlouva vznikne až potvrzením poptávky provozovatelem, ne odesláním formuláře.</li>
        </ul>
        <h3>Reklamace</h3>
        <p>
          Reklamaci placené propagace má podnik poslat na kontakt provozovatele, až bude zveřejněný.
          Web reklamaci sám nevyřídí. Lhůtu a postup musí ještě potvrdit právní kontrola. Do té doby
          je to pracovní postup, ne hotové smluvní ujednání.
        </p>
        <h3>Ukončení spolupráce</h3>
        <p>
          Umístění skončí uplynutím doby. Provozovatel ho může ukončit dřív, když úhrada není ověřená
          nebo po dohodě s podnikem. Vrácení peněz web samo neprovádí. Podmínky vratky doplní
          provozovatel před první fakturou.
        </p>
      </section>

      <OperatorSlot title="Změny podmínek a rozhodné právo">
        <p>Postup změny textu, rozhodné právo a způsob řešení sporů tu nejsou. Doplní je provozovatel.</p>
      </OperatorSlot>

      <p className="page-subtitle">
        <Link to="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link>
        {' · '}
        <Link to="/">Zpět na úvod</Link>
      </p>
    </main>
  )
}