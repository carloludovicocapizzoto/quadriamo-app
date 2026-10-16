// Impostazioni generali: lingua, valuta, giorno d'inizio del mese.
import { LANGS, useI18n, type Lang } from '../../i18n/core'
import { CURRENCIES } from '../names'
import type { SettingsDraft } from './draft'

export function GeneralSection({ d: { draft, edit, errors } }: { d: SettingsDraft }) {
  const { t, lang, setLang } = useI18n()
  return (
    <section className="card">
      <h3 className="h-plain">{t('settings.general')}</h3>
      <label className="field">
        <span>{t('lang.label')}</span>
        <select value={lang} onChange={e => setLang(e.target.value as Lang)}>
          {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.currency')}</span>
        <select value={draft.currency} onChange={e => edit(s => { s.currency = e.target.value })}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.startDay')}</span>
        <input type="number" inputMode="numeric" min={1} max={28} value={draft.monthStartDay}
               aria-invalid={errors.includes('startDay')}
               onChange={e => edit(s => { s.monthStartDay = Number(e.target.value) })} />
        <small className="muted">{t('settings.startDayHint')}</small>
      </label>
      </section>
  )
}
