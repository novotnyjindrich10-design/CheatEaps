import { BUSINESS_PLANS, formatKc } from '../constants/businessPlans'
import { canStartPlan, lockedPlans } from '../utils/businessApplication'

export default function BusinessPlanCards({ onStart }) {
  const locks = lockedPlans()

  return (
    <div className="biz-plans" role="list">
      {BUSINESS_PLANS.map((plan) => {
        const lock = locks[plan.id]
        const locked = Boolean(lock?.locked)
        const active = canStartPlan(plan.id)
        return (
          <article
            key={plan.id}
            className={`biz-plan${locked ? ' is-locked' : ''}${active ? ' is-active' : ''}${plan.recommended ? ' is-recommended' : ''}`}
            role="listitem"
            aria-disabled={locked || undefined}
          >
            <header className="biz-plan-head">
              <h3>
                {plan.name.toUpperCase()}
                {locked ? (
                  <span className="biz-lock" aria-label="Zamčeno" title="Zamčeno">
                    🔒
                  </span>
                ) : null}
              </h3>
              {plan.recommended && !locked ? <p className="biz-plan-badge">Nejčastější volba</p> : null}
              {locked ? <p className="biz-plan-soon">Již brzy</p> : null}
            </header>
            <p className="biz-plan-price">
              <span className="biz-price-old">{formatKc(plan.monthlyPrice)}/měsíc</span>
              <span className="biz-price-free">FREE</span>
            </p>
            <p className="biz-plan-summary">{plan.summary}</p>
            <ul className="biz-plan-limits">
              <li>Popis až {plan.descriptionMax.toLocaleString('cs-CZ')} znaků</li>
              <li>
                Až {plan.photoMax}{' '}
                {plan.photoMax === 1 ? 'fotografie' : plan.photoMax < 5 ? 'fotografie' : 'fotografií'}
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
            {active ? (
              <button type="button" className="btn btn-primary biz-plan-cta" onClick={() => onStart?.(plan.id)}>
                START – FREE
              </button>
            ) : (
              <button type="button" className="btn biz-plan-cta is-disabled" disabled>
                Již brzy
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}
