// Cambi: una riga per valuta usata, col tasso automatico e un campo per fissarlo a mano.
import { useState } from 'react'
import { todayIso } from '../../engine'
import { fetchRates, FX_SUPPORTED, neededCurrencies } from '../../fx'
import { useI18n } from '../../i18n/core'
import { decimalText, parseDecimal } from '../kit/decimal'
import type { SettingsDraft } from './draft'

export function FxSection({ d: { data, draft, edit, flash } }: { d: SettingsDraft }) {
  const { t, date, lang } = useI18n()
  const [extraFx, setExtraFx] = useState<string[]>([])
  const [fxBusy, setFxBusy] = useState(false)
  async function updateRates(extra: string[] = []) {
    setFxBusy(true)
    try {
      const { rates, date: day } = await fetchRates(draft.currency, [...neededCurrencies(data), ...extraFx, ...extra])
      edit(s => { s.fxRates = { ...s.fxRates, ...rates }; if (day) s.fxDate = todayIso() })
    } catch { flash(t('settings.fxError'), true) } finally { setFxBusy(false) }
  }
  const fxList = [...new Set([...neededCurrencies(data), ...Object.keys(draft.fxManual ?? {}), ...extraFx])]
    .filter(c => c !== draft.currency).sort()

  return (
    <section className="group">
      <h2 className="group-title">{t('settings.fx')}</h2>
      <ul className="group-list">
        {fxList.map(c => (
          <li key={c}><label className="row">
            <span className="row-main"><span className="fx-code">1 {c}</span>
              <small>{t('settings.fxAuto')}: {data.settings.fxRates[c] != null ? decimalText(data.settings.fxRates[c], lang) : '—'} {draft.currency}</small></span>
            <input className="row-input row-fx" aria-label={`${t('settings.fxManual')} ${c}`} placeholder={t('settings.fxManual')} inputMode="decimal"
                   defaultValue={draft.fxManual?.[c] != null ? decimalText(draft.fxManual[c], lang) : ''}
                   onChange={e => edit(s => {
                     // un cambio: un punto o una virgola soli sono sempre decimali («1.206» non è milleduecentosei)
                     const v = parseDecimal(e.target.value)
                     const m = { ...(s.fxManual ?? {}) }
                     if (v && v > 0) m[c] = v; else delete m[c]
                     s.fxManual = m
                   })} />
          </label></li>
        ))}
        <li><button type="button" className="row" disabled={fxBusy} onClick={() => void updateRates()}>
          <span className="row-main"><span className="add-row">{t('settings.fxUpdate')}</span></span>
          <span className="row-value">{data.settings.fxDate ? t('settings.fxDate', { date: date(data.settings.fxDate, { day: 'numeric', month: 'short' }) }) : t('settings.fxNever')}</span>
        </button></li>
        <li><label className="row">
          <span className="row-main"><span className="add-row">+ {t('settings.fxAdd')}</span></span>
          {/* la scelta della valuta: il menu del sistema si apre toccando la riga */}
          <select className="row-cover" aria-label={t('settings.fxAdd')} value="" onChange={e => {
            const c = e.target.value
            if (!c) return
            setExtraFx(x => [...x, c])
            void updateRates([c])
          }}>
            <option value="">+ {t('settings.fxAdd')}</option>
            {FX_SUPPORTED.filter(c => c !== draft.currency && !fxList.includes(c)).map(c => <option key={c}>{c}</option>)}
          </select>
        </label></li>
      </ul>
      <p className="group-foot">{t('settings.fxHint')}</p>
    </section>
  )
}
