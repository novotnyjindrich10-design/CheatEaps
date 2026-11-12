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
  const paidUi = PUBLIC_V1.paidPromotionUi

  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">Pro podniky</p>
        <h1>Rozjeď svůj podnik na FoodGo</h1>
        <p className="biz-lead">Dostaň svou restauraci mezi lidi, kteří hledají, kde se dobře najíst.</p>
        <p className="biz-note">
          Hledání restaurací zůstává zdarma. Veřejná verze teď přijímá hlavně žádost o neplacený zápis
          do katalogu. Online platba není zapojená.
        </p>
        {!operatorReady ? (
          <p className="biz-note" role="status">
            Identita provozovatele a daňový režim ještě nejsou doplněné. Ceník není ostrý prodej.
            Obchodní podmínky a ochrana osobních údajů zůstávají kostrou k právní kontrole.
          </p>
        ) : null}
      </section>

      {paidUi ? (
        <section className="biz-section" aria-labelledby="biz-plans-title">
          <h2 id="biz-plans-title">Placené balíčky</h2>
          <p className="section-desc">
            Ceny jsou v Kč podle ceníku v projektu. Měsíční balíček platí 30 dní, roční 12 měsíců.
            Obě varianty jsou jednorázová platba a samy se neobnovují. {vat.vatNote}
          </p>
          <BusinessPlanCards
            onStart={(nextPlan) => {
              setPlanId(nextPlan)
              setMode('paid')
            }}
          />
        </section>
      ) : (
        <section className="biz-section" aria-labelledby="biz-plans-title">
          <h2 id="biz-plans-title">Placené umístění</h2>
          <p className="section-desc" role="status">
            Placená propagace (Sponzorováno) zatím není ve veřejné verzi spuštěná. Až bude připravená
            identita provozovatele, fakturace a odesílání e-mailů, otevřeme nezávaznou poptávku.
            Teď můžeš požádat o běžný neplacený zápis.
          </p>
        </section>
      )}

      {paidUi && mode === 'paid' ? (
        <PromotionInquiryForm planId={planId} onClose={() => setMode('')} />
      ) : null}

      <section className="biz-section biz-how">
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
