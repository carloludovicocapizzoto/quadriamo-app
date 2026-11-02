// Impostazioni generali: valuta e giorno d'inizio del mese, una riga ciascuno (la lingua solo nella configurazione iniziale:
// nel Profilo ha la sua pagina in Preferenze).
import { setExpectedIncome } from '../../engine/planContract'
import { monthOf, todayIso, ymKey } from '../../engine'
import { ENV } from '../../env'
import { AmountInput } from '../kit/AmountInput'
import { LANGS, useI18n, type Lang } from '../../i18n/core'
import { CURRENCIES } from '../names'
import type { SettingsDraft } from './draft'

export function GeneralSection({ d: { draft, edit, errors }, wizard }: { d: SettingsDraft; wizard: boolean }) {
  const { t, lang, setLang } = useI18n()
  return (
    <section className="group">
      <h2 className="group-title">{t('settings.general')}</h2>
      <ul className="group-list">
        {wizard && <li><label className="row">
          <span className="row-main"><span>{t('lang.label')}</span></span>
          <select className="row-input row-select" value={lang} onChange={e => setLang(e.target.value as Lang)}>
            {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label></li>}
        <li><label className="row">
          <span className="row-main"><span>{t('settings.currency')}</span></span>
          <select className="row-input row-select" value={draft.currency} onChange={e => edit(s => { s.currency = e.target.value })}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label></li>
        <li><label className="row">
          <span className="row-main"><span>{t('settings.startDay')}</span><small>{t('settings.startDayHint')}</small></span>
          <input className="row-input row-num" type="number" inputMode="numeric" min={1} max={28} value={draft.monthStartDay}
                 aria-invalid={errors.includes('startDay')}
                 onChange={e => edit(s => { s.monthStartDay = Number(e.target.value) })} />
        </label></li>
        {ENV.flags.monthlyPlan && !wizard && <li><label className="row"><span className="row-main"><span>{t('plan.expected')}</span><small>{t('plan.warning')}</small></span><AmountInput className="row-input row-num" defaultValue={(Array.isArray(draft.incomePlans)?draft.incomePlans:[]).filter(x=>x&&x.from<=ymKey(monthOf(todayIso(),draft.monthStartDay))).at(-1)?.amount ?? draft.expectedIncome} onValue={n => { if (n == null || (Number.isFinite(n) && n >= 0)) edit(s=>Object.assign(s,setExpectedIncome(s,ymKey(monthOf(todayIso(),s.monthStartDay)),n??0))) }} /></label></li>}
      </ul>
    </section>
  )
}
