import { CONTACT_EMAIL } from '../constants/brand'
import { operatorIsComplete } from '../constants/operator'

const MISSING = [
  'Jméno nebo název provozovatele',
  'Adresa',
  'IČO, pokud ho provozovatel má',
  'DIČ a status plátce DPH, pokud se uplatní',
  'Kontaktní e-mail provozovatele (právní správce)',
  'Právní status projektu',
  'Údaje živnosti, pod kterou se má projekt provozovat',
  'Podnikatelské oprávnění k propagaci podniků',
  'Způsob, jak se na provozovatele obrátit s žádostí o přístup nebo výmaz',
  'Doby uložení účtu, recenzí, hlášení a žádostí podniků',
  'Právní základy zpracování',
  'Seznam zpracovatelů a údaj, jestli jsou mimo EU nebo EHP',
]

export default function LegalMissing() {
  const operatorReady = operatorIsComplete()
  return (
    <section className="legal-gap" aria-labelledby="legal-missing-title">
      <p className="legal-gap-label">Doplní provozovatel</p>
      <h2 id="legal-missing-title">Co v textu ještě chybí</h2>
      <p>
        Aplikace tyhle údaje nemá a sama je nedoplňuje. Než se stránka použije jako informace pro
        uživatele, musí je dodat provozovatel a nechat text zkontrolovat.
      </p>
      <p>
        Provozní kontakt značky FoodGo je{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        {operatorReady
          ? '. Identita provozovatele v konfiguraci je doplněná.'
          : '. Identita provozovatele (jméno, adresa, IČO) v konfiguraci stále chybí a nesmí se odhadovat.'}
      </p>
      <ul>
        {MISSING.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
