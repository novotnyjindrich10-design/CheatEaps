import { useSearchParams } from 'react-router-dom'
import BusinessInquiry from '../components/BusinessInquiry'
import {
  BUSINESS_PLANS,
  SETUP_TIME,
  findBusinessPlan,
  formatKc,
  quotePlan,
  resolvePeriod,
} from '../constants/businessPlans'

const STEPS = [
  {
    title: 'Vybereš si způsob propagace',
    text: 'Porovnáš měsíční a roční cenu tří balíčků a vybereš tu, která dává smysl pro tvůj podnik.',
  },
  {
    title: 'Pošleš nám informace o svém podniku',
    text: 'Ve formuláři doplníš kontakt a podklady. Odejde nezávazná žádost o první měsíc zdarma. Platba se nestrhává.',
  },
  {
    title: 'Domluvíme podrobnosti a připravíme propagaci',
    text: 'Než se na webu něco změní, sladíme text, fotku a rozsah. Nic se nespustí automaticky.',
  },
]

const REASONS = [
  {
    title: 'Lidé tu hledají, kam zajít',
    text: 'CheapEats je seznam podniků v Brně. Návštěvník filtruje podle kuchyně, ceny a vzdálenosti.',
  },
  {
    title: SETUP_TIME.title,
    text: SETUP_TIME.text,
    note: SETUP_TIME.note,
    emphasis: true,
  },
  {
    title: 'Propagace je domluva',
    text: 'Balíček není samoobslužná kampaň. Nejdřív si řekneme, co jde na webu opravdu ukázat.',
  },
]

function scrollToId(id) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export default function ForBusiness() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = findBusinessPlan(searchParams.get('balicek'))?.id ?? 'plus'
  const period = resolvePeriod(searchParams.get('obdobi'))

  const setSelection = ({ plan = selected, period: nextPeriod = period, scroll = false }) => {
    const next = new URLSearchParams(searchParams)
    next.set('balicek', plan)
    next.set('obdobi', nextPeriod)
    setSearchParams(next, { replace: true })
    if (scroll) window.setTimeout(() => scrollToId('poptavka'), 0)
  }

  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">CheapEats Brno pro podniky</p>
        <h1>Dostaň svůj podnik na oči lidem, kteří hledají, kam zajít na jídlo.</h1>
        <p className="biz-lead">
          Zviditelni svou restauraci na CheapEats Brno. Oslov lidi, kteří hledají nové podniky,
          vybírají podle ceny a chtějí objevit něco dobrého.
        </p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => scrollToId('cenik')}>
          Vybrat propagaci
        </button>
      </section>

      <section id="cenik" className="biz-section" aria-labelledby="cenik-title">
        <div className="biz-section-head">
          <h2 id="cenik-title">Návrh ceníku</h2>
          <p>
            První měsíc propagace lze požádat zdarma. Potom platí měsíční cena balíčku: Start 99 Kč,
            Plus 199 Kč a Premium 399 Kč. Roční částka na kartě je deset měsíčních cen a slouží jen
            pro porovnání. Z této stránky se nic nestrhává a předplatné se samo nespustí.
          </p>
        </div>
        <fieldset className="biz-period biz-period-cards">
          <legend>Zvolené období ceníku</legend>
          <label>
            <input
              type="radio"
              name="cenik-obdobi"
              value="mesicne"
              checked={period === 'mesicne'}
              onChange={() => setSelection({ period: 'mesicne' })}
            />
            Měsíčně
          </label>
          <label>
            <input
              type="radio"
              name="cenik-obdobi"
              value="rocne"
              checked={period === 'rocne'}
              onChange={() => setSelection({ period: 'rocne' })}
            />
            Ročně
          </label>
        </fieldset>
        <div className="biz-plans">
          {BUSINESS_PLANS.map((plan) => {
            const quote = quotePlan(plan, period)
            return (
            <article
              key={plan.id}
              className={`biz-plan${plan.recommended ? ' is-recommended' : ''}${
                selected === plan.id ? ' is-selected' : ''
              }`}
            >
              {plan.recommended ? <p className="biz-badge">Doporučujeme</p> : null}
              <h3>{plan.name}</h3>
              <p className="biz-price">
                <strong>{formatKc(quote.amount)}</strong>
                <span> {quote.amountLabel}</span>
              </p>
              {quote.savings ? (
                <p className="biz-save">Ušetříš {formatKc(quote.savings)} oproti 12 měsíčním platbám.</p>
              ) : (
                <p className="biz-save">Ročně {formatKc(quote.yearly)}, tedy deset měsíčních plateb.</p>
              )}
              <p className="biz-summary">{plan.summary}</p>
              <ul className="biz-perks">
                {plan.perks.map((perk) => (
                  <li key={perk.title} className="biz-perk">
                    <span className="biz-perk-title">{perk.title}</span>
                    <span className="biz-perk-detail">{perk.detail}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary biz-plan-btn" onClick={() => setSelection({ plan: plan.id, scroll: true })}>
                Vybrat {plan.name}
              </button>
            </article>
            )
          })}
        </div>
        <p className="biz-disclaimer">
          Najetím na kartu se ukáže, co která položka znamená. Na mobilu je stejný text rovnou v
          kartě. Reklamní označení, vlastní fotografie v propagaci ani přednostní umístění se po
          kliknutí samy nezapnou.
        </p>
      </section>

      <section className="biz-section" aria-labelledby="steps-title">
        <div className="biz-section-head">
          <h2 id="steps-title">Jak to funguje?</h2>
        </div>
        <ol className="biz-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="biz-step-index">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="biz-section" aria-labelledby="reasons-title">
        <div className="biz-section-head">
          <h2 id="reasons-title">Co CheapEats podniku dává</h2>
        </div>
        <ul className="biz-reasons">
          {REASONS.map((reason) => (
            <li key={reason.title} className={reason.emphasis ? 'is-emphasis' : undefined}>
              <h3>{reason.title}</h3>
              <p>{reason.text}</p>
              {reason.note ? <p>{reason.note}</p> : null}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => scrollToId('poptavka')}>
          Chci zviditelnit svůj podnik
        </button>
      </section>

      <section id="poptavka" className="biz-section biz-contact" aria-labelledby="contact-title">
        <div className="biz-section-head">
          <h2 id="contact-title">Poptávka propagace</h2>
          <p>
            Vybraný balíček: {findBusinessPlan(selected)?.name}. Žádost je o první měsíc zdarma,
            potom {formatKc(quotePlan(findBusinessPlan(selected), 'mesicne').monthly)} měsíčně.
            Balíček zůstane v adrese stránky. Roční nebo měsíční porovnání na ceníku nic neobjednává.
          </p>
        </div>
        <BusinessInquiry
          planId={selected}
          periodId={period}
          onPlanChange={(id) => setSelection({ plan: id })}
          onPeriodChange={(id) => setSelection({ period: id })}
        />
      </section>
    </main>
  )
}
