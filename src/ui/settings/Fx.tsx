// Cambi: tassi automatici per le valute usate, con la possibilità di fissarli a mano.
import { useState } from 'react'
import { todayIso } from '../../engine'
import { fetchRates, FX_SUPPORTED, neededCurrencies } from '../../fx'
import { useI18n } from '../../i18n/core'
import { parseAmount } from '../kit/amount'
import type { SettingsDraft } from './draft'

export function FxSection({ d: { data, draft, edit, flash } }: { d: SettingsDraft }) {
  const { t, date } = useI18n()
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
    <section className="card">
      <h3 className="h-plain">{t('settings.fx')}</h3>
      <p className="muted small">{t('settings.fxHint')}</p>
      <p className="small">{data.settings.fxDate ? t('settings.fxDate', { date: date(data.settings.fxDate, { day: 'numeric', month: 'short', year: 'numeric' }) }) : t('settings.fxNever')}</p>
      <ul className="edit-list fx-list">
        {fxList.map(c => (
          <li key={c}>
            <span className="fx-code">1 {c} =</span>
            <span className="muted small">{t('settings.fxAuto')}: {data.settings.fxRates[c] != null ? String(data.settings.fxRates[c]).replace('.', ',') : '—'}</span>
            <input aria-label={`${t('settings.fxManual')} ${c}`} placeholder={t('settings.fxManual')} inputMode="decimal"
                   defaultValue={draft.fxManual?.[c] != null ? String(draft.fxManual[c]).replace('.', ',') : ''}
                   onChange={e => edit(s => {
                     const v = parseAmount(e.target.value)
                     const m = { ...(s.fxManual ?? {}) }
                     if (v && v > 0) m[c] = v; else delete m[c]
                     s.fxManual = m
                   })} />
            <span className="muted small">{draft.currency}</span>
          </li>
        ))}
      </ul>
      <div className="stack-row">
        <button className="btn" disabled={fxBusy} onClick={() => void updateRates()}>{t('settings.fxUpdate')}</button>
        <select aria-label={t('settings.fxAdd')} value="" onChange={e => {
          const c = e.target.value
          if (!c) return
          setExtraFx(x => [...x, c])
          void updateRates([c])
        }}>
          <option value="">+ {t('settings.fxAdd')}</option>
          {FX_SUPPORTED.filter(c => c !== draft.currency && !fxList.includes(c)).map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      </section>
  )
}
