import { useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessApplicationForm from '../components/BusinessApplicationForm'
import BusinessPlanCards from '../components/BusinessPlanCards'
import PromotionInquiryForm from '../components/PromotionInquiryForm'
import { presentPrice } from '../constants/operator'
import { PROMOTION_MONTHLY_PRICES } from '../constants/promotionPrice'
import { PUBLIC_V1 } from '../constants/publicV1'

export default function ForBusinesses() {
  const [mode, setMode] = useState('')
  const [planId, setPlanId] = useState('plus')
  const vat = presentPrice(PROMOTION_MONTHLY_PRICES.plus)
  const priceNote =
    vat.vatStatus === 'unconfirmed'
      ? 'Uvedené ceny jsou ceníkové. Konečná částka na faktuře se upřesní, než cokoli zaplatíte. Teď se nic nestrhává.'
      : vat.vatNote
  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">Pro podniky · Brno</p>
        <h1>Buďte vidět, když lidé hledají, kde se najíst</h1>
        <p className="biz-lead">
          FoodGo je katalog restaurací, kaváren a rychlého občerstvení v Brně. Návštěvníci hledají podle
          chuti, ceny a vzdálenosti. Placené zvýraznění ukáže podnik ve zvláštním bloku s označením
          Sponzorováno.
        </p>
        <ul className="biz-points">
          <li>Hledání pro návštěvníky zůstává zdarma.</li>
          <li>Běžný zápis do katalogu jde požádat zvlášť a bez poplatku.</li>
          <li>Propagace se zapne až po domluvě. Teď posíláte jen nezávaznou poptávku.</li>
        </ul>
      </section>

      <section className="biz-section" id="balicky" aria-labelledby="biz-plans-title">
        <h2 id="biz-plans-title">Balíčky propagace</h2>
        <p className="section-desc">
          Ceny jsou v korunách. Měsíční období trvá 30 dní, roční 12 měsíců. Obě varianty se platí
          jednorázově a samy se neobnovují. Placené umístění nemění hodnocení. {priceNote}
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
                <td data-label="Start">{PROMOTION_MONTHLY_PRICES.start} Kč</td>
                <td data-label="Plus">{PROMOTION_MONTHLY_PRICES.plus} Kč</td>
                <td data-label="Premium">{PROMOTION_MONTHLY_PRICES.premium} Kč</td>
              </tr>
              <tr>
                <th scope="row">Obnovení</th>
                <td data-label="Start">Ne</td>
                <td data-label="Plus">Ne</td>
                <td data-label="Premium">Ne</td>
              </tr>
              <tr>
                <th scope="row">Označení</th>
                <td data-label="Start">Sponzorováno</td>
                <td data-label="Plus">Sponzorováno</td>
                <td data-label="Premium">Sponzorováno</td>
              </tr>
              <tr>
                <th scope="row">Prezentace</th>
                <td data-label="Start">Základní zvýraznění</td>
                <td data-label="Plus">Výraznější karta a delší text</td>
                <td data-label="Premium">Přednost v reklamním bloku</td>
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
          <Link to="/obchodni-podminky">Obchodní podmínky</Link>
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
