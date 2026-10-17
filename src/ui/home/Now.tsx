// Home → "Adesso": risponde a "cosa devo fare oggi?" come un assistente discreto. Una superficie in vetro sotto il numero
// del giorno (una delle poche: Costituzione, 17/10), un titolo che dice quante cose chiedono un'azione, le prime tre voci
// (engine/now, solo regole) e le altre a richiesta, che si aprono con un'espansione naturale. Ogni voce porta dove serve.
import { useMemo, useState, type ReactNode } from 'react'
import { categoryChanges, isActionable, forecastMonth, nowItems, type MonthResult, type NowItem } from '../../engine'
import { navigate } from '../../app/router'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { categoryName } from '../names'
import { Icon, type IconName } from '../Icon'
import { Monogram } from '../kit/Monogram'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { useEvents } from '../calendar/useEvents'

const SHOWN = 3

export function Now({ data, r, today, hasPlan, onLog }: { data: AppData; r: MonthResult; today: string; hasPlan: boolean; onLog: () => void }) {
  const { t, money } = useI18n()
  const { toggleDone } = useEvents()
  const [open, setOpen] = useState(false)
  // l'ora conta solo per il promemoria serale: si legge all'apertura della Home
  const [hour] = useState(() => new Date().getHours())
  const s = data.settings, cur = s.currency
  const changes = useMemo(() => hasPlan ? categoryChanges(r.ym, data.transactions, s, today, 3, true) : [], [hasPlan, r.ym, data.transactions, s, today])
  const items = useMemo(() => nowItems({
    events: s.events, goals: data.goals, today, hour, changes,
    loggedToday: data.transactions.some(x => x.date === today),
    leftOver: hasPlan ? forecastMonth(r, today)?.projectedLeftOver ?? null : null,
  }), [s.events, data.goals, data.transactions, today, hour, changes, hasPlan, r])
  const todo = items.filter(isActionable).length
  const when = (days: number) => days === 0 ? t('now.today') : days === 1 ? t('now.tomorrow') : t('now.inDays', { n: days })

  const row = (x: NowItem, i: number): ReactNode => {
    let lead: ReactNode, title: ReactNode, detail: ReactNode = null, end: ReactNode = null, go = () => navigate({ tab: 'analysis', view: 'calendar' })
    const ico = (n: IconName, tone = '') => <span className={`now-ico ${tone}`}><Icon name={n} size={18} /></span>
    const mono = (e: { service?: string | null; title: string }) => <Monogram service={e.service} name={e.title} size={32} />
    switch (x.type) {
      case 'late':
        lead = mono(x.event); title = x.event.title; detail = t('now.late', { n: x.days })
        end = <button className="now-act" onClick={ev => { ev.stopPropagation(); tap(); toggleDone(x.event.id, x.date) }}>{t('now.done')}</button>
        break
      case 'today':
        lead = isActionable(x) ? ico('alert', 'warn') : ico('month')
        title = x.events.length === 1 ? t('now.todayOne', { name: x.events[0].title }) : t('now.todayMany', { n: x.events.length })
        detail = x.events.length > 1 ? x.events.slice(0, 3).map(e => e.title).join(' · ') : null
        end = x.amount > 0 ? <Money value={-x.amount} currency={cur} /> : null
        break
      case 'docExpired':
        lead = ico('idcard', 'bad'); title = t('now.docExpired', { name: x.event.title }); detail = t('now.docExpiredD', { n: x.days })
        go = () => navigate({ tab: 'profile', page: 'documents' })
        break
      case 'doc':
        lead = ico('idcard', x.days <= 14 ? 'warn' : ''); title = t('now.doc', { name: x.event.title }); detail = when(x.days)
        go = () => navigate({ tab: 'profile', page: 'documents' })
        break
      case 'pace':
        lead = ico('growth', 'bad'); title = t('now.pace', { amount: money(x.leftOver, cur) }); detail = t('now.paceD')
        go = () => navigate({ tab: 'analysis', view: 'month' })
        break
      case 'nextOut':
        lead = mono(x.event); title = x.event.title; detail = `${t('now.nextOut')} · ${when(x.days)}`
        end = x.event.amount != null ? <Money value={-x.event.amount} currency={cur} /> : null
        break
      case 'price':
        lead = mono(x.event); title = t('now.price', { name: x.event.title, pct: x.pct }); detail = t('now.priceD', { amount: money(x.yearly, cur) })
        go = () => navigate({ tab: 'profile', page: 'yearCost' })
        break
      case 'category':
        lead = ico('chart', 'warn'); title = t('now.category', { name: categoryName(x.change.category, t), pct: x.change.pct ?? 0 })
        detail = t('now.categoryD', { amount: money(x.change.diff, cur) })
        go = () => navigate({ tab: 'analysis', view: 'month' })
        break
      case 'nextIn':
        lead = mono(x.event); title = x.event.title; detail = `${t('now.nextIn')} · ${when(x.days)}`
        end = x.event.amount != null ? <Money className="good-text" value={x.event.amount} currency={cur} /> : null
        break
      case 'log':
        lead = ico('plus'); title = t('now.log'); detail = t('now.logD'); go = onLog
        break
      case 'goal':
        lead = ico('target'); title = t('now.goal', { name: x.goal.name, amount: money(x.left, cur) }); detail = when(x.days)
        go = () => navigate({ tab: 'profile', page: 'goals' })
        break
    }
    return (
      <li key={`${x.type}${i}`} style={{ animationDelay: `${i * 40}ms` }}>
        <div className="now-row" role="button" tabIndex={0} onClick={() => { tap(); go() }} onKeyDown={e => { if (e.key === 'Enter') { tap(); go() } }}>
          {lead}
          <span className="now-main"><span>{title}</span>{detail && <small>{detail}</small>}</span>
          {end && <span className="now-end">{end}</span>}
        </div>
      </li>
    )
  }

  return (
    <section className="glass-card now" aria-label={t('now.title')}>
      <p className="now-eyebrow">{t('now.title')}</p>
      <h2 className="now-head">{todo ? (todo === 1 ? t('now.todoOne') : t('now.todo', { n: todo })) : items.length ? t('now.calm') : t('now.nothing')}</h2>
      {items.length > 0 && <ul className="now-list">{items.slice(0, SHOWN).map(row)}</ul>}
      {items.length > SHOWN && <>
        <div className={`now-more${open ? ' open' : ''}`}><ul className="now-list">{items.slice(SHOWN).map((x, i) => row(x, i + SHOWN))}</ul></div>
        <button className="link-btn now-toggle" aria-expanded={open} onClick={() => { tap(); setOpen(o => !o) }}>
          {open ? t('now.less') : t('now.more', { n: items.length - SHOWN })}</button>
      </>}
    </section>
  )
}
