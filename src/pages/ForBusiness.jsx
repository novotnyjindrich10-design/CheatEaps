import { useRef, useState } from 'react'
import {
  SUPPORT_PRESET_KC,
  buildSupportPaymentUrl,
  canStartSupportPayment,
  formatSupportKc,
  parseSupportAmount,
} from '../constants/supportPayment'

const PAYMENT_READY = canStartSupportPayment()

export default function Support() {
  const [mode, setMode] = useState('')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const amountRef = useRef(null)

  const selectedHalere = parseSupportAmount(raw)
  const selectedLabel = selectedHalere == null ? '' : formatSupportKc(selectedHalere)

  const editRaw = (value) => {
    setRaw(value)
    const trimmed = value.trim()
    if (trimmed === '') setMode('custom')
    else {
      const preset = SUPPORT_PRESET_KC.find((kc) => String(kc) === trimmed)
      setMode(preset ? String(preset) : 'custom')
    }
    setError('')
    setNotice('')
  }

  const selectPreset = (kc) => {
    setMode(String(kc))
    setRaw(String(kc))
    setError('')
    setNotice('')
  }

  const selectCustom = () => {
    setMode('custom')
    setRaw((current) => (SUPPORT_PRESET_KC.some((kc) => String(kc) === current.trim()) ? '' : current))
    setError('')
    setNotice('')
    window.requestAnimationFrame(() => amountRef.current?.focus())
  }

  const onSubmit = (event) => {
    event.preventDefault()
    const halere = parseSupportAmount(raw)
    if (halere == null) {
      setNotice('')
      setError(
        raw.trim() === '' && mode !== 'custom'
          ? 'Vyber 30, 50 nebo 100 Kč, nebo zadej vlastní částku.'
          : 'Zadej kladnou částku v korunách. Nula, záporné číslo ani nečíselný text nejdou použít.',
      )
      amountRef.current?.focus()
      return
    }

    setError('')
    const href = buildSupportPaymentUrl(halere)
    if (!href || !PAYMENT_READY) {
      setNotice('Platba se nespustila. Možnost podpory se ještě připravuje.')
      return
    }

    window.location.assign(href)
  }

  return (
    <main className="page support-page">
      <article className="support-story">
        <p className="support-kicker">CheapEats Brno</p>
        <h1>Podpoř mě</h1>
        <p className="support-hello">
          <strong>Ahoj! 👋 Jsem tvůrce CheapEats Brno.</strong>
        </p>
        <p>
          Je mi 16 let a CheapEats tvořím jako vlastní studentský projekt. Baví mě programování,
          technologie a vymýšlení věcí, které lidem reálně usnadňují život.
        </p>
        <p>
          Chtěl jsem vytvořit místo, kde v Brně snadno najdeš restauraci podle ceny, chuti a svých
          preferencí. Na projektu pořád pracuju, vylepšuju jeho funkce a snažím se, aby byly
          informace o restauracích co nejužitečnější a nejspolehlivější.
        </p>
        <p>
          Vývoj a provoz mě zatím stojí vlastní peníze a aktuálně jsem kvůli projektu v mínusu.
          Pokud se ti CheapEats líbí nebo ti pomáhá najít něco dobrého k jídlu, můžeš jeho další
          vývoj dobrovolně podpořit libovolnou částkou.
        </p>
        <p>
          Podpora je zcela dobrovolná. Nemusíš platit nic a za příspěvek nezískáváš lepší umístění
          restaurace ani žádnou jinou výhodu.
        </p>
        <p>
          <strong>Díky, že CheapEats používáš a pomáháš mu růst! ❤️</strong>
        </p>
      </article>

      <section className="support-panel" aria-labelledby="support-form-title">
        <h2 id="support-form-title">Dobrovolná podpora</h2>
        <p id="support-voluntary" className="support-note">
          Podpora je zcela dobrovolná. Nemusíš platit nic a za příspěvek nezískáváš lepší umístění
          restaurace ani žádnou jinou výhodu.
        </p>
        <form className="support-form" onSubmit={onSubmit} noValidate>
          <fieldset className="support-choices">
            <legend>Rychlá částka</legend>
            <div className="support-choice-grid">
              {SUPPORT_PRESET_KC.map((kc) => (
                <label key={kc} className={`support-choice${mode === String(kc) ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="rychla-castka"
                    value={kc}
                    checked={mode === String(kc)}
                    onChange={() => selectPreset(kc)}
                  />
                  {kc} Kč
                </label>
              ))}
              <label className={`support-choice${mode === 'custom' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="rychla-castka"
                  value="custom"
                  checked={mode === 'custom'}
                  onChange={selectCustom}
                />
                Vlastní částka
              </label>
            </div>
          </fieldset>

          <div className="support-amount">
            <label htmlFor="support-amount">Částka v Kč</label>
            <div className="support-amount-row">
              <input
                ref={amountRef}
                id="support-amount"
                name="castka"
                inputMode="decimal"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                maxLength={20}
                value={raw}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'support-amount-hint support-amount-error' : 'support-amount-hint'}
                onChange={(event) => editRaw(event.target.value)}
              />
              <span className="support-currency" aria-hidden="true">
                Kč
              </span>
            </div>
            <p id="support-amount-hint" className="support-hint">
              Kladná částka v korunách, třeba 50. Nula, záporné číslo ani prázdné pole nejdou
              odeslat.
            </p>
          </div>

          {selectedLabel ? <p className="support-selected">Vybraná částka: {selectedLabel}</p> : null}
          {error ? (
            <p id="support-amount-error" className="support-error" role="alert">
              {error}
            </p>
          ) : null}

          <p id="support-pending" className="support-pending">
            {PAYMENT_READY
              ? 'Pokračuješ na platební stránku. CheapEats údaje o kartě neukládá. Podpora zůstává dobrovolná a bez protislužby.'
              : 'Možnost podpory se připravuje. Tlačítko teď nespouští skutečnou platbu.'}
          </p>

          <button
            type="submit"
            className="btn btn-primary btn-lg support-submit"
            aria-describedby="support-voluntary support-pending"
          >
            Podpořit CheapEats
          </button>
          <p className="support-status" role="status" aria-live="polite">
            {notice}
          </p>
        </form>
      </section>
    </main>
  )
}
