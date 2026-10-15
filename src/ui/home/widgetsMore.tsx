// Widget della Home, seconda parte: patrimonio, fondo di emergenza, ultimi 7 giorni, ultime attività, statistiche,
// prossimi pagamenti, investimenti, notizie, mercati, eventi, missioni, consigli, traguardi, obiettivi del mese.
// Ognuno usa dati che ci sono già (sul telefono o pubblici); se non ha niente da dire non compare.
import { useEffect, useState, type ReactNode } from 'react'
import { badges, capitalAdvice, capitalSummary, daysBetween, forecastMonth, goalStatus, lastDays, marketsNow, missions, portfolioSummary,
  type ClassifiedTx } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { loadHub, type HubItem } from '../../news/hub'
import { buildSections } from '../../news/sections'
import { supabase } from '../../sync/client'
import { Icon } from '../Icon'
import { Meter } from '../kit/Meter'
import { Money } from '../kit/Money'
import { categoryName } from '../names'
import { TxRow } from '../TxRow'
import type { WidgetCtx } from './widgets'

const k = (s: string) => s as keyof Dict
type Box = (body: ReactNode, more?: () => void) => ReactNode

const essentialsMonth = (c: WidgetCtx) => (c.r.buckets.find(b => b.bucket.id === 'essentials')?.available ?? 0) + (c.r.paidFirst ?? 0)

export function Wealth({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t } = useI18n()
  const cur = c.data.settings.currency
  const cap = c.data.settings.capital?.parts.length ? capitalSummary(c.data.settings.capital).total : 0
  const inv = c.data.investments ? portfolioSummary(c.data.investments, c.data.settings, c.today).value : 0
  if (!cap && !inv) return null
  return box(<>
    <Money className="outcome-amount" value={cap + inv} currency={cur} />
    <p className="outcome-label">{t('hw.wealthLabel')}</p>
    <dl className="outcome-row n2"><div><dt>{t('prof.capital')}</dt><dd><Money value={cap} currency={cur} /></dd></div>
      <div><dt>{t('nav.investments')}</dt><dd><Money value={inv} currency={cur} /></dd></div></dl>
  </>)
}

export function Emergency({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, money } = useI18n()
  const parts = c.data.settings.capital?.parts.filter(p => p.kind === 'emergency') ?? []
  const amount = parts.reduce((a, p) => a + Math.max(0, p.amount), 0), month = essentialsMonth(c)
  if (!amount || !month) return null
  const months = amount / month
  return box(<>
    <p className="w-big">{t('hw.emergencyMonths', { n: months.toFixed(1).replace('.', ',') })}</p>
    <Meter value={months / 3} label={t('hw.emergency')} />
    <p className="small muted">{t('hw.emergencyText', { amount: money(amount, c.data.settings.currency) })}</p>
  </>)
}

export function Week({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, money } = useI18n()
  const w = lastDays(c.r.transactions, c.today)
  const cur = c.data.settings.currency
  const cat = c.data.settings.categories.find(x => x.id === w.topCategory)
  const diff = w.spent - w.before
  return box(<>
    <p className="w-big"><Money value={w.spent} currency={cur} /></p>
    <p className="small muted">{t('hw.weekSpent', { n: w.count })}{w.before > 0 && <> · {t(diff <= 0 ? 'hw.weekLess' : 'hw.weekMore', { amount: money(Math.abs(diff), cur) })}</>}</p>
    {cat && <p className="small muted">{t('hw.weekTop', { cat: categoryName(cat, t), amount: money(w.topAmount, cur) })}</p>}
  </>)
}

export function Recent({ c, box }: { c: WidgetCtx; box: Box }) {
  const list = c.r.transactions.filter(x => !x.upcoming).slice(-5).reverse()
  if (!list.length) return null
  return box(<ul className="tx-list">{list.map(tx => <TxRow key={tx.id} tx={tx} settings={c.data.settings} onOpen={c.onOpen} />)}</ul>, c.onAll)
}

export function Stats({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, lang } = useI18n()
  const cur = c.data.settings.currency
  const days = Math.max(1, daysBetween(c.r.period.start, c.today < c.r.period.end ? c.today : c.r.period.end) + 1)
  const pct = c.r.income > 0 ? new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(Math.max(0, c.r.saved) / c.r.income) : '—'
  return box(<dl className="outcome-row">
    <div><dt>{t('hw.statsPerDay')}</dt><dd><Money value={c.r.spent / days} currency={cur} /></dd></div>
    <div><dt>{t('hw.statsSaved')}</dt><dd>{pct}</dd></div>
    <div><dt>{t('hw.statsCount')}</dt><dd>{c.r.transactions.filter(x => !x.upcoming).length}</dd></div>
  </dl>)
}

export function Upcoming({ c, box }: { c: WidgetCtx; box: Box }) {
  const { date } = useI18n()
  const list = c.r.transactions.filter(x => x.upcoming).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 4)
  if (!list.length) return null
  // l'importo dei pagamenti futuri non è ancora contato nel mese: si mostra quello previsto dalla spesa ricorrente
  const planned = (tx: ClassifiedTx) => c.data.settings.recurring.find(r => r.name === tx.description && r.category === tx.category)?.amount ?? 0
  return box(<ul className="group-list">{list.map(tx => (
    <li key={tx.id}><div className="row"><span className="row-main"><span>{tx.description}</span>
      <small>{tx.date ? date(tx.date, { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</small></span>
      <span className="row-value"><Money value={-planned(tx)} currency={c.data.settings.currency} /></span></div></li>))}</ul>)
}

export function Invest({ c, box, open }: { c: WidgetCtx; box: Box; open: () => void }) {
  const { t, money } = useI18n()
  if (!c.data.investments?.holdings.length) return null
  const o = portfolioSummary(c.data.investments, c.data.settings, c.today)
  const cur = c.data.settings.currency
  const top = [...o.holdings].filter(h => h.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3)
  return box(<ul className="group-list">{top.map(h => (
    <li key={h.holding.id}><div className="row"><span className="row-main"><span>{h.holding.name}</span>
      <small className={(h.gain ?? 0) < 0 ? 'bad-text' : ''}>{t('inv.gain')} {h.gain != null ? money(h.gain, cur) : '—'}</small></span>
      <span className="row-value"><Money value={h.value ?? 0} currency={cur} /></span></div></li>))}</ul>, open)
}

export function News({ c, box, open }: { c: WidgetCtx; box: Box; open: () => void }) {
  const { lang } = useI18n()
  const [items, setItems] = useState<HubItem[] | null>(null)
  useEffect(() => { let alive = true; void loadHub(lang).then(h => { if (alive) setItems(h) }); return () => { alive = false } }, [lang])
  if (!items?.length) return null
  const now = Date.parse(c.today + 'T12:00:00')
  const stories = buildSections(items.filter(x => x.lang === lang || x.lang === 'en'), now, lang, {}).flatMap(s => s.stories).slice(0, 3)
  return box(<ul className="w-news">{stories.map(s => (
    <li key={s.lead.id}><a href={s.lead.link} target="_blank" rel="noopener noreferrer">
      <span className="w-news-text"><b>{s.lead.title}</b><small>{s.lead.source.name}</small>{s.lead.excerpt && <span className="w-news-excerpt">{s.lead.excerpt}</span>}</span>
      {s.lead.thumb && <img src={s.lead.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none' }} />}
    </a></li>))}</ul>, open)
}

export function Markets({ box }: { box: Box }) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id) }, [])
  return box(<ul className="group-list">{marketsNow(now).map(m => (
    <li key={m.id}><div className="row"><span className="row-main"><span>{t(k(`mk.${m.id}`))}</span>
      <small>{m.open ? t('mk.closes', { at: m.at }) : t(m.next === 'today' ? 'mk.opens' : m.next === 'tomorrow' ? 'mk.opensTomorrow' : 'mk.opensMonday', { at: m.at })}</small></span>
      <span className={`mk-dot${m.open ? ' on' : ''}`} aria-label={t(m.open ? 'mk.open' : 'mk.closedShort')} /></div></li>))}</ul>)
}

export function Events({ c, box }: { c: WidgetCtx; box: Box }) {
  const { lang, date } = useI18n()
  const [rows, setRows] = useState<{ id: number; day: string; title_it: string; title_en: string; title_fr: string | null; title_es: string | null; url: string | null }[] | null>(null)
  useEffect(() => {
    if (!supabase) return
    void supabase.from('econ_events').select('*').gte('day', c.today).order('day').limit(3).then(({ data }) => setRows(data ?? []), () => setRows([]))
  }, [c.today])
  if (!rows?.length) return null
  return box(<ul className="group-list">{rows.map(e => {
    const title = (lang === 'it' ? e.title_it : lang === 'fr' ? e.title_fr : lang === 'es' ? e.title_es : null) || e.title_en
    const body = <><span className="row-main"><span>{title}</span><small>{date(e.day, { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
      {e.url && <Icon name="external" size={16} className="row-chev" />}</>
    return <li key={e.id}>{e.url ? <a className="row" href={e.url} target="_blank" rel="noopener noreferrer">{body}</a> : <div className="row">{body}</div>}</li>
  })}</ul>)
}

export function Missions({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t } = useI18n()
  const todays = c.r.transactions.filter(x => !x.upcoming && x.date === c.today)
  const spentToday = todays.filter(x => x.type === 'expense').reduce((a, x) => a + (x.amountIn ?? 0), 0)
  const weekAgo = new Date(Date.parse(c.today) - 6 * 864e5).toISOString().slice(0, 10)
  const savedThisWeek = (c.data.goals ?? []).some(g => g.contributions.some(x => x.amount > 0 && x.date >= weekAgo))
    || c.r.transactions.some(x => x.type === 'saving' && !x.upcoming && (x.date ?? '') >= weekAgo)
  const list = missions({ loggedToday: !!c.streak?.doneToday || todays.length > 0, spentToday, dailyAllowance: c.daily, streak: c.streak?.count ?? 0, savedThisWeek })
  return box(<ul className="group-list w-missions">{list.map(m => (
    <li key={m.id} className={m.done ? 'done' : ''}><div className="row">
      <span className="w-check" aria-hidden="true">{m.done && <Icon name="check" size={14} />}</span>
      <span className="row-main"><span>{t(k(`ms.${m.id}`))}</span><small>{t(m.when === 'day' ? 'ms.today' : 'ms.week')}</small></span></div></li>))}</ul>)
}

export function Tips({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, money } = useI18n()
  const cur = c.data.settings.currency
  const end = forecastMonth(c.r, c.today)?.projectedLeftOver ?? null
  const out: string[] = []
  if (c.data.settings.capital?.parts.length) for (const a of capitalAdvice(c.data.settings.capital, end, essentialsMonth(c))) {
    out.push(a.id === 'cover' ? t('cap.adv.cover', { deficit: money(a.deficit, cur), part: a.part, available: money(a.available, cur) })
      : a.id === 'protectedOnly' ? t('cap.adv.protectedOnly', { deficit: money(a.deficit, cur), usable: money(a.usable, cur) })
      : a.id === 'emergencyLow' ? t('cap.adv.emergencyLow', { months: String(a.months).replace('.', ',') }) : t('cap.adv.used', { pct: a.pct }))
  } else if (end != null && end < 0) out.push(t('tip.overMonth', { amount: money(-end, cur) }))
  if (!(c.data.goals ?? []).some(g => !g.removed)) out.push(t('tip.noGoal'))
  if (!out.length) return null
  return box(<ul className="w-tips">{out.slice(0, 3).map(x => <li key={x}>{x}</li>)}</ul>)
}

export function Badges({ c, box, open }: { c: WidgetCtx; box: Box; open: () => void }) {
  const { t } = useI18n()
  const list = badges({ txCount: c.data.transactions.length, bestStreak: c.streak?.best ?? 0, imported: Object.keys(c.data.importDone ?? {}).length > 0,
    goalsDone: (c.data.goals ?? []).filter(g => !g.removed && goalStatus(g, c.today).done).length, months: [] })
  const done = list.filter(b => b.done).length
  const next = list.filter(b => !b.done).sort((a, b) => b.progress - a.progress)[0]
  return box(<>
    <p className="w-big">{t('hw.badgesDone', { done, total: list.length })}</p>
    <Meter value={done / list.length} label={t('hw.badges')} />
    {next && <p className="small muted">{t('hw.badgesNext', { name: t(k(`badge.${next.id}`)), pct: Math.round(next.progress * 100) })}</p>}
  </>, open)
}

export function MonthGoals({ c, box, open }: { c: WidgetCtx; box: Box; open: () => void }) {
  const { t, money } = useI18n()
  const cur = c.data.settings.currency
  const list = (c.data.goals ?? []).filter(g => !g.removed).map(g => ({ g, s: goalStatus(g, c.today) })).filter(x => !x.s.done && x.s.perMonth)
  if (!list.length) return null
  const month = c.today.slice(0, 7)
  return box(<ul className="group-list goal-list">{list.slice(0, 3).map(({ g, s }) => {
    const put = g.contributions.filter(x => x.date.startsWith(month)).reduce((a, x) => a + x.amount, 0)
    return <li key={g.id}><div className="row"><span className="row-main">
      <span className="goal-line"><span className="goal-name">{g.name}</span><span className="goal-amt"><Money value={put} currency={cur} /></span></span>
      <Meter value={put / (s.perMonth ?? 1)} label={g.name} /><small>{t('hw.monthGoalOf', { amount: money(s.perMonth ?? 0, cur) })}</small>
    </span></div></li>
  })}</ul>, open)
}
