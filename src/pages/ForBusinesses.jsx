import { useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessPlanCards from '../components/BusinessPlanCards'
import BusinessApplicationForm from '../components/BusinessApplicationForm'
import { canStartPlan } from '../utils/businessApplication'

export default function ForBusinesses() {
  const [formOpen, setFormOpen] = useState(false)

  const onStart = (planId) => {
    if (!canStartPlan(planId)) return
    setFormOpen(true)
  }

  return (
    <main className="page biz-page">
      <section className="biz-hero">
        <p className="biz-kicker">Pro podniky</p>
        <h1>Rozjeď svůj podnik na CheapEats</h1>
        <p className="biz-lead">Dostaň svou restauraci mezi lidi, kteří hledají, kde se dobře najíst.</p>
        <p className="biz-note">
          Všechny tarify jsou teď zdarma. Platby neprobíhají. Aktivní je jen START — Plus a Premium jsou připravené na později.
        </p>
      </section>

      <section className="biz-section" aria-labelledby="biz-plans-title">
        <h2 id="biz-plans-title">Tarify</h2>
        <p className="section-desc">Původní ceny zůstávají vidět přeškrtnuté. Zatím nic neplatíš.</p>
        <BusinessPlanCards onStart={onStart} />
      </section>

      {formOpen ? (
        <BusinessApplicationForm onClose={() => setFormOpen(false)} />
      ) : (
        <section className="biz-section biz-how">
          <h2>Jak to funguje</h2>
          <ol>
            <li>Vybereš START – FREE.</li>
            <li>Vyplníš přehlednou žádost o podnik.</li>
            <li>Můžeš nechat zkontrolovat popis a ověřit pravděpodobnou existenci podniku.</li>
            <li>Po odeslání žádost zkontroluje administrátor. Teprve po schválení se podnik objeví ve výsledcích.</li>
          </ol>
          <p>
            Osobní podporu projektu najdeš na stránce <Link to="/podpor-me">Podpoř mě</Link>.
          </p>
        </section>
      )}
    </main>
  )
}
