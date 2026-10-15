// I widget della Home: le cose che servono appena apri l'app. Ognuno riusa un pezzo che esiste già altrove
// (Analisi, Obiettivi, Profilo); l'utente sceglie quali vedere e in che ordine (Settings.homeWidgets, sincronizzato).
import type { ReactNode } from 'react'
import { capitalSummary, goalStatus, type ClassifiedTx, type MonthResult, type Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { navigate } from '../../app/router'
import { ByCategory } from '../ByCategory'
import { DailyChart } from '../DailyChart'
import { Icon } from '../Icon'
import { Meter } from '../kit/Meter'
import { Money } from '../kit/Money'
import { MonthOutcome } from '../MonthView'
import { CategoryChangesReport } from '../Reports'
import { TxRow } from '../TxRow'
import { Trend } from '../capital/CapitalPage'
import type { WidgetId } from './catalog'

export interface WidgetCtx {
  data: AppData; r: MonthResult; today: string; streak: Streak | null
  parts: ReactNode                                   // i quattro blocchi (vivono nella Home: aprono il dettaglio)
  onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}

/** Un widget: titolo e contenuto. Senza dati da mostrare non compare (niente riquadri vuoti). */
export function Widget({ id, c }: { id: WidgetId; c: WidgetCtx }) {
  const { t, money } = useI18n()
  const s = c.data.settings, cur = s.currency
  const box = (body: ReactNode, more?: () => void) => (
    <section className={`widget w-${id}`}>
      <h2 className="sec-title">{t(`hw.${id}` as 'hw.parts')}</h2>
      {body}
      {more && <button className="row-link" onClick={more}><span>{t('hw.more')}</span><Icon name="chevron" size={18} /></button>}
    </section>
  )
  const spent = c.r.spent > 0
  switch (id) {
    case 'parts': return <section className="widget w-parts">{c.parts}</section>
    case 'today': {
      const list = c.r.transactions.filter(x => !x.upcoming && x.date === c.today)
      return box(<>
        {list.length ? <ul className="tx-list">{list.slice(0, 3).map(tx => <TxRow key={tx.id} tx={tx} settings={s} onOpen={c.onOpen} />)}</ul>
          : <p className="today-none muted">{t('home.nothingToday')}</p>}
      </>, c.onAll)
    }
    case 'forecast': return c.r.income > 0 ? box(<MonthOutcome r={c.r} settings={s} today={c.today} />, () => navigate({ tab: 'analysis', view: 'month' })) : null
    case 'daily': return box(<DailyChart r={c.r} settings={s} today={c.today} />)
    case 'categories': return c.r.byCategory.some(x => x.amount !== 0) ? box(<ByCategory rows={c.r.byCategory} currency={cur} />) : null
    case 'changes': return spent ? box(<CategoryChangesReport r={c.r} txs={c.data.transactions} settings={s} today={c.today} />) : null
    case 'goals': {
      const goals = (c.data.goals ?? []).filter(g => !g.removed).slice(0, 3)
      if (!goals.length) return null
      return box(<ul className="group-list goal-list">{goals.map(g => {
        const st = goalStatus(g, c.today)
        return <li key={g.id}><div className="row"><span className="row-main">
          <span className="goal-line"><span className="goal-name">{g.name}</span><span className="goal-amt"><Money value={st.saved} currency={cur} /></span></span>
          <Meter value={st.pct} label={g.name} /><small>{t('goal.of', { amount: money(g.target, cur) })}</small>
        </span></div></li>
      })}</ul>, () => navigate({ tab: 'profile', page: 'goals' }))
    }
    case 'capital': {
      // il capitale di partenza: quanto c'è, quanto è protetto, quanto è utilizzabile (non entra nel numero del giorno)
      if (!s.capital?.parts.length) return null
      const k = capitalSummary(s.capital)
      return box(<>
        <Money className="outcome-amount" value={k.total} currency={cur} />
        {s.capital.history.length > 1 && <Trend history={s.capital.history} />}
        <dl className="outcome-row">
          <div><dt>{t('cap.protected')}</dt><dd><Money value={k.protected} currency={cur} /></dd></div>
          <div><dt>{t('cap.usable')}</dt><dd><Money value={k.usable} currency={cur} /></dd></div>
          <div><dt>{t('cap.preserved')}</dt><dd>{k.preserved == null ? '—' : `${Math.round(k.preserved * 100)}%`}</dd></div>
        </dl>
      </>, () => navigate({ tab: 'profile', page: 'capital' }))
    }
    case 'streak': return c.streak ? box(<dl className="outcome-row n2 w-streak">
      <div><dt>{t('hw.streakNow')}</dt><dd>{c.streak.count}</dd></div>
      <div><dt>{t('hw.streakBest')}</dt><dd>{c.streak.best}</dd></div>
    </dl>, () => navigate({ tab: 'profile', page: 'progress' })) : null
  }
}
