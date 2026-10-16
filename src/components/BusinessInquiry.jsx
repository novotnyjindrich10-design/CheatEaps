import { useState } from 'react'
import {
  BUSINESS_PLANS,
  findBusinessPlan,
  formatFileSize,
  formatKc,
  quotePlan,
  reviewOrder,
} from '../constants/businessPlans'

const EMPTY = {
  businessName: '',
  contactName: '',
  email: '',
  website: '',
  description: '',
  socials: '',
  extra: '',
}

export default function BusinessInquiry({ planId, periodId, onPlanChange, onPeriodChange }) {
  const [fields, setFields] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const [errors, setErrors] = useState({})
  const [review, setReview] = useState(null)
  const [sendState, setSendState] = useState(null)
  const [sending, setSending] = useState(false)
  const [copyNote, setCopyNote] = useState('')
  const [companyFax, setCompanyFax] = useState('')
  const [openedAt] = useState(() => Date.now())
  const plan = findBusinessPlan(planId) ?? findBusinessPlan('plus')
  const quote = quotePlan(plan, periodId)

  const draft = () => ({
    ...fields,
    planId: plan.id,
    periodId,
    photos,
  })

  const clearReview = () => {
    setReview(null)
    setSendState(null)
    setCopyNote('')
  }

  const setField = (key) => (event) => {
    setFields((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: '' }))
    clearReview()
  }

  const changePlan = (event) => {
    onPlanChange(event.target.value)
    setErrors((current) => ({ ...current, planId: '', photos: '', description: '' }))
    clearReview()
  }

  const changePeriod = (event) => {
    onPeriodChange(event.target.value)
    setErrors((current) => ({ ...current, periodId: '' }))
    clearReview()
  }

  const addPhotos = (event) => {
    const incoming = [...event.target.files]
    setPhotos(incoming)
    setErrors((current) => ({ ...current, photos: '' }))
    clearReview()
    event.target.value = ''
  }

  const removePhoto = (index) => {
    setPhotos((current) => current.filter((_, item) => item !== index))
    setErrors((current) => ({ ...current, photos: '' }))
    clearReview()
  }

  const submit = (event) => {
    event.preventDefault()
    const result = reviewOrder(draft())
    if (!result.ok) {
      setErrors(result.errors)
      setReview(null)
      setSendState(null)
      window.requestAnimationFrame(() => {
        document.getElementById(`order-${result.firstField}`)?.focus()
      })
      return
    }
    setErrors({})
    setReview(result.summary)
    setSendState(null)
    window.requestAnimationFrame(() => {
      document.getElementById('souhrn-title')?.focus()
    })
  }

  const trySend = async () => {
    if (sending || sendState?.type === 'success') return
    setSending(true)
    setSendState(null)
    try {
      const response = await fetch('/api/promotion-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          periodId,
          businessName: fields.businessName,
          contactName: fields.contactName,
          email: fields.email,
          website: fields.website,
          description: fields.description,
          socials: fields.socials,
          extra: fields.extra,
          photoNames: photos.map((file) => file.name),
          ceLeaveBlank: companyFax,
          openedAt,
        }),
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      const accepted = response.ok && body?.accepted === true && body?.paid !== true && body?.activated !== true
      if (accepted) {
        setSendState({
          type: 'success',
          message:
            'Žádost o první měsíc zdarma odešla. Ozveme se na uvedený e-mail. Nic se nezaplatilo a propagace se sama nezapnula.',
        })
        window.requestAnimationFrame(() => {
          document.getElementById('zadost-stav')?.focus()
        })
        return
      }
      const serverMessage = typeof body?.message === 'string' && body.message.length <= 240 ? body.message : ''
      setSendState({
        type: 'error',
        message: serverMessage || 'Žádost se neodeslala. Zkus to znovu.',
      })
      if (body?.field) setErrors((current) => ({ ...current, [body.field]: serverMessage }))
    } catch {
      setSendState({
        type: 'error',
        message: 'Spojení selhalo. Žádost neodešla, můžeš to zkusit znovu.',
      })
    } finally {
      setSending(false)
    }
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(review.text)
      setCopyNote('Text žádosti je ve schránce.')
    } catch {
      setCopyNote('Schránka se nepodařila otevřít. Text níže jde označit a zkopírovat ručně.')
    }
  }

  const fieldError = (key) =>
    errors[key] ? (
      <span id={`order-${key}-error`} className="biz-field-error">
        {errors[key]}
      </span>
    ) : null

  return (
    <form className="biz-form" onSubmit={submit} noValidate>
      <p className="biz-form-note">
        Vyplň údaje a nejdřív zkontroluj souhrn. Odeslání je nezávazná žádost o první měsíc zdarma.
        Obchodní podmínky a informace o zpracování osobních údajů na webu zatím nejsou. Údaje z
        formuláře přijdou e-mailem provozovateli, aby tě mohl kontaktovat. Platba se nestrhává a
        propagace se sama nezapne. Fotografie se nenahrávají.
      </p>

      <div className="biz-honeypot" aria-hidden="true">
        <label>
          Nevyplňuj
          <input
            name="ce_leave_blank"
            value={companyFax}
            onChange={(event) => setCompanyFax(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <fieldset className="biz-period">
        <legend>Porovnání ceny po měsíci zdarma</legend>
        <label>
          <input
            id="order-periodId"
            type="radio"
            name="objednavka-obdobi"
            value="mesicne"
            checked={periodId === 'mesicne'}
            onChange={changePeriod}
          />
          Potom měsíčně, {formatKc(quote.monthly)}
        </label>
        <label>
          <input
            type="radio"
            name="objednavka-obdobi"
            value="rocne"
            checked={periodId === 'rocne'}
            onChange={changePeriod}
          />
          Roční porovnání, {formatKc(quote.yearly)} za rok
        </label>
        <span className="biz-hint">Tahle volba nic neobjednává. Žádost je vždy o první měsíc zdarma.</span>
        {fieldError('periodId')}
      </fieldset>

      <div className="biz-form-grid">
        <label className="biz-field">
          <span>Název podniku, povinné</span>
          <span className="biz-hint">Název, pod kterým podnik na CheapEats představíme.</span>
          <input
            id="order-businessName"
            name="business"
            value={fields.businessName}
            onChange={setField('businessName')}
            autoComplete="organization"
            aria-invalid={errors.businessName ? 'true' : undefined}
            aria-describedby={errors.businessName ? 'order-businessName-error' : undefined}
            required
          />
          {fieldError('businessName')}
        </label>
        <label className="biz-field">
          <span>Jméno kontaktní osoby, povinné</span>
          <span className="biz-hint">Komu budeme psát ohledně podkladů a potvrzení.</span>
          <input
            id="order-contactName"
            name="name"
            value={fields.contactName}
            onChange={setField('contactName')}
            autoComplete="name"
            aria-invalid={errors.contactName ? 'true' : undefined}
            aria-describedby={errors.contactName ? 'order-contactName-error' : undefined}
            required
          />
          {fieldError('contactName')}
        </label>
        <label className="biz-field">
          <span>E-mail, povinné</span>
          <span className="biz-hint">Na tento e-mail se ozveme kvůli žádosti, až ji server přijme.</span>
          <input
            id="order-email"
            name="email"
            type="email"
            value={fields.email}
            onChange={setField('email')}
            autoComplete="email"
            inputMode="email"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'order-email-error' : undefined}
            required
          />
          {fieldError('email')}
        </label>
        <label className="biz-field">
          <span>Vybraný balíček, povinné</span>
          <span className="biz-hint">Po měsíci zdarma platí měsíční cena. Roční částka je jen porovnání na ceníku.</span>
          <select
            id="order-planId"
            name="plan"
            value={plan.id}
            onChange={changePlan}
            aria-invalid={errors.planId ? 'true' : undefined}
            aria-describedby={errors.planId ? 'order-planId-error' : undefined}
          >
            {BUSINESS_PLANS.map((item) => {
              const itemQuote = quotePlan(item, 'mesicne')
              return (
                <option key={item.id} value={item.id}>
                  {item.name} – měsíc zdarma, potom {formatKc(itemQuote.amount)} měsíčně
                </option>
              )
            })}
          </select>
          {fieldError('planId')}
        </label>
      </div>

      <label className="biz-field">
        <span>Web podniku, nepovinné</span>
        <span className="biz-hint">Odkaz doplníme do prezentace, pokud ho pošleš. Tvar https://example.cz.</span>
        <input
          id="order-website"
          name="website"
          type="url"
          inputMode="url"
          value={fields.website}
          onChange={setField('website')}
          placeholder="https://"
          aria-invalid={errors.website ? 'true' : undefined}
          aria-describedby={errors.website ? 'order-website-error' : undefined}
        />
        {fieldError('website')}
      </label>

      <label className="biz-field">
        <span>{plan.id === 'premium' ? 'Popis podniku, nepovinné' : 'Krátký popis, nepovinné'}</span>
        <span className="biz-hint">
          Text pro představení podniku. U {plan.name} je limit {plan.descriptionMax} znaků.
          {plan.id === 'premium' ? ' Premium má delší prostor než Start a Plus.' : ''}
        </span>
        <textarea
          id="order-description"
          name="description"
          rows={plan.id === 'premium' ? 6 : 3}
          maxLength={plan.descriptionMax}
          value={fields.description}
          onChange={setField('description')}
          aria-invalid={errors.description ? 'true' : undefined}
          aria-describedby={
            errors.description ? 'order-description-count order-description-error' : 'order-description-count'
          }
        />
        <span id="order-description-count" className="biz-hint">
          {fields.description.length} / {plan.descriptionMax}
        </span>
        {fieldError('description')}
      </label>

      <label className="biz-field">
        <span>Odkazy na sociální sítě, nepovinné</span>
        <span className="biz-hint">Každý odkaz na vlastní řádek. Slouží jen jako podklad k prezentaci.</span>
        <textarea
          id="order-socials"
          name="socials"
          rows={3}
          value={fields.socials}
          onChange={setField('socials')}
          placeholder={'https://instagram.com/podnik'}
          aria-invalid={errors.socials ? 'true' : undefined}
          aria-describedby={errors.socials ? 'order-socials-error' : undefined}
        />
        {fieldError('socials')}
      </label>

      <label className="biz-field">
        <span>Další kontaktní nebo prezentační informace, nepovinné</span>
        <span className="biz-hint">Třeba telefon, adresa nebo to, co chceš v textu zdůraznit.</span>
        <textarea
          id="order-extra"
          name="extra"
          rows={3}
          value={fields.extra}
          onChange={setField('extra')}
        />
      </label>

      <div className="biz-field">
        <label htmlFor="order-photos">Fotografie podniku, nepovinné</label>
        <span className="biz-hint">
          JPG, PNG nebo WebP, každá do 5 MB. Balíček {plan.name} přijme{' '}
          {plan.photoMax === 1 ? '1 fotografii' : `až ${plan.photoMax} fotografií`}.
          Soubory zůstávají v prohlížeči a na server se nenahrávají.
        </span>
        <input
          id="order-photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={plan.photoMax > 1}
          onChange={addPhotos}
          aria-invalid={errors.photos ? 'true' : undefined}
          aria-describedby={errors.photos ? 'order-photos-error' : undefined}
        />
        {photos.length ? (
          <ul className="biz-files">
            {photos.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`}>
                <span>
                  {file.name} ({formatFileSize(file.size)})
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => removePhoto(index)}>
                  Odebrat
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fieldError('photos')}
      </div>

      {Object.values(errors).some(Boolean) ? (
        <p className="biz-form-error" role="alert">
          Souhrn se nezobrazil. Oprav označená pole a zkontroluj žádost znovu.
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary btn-lg">
        Zkontrolovat žádost
      </button>

      {review ? (
        <section className="biz-summary" aria-labelledby="souhrn-title">
          <h3 id="souhrn-title" tabIndex={-1}>
            Souhrn žádosti
          </h3>
          <dl>
            <div>
              <dt>Balíček</dt>
              <dd>{review.planName}</dd>
            </div>
            <div>
              <dt>První měsíc</dt>
              <dd>zdarma</dd>
            </div>
            <div>
              <dt>Cena potom</dt>
              <dd>{review.afterPriceText}</dd>
            </div>
            <div>
              <dt>Na ceníku je teď zobrazeno</dt>
              <dd>
                {review.periodName}, {review.priceText}
              </dd>
            </div>
          </dl>
          <h4>Dodané podklady</h4>
          <ul className="biz-materials">
            {review.materials.map((item) => (
              <li key={item.label}>
                <strong>{item.label}:</strong> {item.value}
              </li>
            ))}
          </ul>
          <h4>{review.setupTitle}</h4>
          <p>{review.setupText}</p>
          <p className="biz-form-note">{review.setupNote}</p>
          <h4>Co je potřeba doplnit před veřejným spuštěním</h4>
          <ul className="biz-gaps">
            {review.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <div className="biz-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => document.getElementById('order-businessName')?.focus()}
            >
              Upravit údaje
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={trySend}
              disabled={sending || sendState?.type === 'success'}
            >
              {sending ? 'Odesílám…' : 'Odeslat žádost o měsíc zdarma'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={copyText}>
              Zkopírovat text
            </button>
          </div>
          {copyNote ? <p className="biz-form-note">{copyNote}</p> : null}
          {sendState?.type === 'success' ? (
            <div className="biz-send is-success" role="status">
              <h3 id="zadost-stav" tabIndex={-1}>
                {sendState.message}
              </h3>
            </div>
          ) : null}
          {sendState?.type === 'error' ? (
            <div className="biz-send" role="alert">
              <p>{sendState.message}</p>
              <p>Údaje zůstaly ve formuláři. Můžeš žádost odeslat znovu.</p>
            </div>
          ) : null}
          <textarea readOnly rows={8} value={review.text} aria-label="Text souhrnu žádosti" />
        </section>
      ) : null}
    </form>
  )
}
