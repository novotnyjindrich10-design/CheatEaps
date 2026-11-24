import { BUSINESS_PLANS, formatKc, quotePlan } from '../constants/businessPlans'

export default function BusinessPlanCards({ onStart }) {
  return (
    <div className="biz-plans" role="list">
      {BUSINESS_PLANS.map((plan) => {
        const monthly = quotePlan(plan, 'mesicne')
        const yearly = quotePlan(plan, 'rocne')
        return (
          <article
            key={plan.id}
            className={`biz-plan is-active${plan.recommended ? ' is-recommended' : ''}`}
            role="listitem"
          >
            <header className="biz-plan-head">
              <h3>{plan.name.toUpperCase()}</h3>
              {plan.recommended ? <p className="biz-plan-badge">Širší rozsah</p> : null}
            </header>
            <p className="biz-plan-price">
              <span>{formatKc(monthly.amount)}/měsíc</span>
            </p>
            <p className="biz-plan-soon">
              nebo {formatKc(yearly.amount)} za {yearly.serviceLabel}
            </p>
            <p className="biz-plan-summary">
              {monthly.billingLabel}. {monthly.renewalLabel}. Délka měsíční varianty je {monthly.serviceLabel}.
            </p>
            <p className="biz-plan-summary">{plan.summary}</p>
            <ul className="biz-plan-limits">
              <li>Popis až {plan.descriptionMax.toLocaleString('cs-CZ')} znaků</li>
              <li>
                Až {plan.photoMax}{' '}
                {plan.photoMax === 1 ? 'fotografie' : plan.photoMax < 5 ? 'fotografie' : 'fotografií'} po přijetí poptávky
              </li>
            </ul>
            <ul className="biz-plan-perks">
              {plan.perks.map((perk) => (
                <li key={perk.title}>
                  <strong>{perk.title}</strong>
                  <span>{perk.detail}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary biz-plan-cta" onClick={() => onStart?.(plan.id)}>
              Nezávazná poptávka
            </button>
          </article>
        )
      })}
    </div>
  )
}
