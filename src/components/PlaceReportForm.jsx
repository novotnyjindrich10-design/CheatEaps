import { useState } from 'react'
import { PLACE_REPORT_REASONS, validatePlaceReport } from '../utils/placeReport'
import { fetchWithTimeout } from '../utils/fetchTimeout'

export default function PlaceReportForm({ restaurantId, restaurantName }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const validated = validatePlaceReport({
      restaurantId,
      reason,
      details,
      contact,
      website,
    })
    if (!validated.ok) {
      setError(validated.message)
      return
    }
    setPending(true)
    try {
      const response = await fetchWithTimeout('/api/place-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...validated.report, website }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || body.stored !== true) {
        setError(body.message || 'Hlášení se nepodařilo trvale uložit.')
        return
      }
      setDone(true)
      setReason('')
      setDetails('')
      setContact('')
    } catch {
      setError('Hlášení se teď nepodařilo odeslat.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="place-report" role="status">
        <p className="place-report-thanks">
          Díky. Hlášení k podniku {restaurantName || restaurantId} jsme uložili ke kontrole.
          Neověřená hlášení nezobrazujeme veřejně.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setDone(false)}>
          Nahlásit další problém
        </button>
      </div>
    )
  }

  return (
    <form className="place-report" onSubmit={submit} noValidate>
      <h3 className="detail-section-title">Nahlásit chybu</h3>
      <p className="section-desc">
        Pomoz opravit špatnou adresu, cenu, fotografii nebo jiný údaj. Hlášení jde jen k nám.
      </p>

      <label className="field">
        <span className="field-label">Důvod</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Vyber…</option>
          {PLACE_REPORT_REASONS.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Popis</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={1200}
          required
          placeholder="Co je špatně a jak to má správně vypadat?"
        />
      </label>

      <label className="field">
        <span className="field-label">Kontakt (volitelné)</span>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          placeholder="E-mail, pokud chceš odpověď"
          autoComplete="email"
        />
      </label>

      <label className="visually-hidden" aria-hidden="true">
        Web
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      {error ? (
        <p className="deal-warning" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-secondary" disabled={pending}>
        {pending ? 'Odesílám…' : 'Odeslat hlášení'}
      </button>
    </form>
  )
}
