import { useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessApplicationForm from '../components/BusinessApplicationForm'
import BusinessPlanCards from '../components/BusinessPlanCards'
import PromotionInquiryForm from '../components/PromotionInquiryForm'
import { operatorIsComplete, presentPrice } from '../constants/operator'
import { PROMOTION_MONTHLY_PRICES } from '../constants/promotionPrice'

export default function ForBusinesses() {
  const [mode, setMode] = useState('')
  const [planId, setPlanId] = useState('plus')
  const vat = presentPrice(PROMOTION_MONTHLY_PRICES.plus)
  const operatorReady = operatorIsComplete()

  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">Pro podniky</p>
        <h1>Rozjeď svůj podnik na FoodGo</h1>
        <p className="biz-lead">Dostaň svou restauraci mezi lidi, kteří hledají, kde se dobře najíst.</p>
        <p className="biz-note">
          Hledání restaurací zůstává zdarma. Placený balíček je reklamní umístění s označením
          Sponzorováno. Online platba není zapojená, takže z této stránky jde poslat nezávaznou poptávku.
        </p>
        {!operatorReady ? (
          <p className="biz-note" role="status">
            Identita provozovatele a daňový režim ještě nejsou doplněné. Ceník je orientační a není
            ostrý prodej. Obchodní podmínky a ochrana osobních údajů zůstávají kostrou k právní kontrole.
          </p>
        ) : null}
      </section>

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

      {mode === 'paid' ? (
        <PromotionInquiryForm planId={planId} onClose={() => setMode('')} />
      ) : null}

      <section className="biz-section biz-how">
        <h2>Jak poptávka probíhá</h2>
        <ol>
          <li>Vybereš balíček a délku, měsíční nebo roční.</li>
          <li>Vybereš podnik z katalogu, nebo napíšeš název, pokud v něm ještě není.</li>
          <li>Doplníš firmu, kontakt a fakturační adresu.</li>
          <li>Uvidíš cenu, délku a to, že platba se sama nestrhává.</li>
          <li>Odešleš nezávaznou poptávku a dostaneš potvrzení.</li>
          <li>Po dohodě přijde faktura. Reklama se zapne až po ověření úhrady.</li>
        </ol>
        <p>
          Běžný zápis v katalogu je zvlášť a nic nestojí. Text{' '}
          <Link to="/obchodni-podminky">obchodních podmínek</Link> a{' '}
          <Link to="/ochrana-osobnich-udaju">ochrany osobních údajů</Link> je připravený k právní kontrole.
        </p>
        {mode === 'catalog' ? (
          <BusinessApplicationForm onClose={() => setMode('')} />
        ) : (
          <button type="button" className="btn" onClick={() => setMode('catalog')}>
            Požádat o neplacený zápis
          </button>
        )}
      </section>
    </main>
  )
}
