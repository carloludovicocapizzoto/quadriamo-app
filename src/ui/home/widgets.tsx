// I widget della Home: le cose che si guardano appena si apre l'app. Ognuno dice una cosa sola, con un mini grafico
// o un indicatore che informa (non decora). L'utente sceglie quali vedere, in che ordine e di che dimensione.
import type { ReactNode } from 'react'
import { capitalAdvice, capitalSummary, dailySpending, forecastMonth, goalStatus, lastDays, missions, portfolioSummary,
  type ClassifiedTx, type MonthResult, type Streak, KIND_SIDE, addDays, agenda, daysBetween } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import type { AppData } from '../../store/state'
import { navigate } from '../../app/router'
import { Icon } from '../Icon'
import { Meter } from '../kit/Meter'
import { Money } from '../kit/Money'
import { categoryName } from '../names'
import { TxRow } from '../TxRow'
import type { WidgetId } from './catalog'
import { Events, Markets } from './widgetsMore'
import { CalendarMini, Documents, Subscriptions } from './widgetsPlan'
import { Monogram } from '../kit/Monogram'

export interface WidgetCtx {
  data: AppData; r: MonthResult; today: string; streak: Streak | null
  parts: ReactNode                                   // i quattro blocchi (vivono nella Home: aprono il dettaglio); senza entrate niente
  daily: number                                      // quanto si può spendere oggi (il numero del giorno)
  onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}
const k = (s: string) => s as keyof Dict
const essentialsMonth = (c: WidgetCtx) => (c.r.buckets.find(b => b.bucket.id === 'essentials')?.available ?? 0) + (c.r.paidFirst ?? 0)

/** Una linea sottile da una serie di valori (mini grafico): l'ultimo punto è marcato. */
function Spark({ values, dashedFrom }: { values: number[]; dashedFrom?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values), min = Math.min(0, ...values), span = Math.max(1, max - min)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / span) * 28] as const)
  const line = (a: readonly (readonly [number, number])[]) => a.map(p => p.join(',')).join(' ')
  const cut = dashedFrom ?? values.length
  return (
    <svg className="w-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={line(pts.slice(0, cut))} />
      {cut < values.length && <polyline className="dash" points={line(pts.slice(cut - 1))} />}
    </svg>
  )
}

/** Barrette dei giorni (ultimi 7): l'ultima è oggi. */
function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return <div className="w-bars" aria-hidden="true">{values.map((v, i) => <span key={i} className={i === values.length - 1 ? 'now' : ''} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />)}</div>
}

/** Freccia di andamento con la percentuale: verde se va bene (meno spese, più capitale). */
function TrendTag({ delta, base, goodWhenDown }: { delta: number; base: number; goodWhenDown?: boolean }) {
  if (!base) return null
  const pct = Math.round((delta / base) * 100)
  if (!pct) return <span className="w-trend">=</span>
  const good = goodWhenDown ? pct < 0 : pct > 0
  return <span className={`w-trend ${good ? 'good' : 'bad'}`}>{pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%</span>
}

export function Widget({ id, c }: { id: WidgetId; c: WidgetCtx }) {
  const { t, money, date } = useI18n()
  const s = c.data.settings, cur = s.currency
  const box = (body: ReactNode, more?: () => void, attention = false) => (
    <section className={`widget w-${id}${attention ? ' attention' : ''}`}>
      <h2 className="w-title">{t(k(`hw.${id}`))}{more && <button className="w-more" onClick={more} aria-label={t('hw.more')}><Icon name="chevron" size={16} /></button>}</h2>
      {body}
    </section>
  )
  switch (id) {
    case 'parts': return c.parts ? <section className="widget w-parts">{c.parts}</section> : null

    case 'today': {
      // quanto hai speso oggi rispetto al numero del giorno, e le spese di oggi
      const list = c.r.transactions.filter(x => !x.upcoming && x.date === c.today)
      const spent = list.filter(x => x.type === 'expense').reduce((a, x) => a + (x.amountIn ?? 0), 0)
      const over = c.daily > 0 && spent > c.daily
      return box(<>
        <p className="w-big"><Money value={spent} currency={cur} />{c.daily > 0 && <small> {t('hw.todayOf', { amount: money(c.daily, cur) })}</small>}</p>
        {c.daily > 0 && <Meter value={spent / c.daily} color={over ? 'var(--bad)' : undefined} label={t('hw.today')} />}
        {list.length ? <ul className="tx-list">{list.slice(0, 3).map(tx => <TxRow key={tx.id} tx={tx} settings={s} onOpen={c.onOpen} />)}</ul>
          : <p className="w-note">{t('home.nothingToday')}</p>}
      </>, c.onAll, over)
    }

    case 'forecast': {
      // come finisce il mese: la spesa fin qui (linea) e la proiezione a questo ritmo (tratteggio)
      const f = forecastMonth(c.r, c.today)
      if (!f || c.r.income <= 0) return null
      const days = dailySpending(c.r), at = days.findIndex(d => d.day === c.today) + 1
      const perDay = f.variablePerDay, cum = days.slice(0, at).map(d => d.cumulative)
      const proj = days.slice(at).map((_, i) => (cum.at(-1) ?? 0) + perDay * (i + 1))
      const left = f.projectedLeftOver
      return box(<>
        <p className={`w-big${left < 0 ? ' bad-text' : ''}`}><Money value={left} currency={cur} /></p>
        <p className="w-note">{t(left < 0 ? 'ana.endOver' : 'ana.endLeft')}</p>
        <Spark values={[...cum, ...proj]} dashedFrom={cum.length} />
        <p className="w-legend"><span>{t('hw.spentSoFar', { amount: money(f.spentSoFar, cur) })}</span><span>{t('hw.perDay', { amount: money(perDay, cur) })}</span></p>
      </>, () => navigate({ tab: 'analysis', view: 'month' }), left < 0)
    }

    case 'week': {
      const w = lastDays(c.r.transactions, c.today)
      const perDay = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.parse(c.today) - (6 - i) * 864e5).toISOString().slice(0, 10)
        return c.r.transactions.filter(x => x.type === 'expense' && !x.upcoming && x.date === d).reduce((a, x) => a + (x.amountIn ?? 0), 0)
      })
      const cat = s.categories.find(x => x.id === w.topCategory)
      return box(<>
        <p className="w-big"><Money value={w.spent} currency={cur} /> <TrendTag delta={w.spent - w.before} base={w.before} goodWhenDown /></p>
        <Bars values={perDay} />
        <p className="w-note">{cat ? t('hw.weekTop', { cat: categoryName(cat, t), amount: money(w.topAmount, cur) }) : t('hw.weekSpent', { n: w.count })}</p>
      </>)
    }

    case 'upcoming': {
      // i prossimi 30 giorni dal calendario: affitto, bollette, rate, abbonamenti (quelli non ancora fatti)
      const list = agenda(s.events, c.today, addDays(c.today, 29)).filter(x => KIND_SIDE[x.event.kind] === 'out' && !x.done)
      if (!list.length) return null
      const total = list.reduce((a, x) => a + (x.event.amount ?? 0), 0)
      return box(<>
        <p className="w-big"><Money value={total} currency={cur} /><small> {t('hw.upcomingCount', { n: list.length })}</small></p>
        <ul className="w-rows w-up">{list.slice(0, 3).map(x => {
          const n = daysBetween(c.today, x.date)
          return <li key={x.event.id + x.date}><Monogram service={x.event.service} name={x.event.title} size={26} /><span>{x.event.title}</span>
            <small>{n === 0 ? t('now.today') : n === 1 ? t('now.tomorrow') : n <= 7 ? t('now.inDays', { n }) : date(x.date, { day: 'numeric', month: 'short' })}</small>
            {x.event.amount != null ? <Money value={x.event.amount} currency={cur} /> : <span />}</li>
        })}</ul>
      </>, () => navigate({ tab: 'analysis', view: 'calendar' }))
    }

    case 'tips': {
      const end = forecastMonth(c.r, c.today)?.projectedLeftOver ?? null
      const out: string[] = []
      if (s.capital?.parts.length) for (const a of capitalAdvice(s.capital, end, essentialsMonth(c))) {
        out.push(a.id === 'cover' ? t('cap.adv.cover', { deficit: money(a.deficit, cur), part: a.part, available: money(a.available, cur) })
          : a.id === 'protectedOnly' ? t('cap.adv.protectedOnly', { deficit: money(a.deficit, cur), usable: money(a.usable, cur) })
          : a.id === 'emergencyLow' ? t('cap.adv.emergencyLow', { months: String(a.months).replace('.', ',') }) : t('cap.adv.used', { pct: a.pct }))
      } else if (end != null && end < 0) out.push(t('tip.overMonth', { amount: money(-end, cur) }))
      if (!(c.data.goals ?? []).some(g => !g.removed)) out.push(t('tip.noGoal'))
      if (!out.length) return null
      return box(<ul className="w-tips">{out.slice(0, 2).map(x => <li key={x}>{x}</li>)}</ul>, undefined, end != null && end < 0)
    }

    case 'missions': {
      const todays = c.r.transactions.filter(x => !x.upcoming && x.date === c.today)
      const spentToday = todays.filter(x => x.type === 'expense').reduce((a, x) => a + (x.amountIn ?? 0), 0)
      const weekAgo = new Date(Date.parse(c.today) - 6 * 864e5).toISOString().slice(0, 10)
      const saved = (c.data.goals ?? []).some(g => g.contributions.some(x => x.amount > 0 && x.date >= weekAgo))
        || c.r.transactions.some(x => x.type === 'saving' && !x.upcoming && (x.date ?? '') >= weekAgo)
      const list = missions({ loggedToday: !!c.streak?.doneToday || todays.length > 0, spentToday, dailyAllowance: c.daily, streak: c.streak?.count ?? 0, savedThisWeek: saved })
      const done = list.filter(m => m.done).length
      return box(<>
        <p className="w-big">{t('hw.missionsDone', { done, total: list.length })}</p>
        <Meter value={done / list.length} label={t('hw.missions')} />
        <ul className="w-missions">{list.map(m => (
          <li key={m.id} className={m.done ? 'done' : ''}><span className="w-check" aria-hidden="true">{m.done && <Icon name="check" size={12} />}</span>{t(k(`ms.${m.id}`))}</li>))}</ul>
      </>)
    }

    case 'capital': {
      if (!s.capital?.parts.length) return null
      const sum = capitalSummary(s.capital)
      const inv = c.data.investments?.holdings.length ? portfolioSummary(c.data.investments, s, c.today).value : 0
      return box(<>
        <p className="w-big"><Money value={sum.total} currency={cur} /> <TrendTag delta={sum.total - sum.start} base={sum.start} /></p>
        {s.capital.history.length > 1 && <Spark values={s.capital.history.map(h => h.total)} />}
        {/* protetto e utilizzabile come una barra sola divisa in due */}
        <div className="w-split" aria-hidden="true"><span style={{ flex: sum.protected }} /><span style={{ flex: sum.usable }} /></div>
        <p className="w-legend"><span>{t('cap.protected')} {money(sum.protected, cur)}</span><span>{t('cap.usable')} {money(sum.usable, cur)}</span></p>
        {inv != null && inv > 0 && <p className="w-note">{t('hw.withInvest', { amount: money(sum.total + inv, cur) })}</p>}
      </>, () => navigate({ tab: 'profile', page: 'capital' }))
    }

    case 'emergency': {
      const amount = (s.capital?.parts ?? []).filter(p => p.kind === 'emergency').reduce((a, p) => a + Math.max(0, p.amount), 0)
      const month = essentialsMonth(c)
      if (!amount || !month) return null
      const months = amount / month
      return box(<>
        <p className="w-big">{t('hw.emergencyMonths', { n: months.toFixed(1).replace('.', ',') })}</p>
        <Meter value={months / 3} color={months < 3 ? 'var(--b2)' : 'var(--good)'} label={t('hw.emergency')} />
        <p className="w-note">{t('hw.emergencyText', { amount: money(amount, cur) })}</p>
      </>, () => navigate({ tab: 'profile', page: 'capital' }), months < 1)
    }

    case 'goals': {
      const goals = (c.data.goals ?? []).filter(g => !g.removed).slice(0, 3)
      if (!goals.length) return null
      const month = c.today.slice(0, 7)
      return box(<ul className="w-goals">{goals.map(g => {
        const st = goalStatus(g, c.today), put = g.contributions.filter(x => x.date.startsWith(month)).reduce((a, x) => a + x.amount, 0)
        return <li key={g.id}><span className="goal-line"><span className="goal-name">{g.name}</span><span className="goal-amt">{Math.round(st.pct * 100)}%</span></span>
          <Meter value={st.pct} label={g.name} />
          <small>{st.done ? t('goal.reached') : put > 0 ? t('hw.goalMonth', { amount: money(put, cur) }) : t('goal.of', { amount: money(g.target, cur) })}</small></li>
      })}</ul>, () => navigate({ tab: 'profile', page: 'goals' }))
    }

    case 'streak': {
      if (!c.streak) return null
      const days = new Set(c.data.activity ?? [])
      const week = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(c.today) - (6 - i) * 864e5).toISOString().slice(0, 10))
      return box(<>
        <p className="w-big">{t('hw.streakDays', { n: c.streak.count })}<small> {t('hw.streakBestShort', { n: c.streak.best })}</small></p>
        <div className="w-dots" aria-hidden="true">{week.map(d => <span key={d} className={days.has(d) ? 'on' : ''} />)}</div>
      </>, () => navigate({ tab: 'profile', page: 'progress' }))
    }

    case 'calendar': return <CalendarMini c={c} box={box} />
    case 'subscriptions': return <Subscriptions c={c} box={box} />
    case 'documents': return <Documents c={c} box={box} />
    case 'markets': return <Markets box={b => box(b)} />
    case 'events': return <Events c={c} box={b => box(b)} />
  }
}
