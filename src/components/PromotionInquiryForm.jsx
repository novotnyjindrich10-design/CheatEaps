import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BUSINESS_PLANS, findBusinessPlan, formatKc, quotePlan } from '../constants/businessPlans'
import { presentPrice } from '../constants/operator'
import { useCatalog } from '../context/CatalogContext'
import { trackProductEvent } from '../utils/productEvents'

const EMPTY = {
  periodId: 'mesicne',
  placeId: '',
  placeQuery: '',
  businessName: '',
  companyName: '',
  ico: '',
  dic: '',
  contactName: '',
  email: '',
  phone: '',
  billingAddress: '',
  website: '',
  note: '',
  termsAck: false,
  ceLeaveBlank: '',
}

export default function PromotionInquiryForm({ planId, onClose }) {
  const { restaurants } = useCatalog()
  const [openedAt] = useState(() => Date.now())
  const [plan, setPlan] = useState(planId || 'plus')
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)
  const selected = findBusinessPlan(plan)
  const quote = selected ? quotePlan(selected, form.periodId) : null
  const price = quote ? presentPrice(quote.amount) : null
  const matches = useMemo(() => {
    const query = form.placeQuery.trim().toLocaleLowerCase('cs')
    if (query.length < 2) return []
    return restaurants
      .filter((place) => place.name?.toLocaleLowerCase('cs').includes(query))
      .slice(0, 6)
  }, [form.placeQuery, restaurants])

  const patch = (values) => setForm((current) => ({ ...current, ...values }))

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!selected) nextErrors.planId = 'Vyber balíček.'
    if (!form.businessName.trim()) nextErrors.businessName = 'Doplň název podniku.'
    if (!form.companyName.trim()) nextErrors.companyName = 'Doplň název firmy.'
    if (!form.contactName.trim()) nextErrors.contactName = 'Doplň kontaktní osobu.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Zadej platný e-mail.'
    if (form.phone.replace(/\D/g, '').length < 9) nextErrors.phone = 'Zadej telefon.'
    if (form.billingAddress.trim().length < 5) nextErrors.billingAddress = 'Doplň fakturační adresu.'
    if (!form.termsAck) nextErrors.termsAck = 'Potvrď, že jde o nezávaznou poptávku.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setPending(true)
    try {
      const response = await fetch('/api/promotion-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: plan,
          periodId: form.periodId,
          placeId: form.placeId,
          businessName: form.businessName,
          companyName: form.companyName,
          ico: form.ico,
          dic: form.dic,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          billingAddress: form.billingAddress,
          website: form.website,
          extra: form.note,
          termsAck: true,
          ceLeaveBlank: form.ceLeaveBlank,
          openedAt,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setErrors({ form: body.message || 'Poptávku se nepodařilo odeslat.' })
        return
      }
      trackProductEvent(body.stored ? 'promotion_order_created' : 'promotion_inquiry_submitted', {
        planId: plan,
        stored: Boolean(body.stored),
      })
      setResult(body)
    } catch {
      setErrors({ form: 'Poptávku se nepodařilo odeslat. Nic se nezaplatilo.' })
    } finally {
      setPending(false)
    }
  }

  if (result) {
    return (
      <section className="biz-form" aria-label="Poptávka odeslána">
        <div className="biz-form-toolbar">
          <h2>{result.stored ? 'Poptávka je uložená' : 'Poptávka se neuložila'}</h2>
          <button type="button" className="header-link" onClick={onClose}>Zavřít</button>
        </div>
        <p className="biz-form-success">{result.message}</p>
        {result.reference ? <p>Číslo poptávky: <strong>{result.reference}</strong></p> : null}
        {result.order ? (
          <ul className="biz-plan-limits">
            <li>Balíček: {result.order.planName}</li>
            <li>Délka: {result.order.serviceLabel}</li>
            <li>Ceníková částka: {formatKc(result.order.amount)}</li>
            <li>{result.order.vatNote}</li>
            <li>Platba online neproběhla. Propagace se nezapnula.</li>
          </ul>
        ) : null}
      </section>
    )
  }

  return (
    <section className="biz-form" aria-label="Poptávka placené propagace">
      <div className="biz-form-toolbar">
        <h2>Nezávazná poptávka</h2>
        <button type="button" className="header-link" onClick={onClose}>Zavřít</button>
      </div>
      <p className="biz-note">
        Online platba není zapojená. Odesláním vznikne poptávka, ne úhrada. Reklama se zapne až po
        kontrole a ověřené platbě, typicky podle faktury.
      </p>
      <form onSubmit={submit}>
        <div className="biz-form-grid">
          <label>
            Balíček
            <select value={plan} onChange={(event) => setPlan(event.target.value)}>
              {BUSINESS_PLANS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Délka a platba
            <select value={form.periodId} onChange={(event) => patch({ periodId: event.target.value })}>
              <option value="mesicne">30 dní, jednorázově</option>
              <option value="rocne">12 měsíců, jednorázově</option>
            </select>
          </label>
        </div>
        {quote && price ? (
          <div className="biz-quote">
            <p>
              <strong>{formatKc(quote.amount)}</strong> {quote.amountLabel}. {quote.serviceLabel}. {quote.billingLabel}. {quote.renewalLabel}.
            </p>
            <p>{price.finalAmount == null ? `Ceníková částka ${formatKc(quote.amount)}. ${price.vatNote}` : price.vatNote}</p>
          </div>
        ) : null}
        <div className="biz-form-grid">
          <label className="biz-form-span">
            Najít podnik v katalogu
            <input
              value={form.placeQuery}
              onChange={(event) => patch({ placeQuery: event.target.value, placeId: '' })}
              placeholder="Například název restaurace"
            />
          </label>
          {matches.length > 0 ? (
            <div className="biz-form-span biz-place-picks">
              {matches.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className={`btn${form.placeId === place.id ? ' btn-primary' : ''}`}
                  onClick={() => patch({ placeId: place.id, businessName: place.name, placeQuery: place.name })}
                >
                  {place.name}
                </button>
              ))}
            </div>
          ) : null}
          <label>
            Název podniku
            <input value={form.businessName} onChange={(event) => patch({ businessName: event.target.value })} maxLength={100} />
            {errors.businessName ? <span className="biz-field-error">{errors.businessName}</span> : null}
          </label>
          <label>
            Název firmy
            <input value={form.companyName} onChange={(event) => patch({ companyName: event.target.value })} maxLength={160} />
            {errors.companyName ? <span className="biz-field-error">{errors.companyName}</span> : null}
          </label>
          <label>
            IČO, pokud ho firma má
            <input value={form.ico} onChange={(event) => patch({ ico: event.target.value })} maxLength={16} inputMode="numeric" />
          </label>
          <label>
            DIČ, pokud se uplatní
            <input value={form.dic} onChange={(event) => patch({ dic: event.target.value })} maxLength={20} />
          </label>
          <label>
            Kontaktní osoba
            <input value={form.contactName} onChange={(event) => patch({ contactName: event.target.value })} maxLength={100} />
            {errors.contactName ? <span className="biz-field-error">{errors.contactName}</span> : null}
          </label>
          <label>
            E-mail
            <input value={form.email} onChange={(event) => patch({ email: event.target.value })} maxLength={200} type="email" />
            {errors.email ? <span className="biz-field-error">{errors.email}</span> : null}
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(event) => patch({ phone: event.target.value })} maxLength={40} />
            {errors.phone ? <span className="biz-field-error">{errors.phone}</span> : null}
          </label>
          <label>
            Web
            <input value={form.website} onChange={(event) => patch({ website: event.target.value })} maxLength={300} />
          </label>
          <label className="biz-form-span">
            Fakturační adresa
            <input value={form.billingAddress} onChange={(event) => patch({ billingAddress: event.target.value })} maxLength={200} />
            {errors.billingAddress ? <span className="biz-field-error">{errors.billingAddress}</span> : null}
          </label>
          <label className="biz-form-span">
            Poznámka
            <textarea value={form.note} onChange={(event) => patch({ note: event.target.value })} maxLength={2000} rows={3} />
          </label>
        </div>
        <label className="biz-check">
          <input
            type="checkbox"
            checked={form.termsAck}
            onChange={(event) => patch({ termsAck: event.target.checked })}
          />
          <span>
            Beru na vědomí, že odesláním vzniká nezávazná poptávka.{' '}
            <Link to="/obchodni-podminky">Obchodní podmínky</Link> jsou text k právní kontrole a smlouva
            vznikne až po potvrzení provozovatelem.
          </span>
        </label>
        {errors.termsAck ? <p className="biz-field-error">{errors.termsAck}</p> : null}
        <label className="sr-only">
          Nechat prázdné
          <input
            value={form.ceLeaveBlank}
            onChange={(event) => patch({ ceLeaveBlank: event.target.value })}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
        {errors.form ? <p className="biz-chat-error">{errors.form}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Odesílám…' : 'Odeslat poptávku'}
        </button>
      </form>
    </section>
  )
}
