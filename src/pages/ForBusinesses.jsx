import { useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessApplicationForm from '../components/BusinessApplicationForm'
import BusinessPlanCards from '../components/BusinessPlanCards'
import PromotionInquiryForm from '../components/PromotionInquiryForm'
import { operatorIsComplete, presentPrice } from '../constants/operator'
import { PROMOTION_MONTHLY_PRICES } from '../constants/promotionPrice'
import { PUBLIC_V1 } from '../constants/publicV1'

export default function ForBusinesses() {
  const [mode, setMode] = useState('')
  const [planId, setPlanId] = useState('plus')
  const vat = presentPrice(PROMOTION_MONTHLY_PRICES.plus)
  const operatorReady = operatorIsComplete()
  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">Pro podniky</p>
        <h1>Propagujte svůj podnik</h1>
        <p className="biz-lead">
          Placené zvýraznění v katalogu FoodGo. Hledání restaurací pro návštěvníky zůstává zdarma.
        </p>
        <p className="biz-note">
          Online platba není zapojená. Tlačítko nezakládá nákup, nestrhává peníze a reklamu nezapne.
          Jde o nezávaznou poptávku. Návštěvnost, prokliky ani tržby negarantujeme.
        </p>
        {!operatorReady ? (
          <p className="biz-note" role="status">
            Identita provozovatele a daňový režim ještě nejsou doplněné. Ceník není ostrý prodej.
            Obchodní podmínky a ochrana osobních údajů zůstávají kostrou k právní kontrole.
          </p>
        ) : null}
      </section>

      <section className="biz-section" id="balicky" aria-labelledby="biz-plans-title">
        <h2 id="biz-plans-title">Balíčky propagace</h2>
        <p className="section-desc">
          Ceny jsou v Kč a drží je konfigurace projektu. Měsíční období trvá 30 dní, roční 12 měsíců.
          Obě varianty jsou jednorázová platba a samy se neobnovují. Placený výsledek nese označení
          Sponzorováno a nemění hodnocení. {vat.vatNote}
        </p>
        <div className="biz-compare-wrap">
          <table className="biz-compare">
            <caption>Srovnání balíčků. Není to slib výsledků.</caption>
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col">Start</th>
                <th scope="col">Plus</th>
                <th scope="col">Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Cena za 30 dní</th>
                <td>{PROMOTION_MONTHLY_PRICES.start} Kč</td>
                <td>{PROMOTION_MONTHLY_PRICES.plus} Kč</td>
                <td>{PROMOTION_MONTHLY_PRICES.premium} Kč</td>
              </tr>
              <tr>
                <th scope="row">Obnovení</th>
                <td>Ne</td>
                <td>Ne</td>
                <td>Ne</td>
              </tr>
              <tr>
                <th scope="row">Označení</th>
                <td>Sponzorováno</td>
                <td>Sponzorováno</td>
                <td>Sponzorováno</td>
              </tr>
              <tr>
                <th scope="row">Prezentace</th>
                <td>Základní zvýraznění</td>
                <td>Výraznější karta a delší text</td>
                <td>Přednost v reklamním bloku</td>
              </tr>
            </tbody>
          </table>
        </div>
        <BusinessPlanCards
          onStart={(nextPlan) => {
            setPlanId(nextPlan)
            setMode('paid')
          }}
        />
        <p className="biz-note">
          Účet podniku a stav poptávky:{' '}
          <Link to="/pro-podniky/ucet">Správa podniku</Link>
          {' · '}
          <Link to="/obchodni-podminky">Návrh obchodních podmínek</Link>
        </p>
      </section>

      {mode === 'paid' ? (
        <PromotionInquiryForm planId={planId} onClose={() => setMode('')} />
      ) : null}

      <section className="biz-section biz-how" id="zapis">
        <h2>Neplacený zápis v katalogu</h2>
        <ol>
          <li>Vyplníš název, adresu a kontakt.</li>
          <li>Žádost se sama nezveřejní — nejdřív ji zkontrolujeme.</li>
          <li>Hledání zůstává zdarma pro návštěvníky i po zveřejnění.</li>
        </ol>
        <p>
          Text{' '}
          <Link to="/obchodni-podminky">obchodních podmínek</Link> a{' '}
          <Link to="/ochrana-osobnich-udaju">ochrany osobních údajů</Link> je připravený k právní kontrole.
        </p>
        {PUBLIC_V1.freeBusinessApplication ? (
          mode === 'catalog' ? (
            <BusinessApplicationForm onClose={() => setMode('')} />
          ) : (
            <button type="button" className="btn" onClick={() => setMode('catalog')}>
              Požádat o neplacený zápis
            </button>
          )
        ) : (
          <p className="deal-warning" role="status">
            Příjem žádostí o zápis je dočasně vypnutý.
          </p>
        )}
      </section>
    </main>
  )
}
