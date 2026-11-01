import { useMemo, useState } from 'react'
import { FOOD_CATEGORIES } from '../constants/filters'
import { PHOTO_MAX_BYTES, PHOTO_TYPES, findBusinessPlan, photoProblem } from '../constants/businessPlans'
import { ACTIVE_APPLICATION_PLAN, assessBusinessApplication } from '../utils/businessApplication'
import BusinessPreview from './BusinessPreview'

const STEPS = [
  { id: 'place', label: 'Podnik' },
  { id: 'details', label: 'Popis a kontakt' },
  { id: 'checks', label: 'Kontrola' },
  { id: 'review', label: 'Rekapitulace' },
]

const emptyForm = () => ({
  businessName: '',
  address: '',
  locality: 'Brno',
  category: '',
  cuisineFocus: '',
  description: '',
  descriptionOriginal: '',
  ownerEmail: '',
  website: '',
  photo: null,
})

async function fileToPhoto(file) {
  const problem = photoProblem(file)
  if (problem) throw new Error(problem)
  if (file.size > Math.min(PHOTO_MAX_BYTES, 280_000)) {
    throw new Error('Fotografie je moc velká. Zkus soubor do cca 250 kB.')
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Soubor se nepodařilo načíst.'))
    reader.readAsDataURL(file)
  })
  const mime = file.type && PHOTO_TYPES.includes(file.type) ? file.type : 'image/jpeg'
  return { mime, dataUrl }
}

export default function BusinessApplicationForm({ onClose }) {
  const plan = findBusinessPlan(ACTIVE_APPLICATION_PLAN)
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [review, setReview] = useState(null)
  const [existence, setExistence] = useState(null)
  const [busy, setBusy] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitOk, setSubmitOk] = useState(false)
  const step = STEPS[stepIndex]

  const patch = (fields) => setForm((prev) => ({ ...prev, ...fields }))

  const validateStep = (index) => {
    const nextErrors = {}
    if (index === 0) {
      if (form.businessName.trim().length < 2) nextErrors.businessName = 'Doplň název podniku.'
      if (form.address.trim().length < 5) nextErrors.address = 'Doplň adresu.'
      if (form.locality.trim().length < 2) nextErrors.locality = 'Doplň město nebo lokalitu.'
      if (!form.category) nextErrors.category = 'Vyber kategorii.'
      if (form.cuisineFocus.trim().length < 2) nextErrors.cuisineFocus = 'Doplň typ kuchyně nebo zaměření.'
    }
    if (index === 1) {
      if (form.description.trim().length < 20) nextErrors.description = 'Popis musí mít aspoň 20 znaků.'
      if (form.description.trim().length > (plan?.descriptionMax || 400)) {
        nextErrors.description = `Popis může mít nejvýš ${plan.descriptionMax} znaků.`
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())) {
        nextErrors.ownerEmail = 'Zadej platný kontaktní e-mail.'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (!validateStep(stepIndex)) return
    setStepIndex((n) => Math.min(n + 1, STEPS.length - 1))
  }

  const goBack = () => setStepIndex((n) => Math.max(n - 1, 0))

  const runDescriptionReview = async () => {
    setBusy('review')
    setSubmitMessage('')
    try {
      const res = await fetch('/api/business-description-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          businessName: form.businessName,
          locality: form.locality,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setErrors({ description: body.message || 'Kontrolu textu se nepodařilo spustit.' })
        return
      }
      setReview(body)
      if (!form.descriptionOriginal) patch({ descriptionOriginal: body.original })
    } finally {
      setBusy('')
    }
  }

  const acceptSuggested = () => {
    if (!review?.suggested) return
    patch({
      description: review.suggested,
      descriptionOriginal: review.original || form.descriptionOriginal || form.description,
    })
  }

  const runExistence = async () => {
    setBusy('existence')
    setSubmitMessage('')
    try {
      const res = await fetch('/api/business-existence-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          address: form.address,
          locality: form.locality,
        }),
      })
      const body = await res.json().catch(() => ({}))
      setExistence(body)
    } finally {
      setBusy('')
    }
  }

  const submit = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      setStepIndex(0)
      return
    }
    setBusy('submit')
    setSubmitMessage('')
    setSubmitOk(false)
    const assessed = assessBusinessApplication({
      ...form,
      planId: ACTIVE_APPLICATION_PLAN,
      descriptionOriginal: form.descriptionOriginal || form.description,
      keepDescriptionExact: true,
      descriptionReviewEngine: review?.engine || '',
      descriptionReviewNotes: [...(review?.warnings || []), review?.message].filter(Boolean).join(' · '),
      existenceStatus: existence?.status || 'unavailable',
      existenceSummary: existence?.summary || '',
      existenceRequiresManual: existence?.requiresManualReview !== false,
      existenceCandidates: existence?.candidates || [],
    })
    if (!assessed.ok) {
      setErrors(assessed.errors)
      setSubmitMessage(assessed.message)
      setBusy('')
      return
    }
    try {
      const res = await fetch('/api/business-applications', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(assessed.value),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setSubmitOk(false)
        setSubmitMessage(body.message || 'Žádost se nepodařilo odeslat.')
        return
      }
      setSubmitOk(true)
      setSubmitMessage(body.message)
    } catch {
      setSubmitOk(false)
      setSubmitMessage('Síťová chyba. Žádost neodešla.')
    } finally {
      setBusy('')
    }
  }

  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex])

  if (submitOk) {
    return (
      <section className="biz-form" aria-label="Žádost odeslána">
        <div className="biz-form-toolbar">
          <h2>Žádost odeslána</h2>
          <button type="button" className="header-link" onClick={onClose}>
            Zavřít
          </button>
        </div>
        <p className="biz-form-success">{submitMessage}</p>
        <p>Podnik ještě není veřejný. Až ho administrátor schválí, přijde potvrzení na e-mail majitele.</p>
      </section>
    )
  }

  return (
    <section className="biz-form" aria-label="Žádost o přidání podniku">
      <div className="biz-form-toolbar">
        <h2>Žádost o přidání podniku · START FREE</h2>
        <button type="button" className="header-link" onClick={onClose}>
          Zavřít
        </button>
      </div>

      <ol className="biz-form-steps" aria-label="Průběh vyplňování">
        {STEPS.map((item, index) => (
          <li key={item.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-done' : ''}>
            <span>{index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>
      <div className="biz-form-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {step.id === 'place' ? (
        <div className="biz-form-grid">
          <label>
            Název podniku
            <input value={form.businessName} onChange={(e) => patch({ businessName: e.target.value })} maxLength={120} />
            {errors.businessName ? <span className="biz-field-error">{errors.businessName}</span> : null}
          </label>
          <label>
            Adresa
            <input value={form.address} onChange={(e) => patch({ address: e.target.value })} maxLength={200} />
            {errors.address ? <span className="biz-field-error">{errors.address}</span> : null}
          </label>
          <label>
            Město / lokalita
            <input value={form.locality} onChange={(e) => patch({ locality: e.target.value })} maxLength={80} />
            {errors.locality ? <span className="biz-field-error">{errors.locality}</span> : null}
          </label>
          <label>
            Kategorie podniku
            <select value={form.category} onChange={(e) => patch({ category: e.target.value })}>
              <option value="">Vyber kategorii</option>
              {FOOD_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {errors.category ? <span className="biz-field-error">{errors.category}</span> : null}
          </label>
          <label className="biz-form-span">
            Typ kuchyně nebo zaměření
            <input
              value={form.cuisineFocus}
              onChange={(e) => patch({ cuisineFocus: e.target.value })}
              maxLength={80}
              placeholder="např. italská pizza, street food, vegetariánské bistro"
            />
            {errors.cuisineFocus ? <span className="biz-field-error">{errors.cuisineFocus}</span> : null}
          </label>
        </div>
      ) : null}

      {step.id === 'details' ? (
        <div className="biz-form-grid">
          <label className="biz-form-span">
            Popis podniku ({form.description.length}/{plan?.descriptionMax || 400})
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value, descriptionOriginal: form.descriptionOriginal || e.target.value })}
              maxLength={plan?.descriptionMax || 400}
            />
            {errors.description ? <span className="biz-field-error">{errors.description}</span> : null}
          </label>
          <label>
            Kontaktní e-mail majitele
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => patch({ ownerEmail: e.target.value })}
              autoComplete="email"
            />
            {errors.ownerEmail ? <span className="biz-field-error">{errors.ownerEmail}</span> : null}
          </label>
          <label>
            Webové stránky (nepovinné)
            <input value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://" />
            {errors.website ? <span className="biz-field-error">{errors.website}</span> : null}
          </label>
          <label className="biz-form-span">
            Fotografie podniku (nepovinné, max. 1 · JPG/PNG/WebP)
            <input
              type="file"
              accept={PHOTO_TYPES.join(',')}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  const photo = await fileToPhoto(file)
                  patch({ photo })
                  setErrors((prev) => ({ ...prev, photo: '' }))
                } catch (error) {
                  setErrors((prev) => ({ ...prev, photo: error.message }))
                }
              }}
            />
            {form.photo ? <span className="biz-form-hint">Fotografie je připravená k odeslání.</span> : null}
            {errors.photo ? <span className="biz-field-error">{errors.photo}</span> : null}
          </label>
        </div>
      ) : null}

      {step.id === 'checks' ? (
        <div className="biz-form-checks">
          <div className="biz-check-card">
            <h3>Kontrola a vylepšení popisu</h3>
            <p className="biz-form-hint">
              Spustí pravidlovou kontrolu CheapEats (oprava mezer/pravopisu drobných chyb). Nejde o jazykový model a nic si nevymýšlí.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy === 'review'} onClick={runDescriptionReview}>
              {busy === 'review' ? 'Kontroluji…' : 'Zkontrolovat a vylepšit'}
            </button>
            {review ? (
              <div className="biz-compare">
                <p>
                  <strong>Engine:</strong> {review.engineLabel}
                </p>
                {review.warnings?.length ? (
                  <ul>
                    {review.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Bez zásadních upozornění.</p>
                )}
                <div className="biz-compare-cols">
                  <div>
                    <h4>Původní popis</h4>
                    <p>{review.original}</p>
                  </div>
                  <div>
                    <h4>Navržená úprava</h4>
                    <p>{review.suggested}</p>
                    <button type="button" className="btn" onClick={acceptSuggested}>
                      Přijmout úpravu
                    </button>
                  </div>
                </div>
                <label className="biz-form-span">
                  Finální popis (můžeš ještě upravit ručně)
                  <textarea rows={4} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
                </label>
              </div>
            ) : null}
          </div>

          <div className="biz-check-card">
            <h3>Ověření existence podniku</h3>
            <p className="biz-form-hint">
              Porovná název a adresu s Google Places, pokud je na serveru nastavený klíč. Výsledek sám o sobě neznamená schválení.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy === 'existence'} onClick={runExistence}>
              {busy === 'existence' ? 'Ověřuji…' : 'Ověřit existenci'}
            </button>
            {existence ? (
              <div className="biz-existence">
                <p>
                  <strong>Stav:</strong> {existence.status}
                </p>
                <p>{existence.summary}</p>
                {existence.verified ? null : (
                  <p className="biz-form-hint">Absolutní ověření existence neproběhlo / není tvrzeno.</p>
                )}
                {existence.candidates?.length ? (
                  <ul>
                    {existence.candidates.map((item) => (
                      <li key={`${item.placeId}-${item.name}`}>
                        {item.name}
                        {item.address ? ` · ${item.address}` : ''}
                        {item.score != null ? ` · shoda ${(item.score * 100).toFixed(0)} %` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step.id === 'review' ? (
        <div className="biz-form-review">
          <BusinessPreview
            answers={{
              businessName: form.businessName,
              address: `${form.address}, ${form.locality}`,
              category: form.category,
              categoryLabel: form.cuisineFocus,
              description: form.description,
              photo: form.photo,
            }}
          />
          <dl className="biz-recap">
            <div>
              <dt>E-mail</dt>
              <dd>{form.ownerEmail}</dd>
            </div>
            <div>
              <dt>Web</dt>
              <dd>{form.website || '—'}</dd>
            </div>
            <div>
              <dt>Kontrola popisu</dt>
              <dd>{review ? review.engineLabel : 'Zatím nespouštěna'}</dd>
            </div>
            <div>
              <dt>Existence</dt>
              <dd>{existence?.summary || 'Zatím neověřeno — po odeslání půjde k ruční kontrole.'}</dd>
            </div>
          </dl>
          {submitMessage ? <p className={`biz-chat-status${submitOk ? ' is-ok' : ' is-bad'}`}>{submitMessage}</p> : null}
        </div>
      ) : null}

      <div className="biz-form-actions">
        {stepIndex > 0 ? (
          <button type="button" className="btn" onClick={goBack}>
            Zpět
          </button>
        ) : (
          <span />
        )}
        {step.id !== 'review' ? (
          <button type="button" className="btn btn-primary" onClick={goNext}>
            Pokračovat
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy === 'submit'} onClick={submit}>
            {busy === 'submit' ? 'Odesílám…' : 'Odeslat žádost ke kontrole'}
          </button>
        )}
      </div>
    </section>
  )
}
