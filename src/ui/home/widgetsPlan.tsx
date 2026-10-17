// Widget della Home che vengono dal calendario: il mese in miniatura (un punto per tipo, i giorni pesanti in rosso),
// gli abbonamenti (quanto costano in un anno, i primi per costo) e i documenti (la prossima scadenza). Ognuno porta
// alla sua pagina; senza dati non compaiono.
import type { ReactNode } from 'react'
import { addDays, agenda, daysBetween, docStatus, makeDate, nextOccurrence, parseDate, periodSummary, recentIncrease, toneOf, yearlyCost } from '../../engine'
import { useI18n } from '../../i18n/core'
import { navigate } from '../../app/router'
import { Monogram } from '../kit/Monogram'
import { Money } from '../kit/Money'
import type { WidgetCtx } from './widgets'

type Box = (body: ReactNode, more?: () => void, attention?: boolean) => ReactNode

export function CalendarMini({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, lang } = useI18n()
  const p = parseDate(c.today)
  const first = makeDate(p.year, p.month, 1), last = makeDate(p.year, p.month + 1, 0)
  const lead = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7
  const items = agenda(c.data.settings.events, first, last)
  if (!items.length) return null
  const sum = periodSummary(items, c.today)
  const heavy = new Set(sum.heavy)
  const days = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i))
  const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 5 + i))))
  return box(<>
    <p className="w-big"><Money value={sum.toPay} currency={c.data.settings.currency} /><small> {t('hw.calendarToPay')}</small></p>
    <div className="w-cal" aria-hidden="true">
      {wd.map((w, i) => <span key={`w${i}`} className="w-cal-wd">{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
      {days.map(d => {
        const tones = [...new Set(items.filter(x => x.date === d).map(x => toneOf(x.event.kind)))]
        return <span key={d} className={`w-cal-d${d === c.today ? ' today' : ''}${heavy.has(d) ? ' heavy' : ''}${d < c.today ? ' past' : ''}`}>
          {parseDate(d).day}<i>{tones.slice(0, 3).map(tn => <b key={tn} className={`tone-${tn}`} />)}</i></span>
      })}
    </div>
  </>, () => navigate({ tab: 'analysis', view: 'calendar' }))
}

export function Subscriptions({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t } = useI18n()
  const subs = c.data.settings.events.filter(e => e.kind === 'subscription' && e.active && e.repeat && nextOccurrence(e, c.today))
  if (!subs.length) return null
  const yearly = subs.reduce((a, e) => a + yearlyCost(e), 0)
  const up = subs.filter(e => recentIncrease(e, c.today) != null).length
  const top = [...subs].sort((a, b) => yearlyCost(b) - yearlyCost(a))
  return box(<>
    <p className="w-big"><Money value={yearly} currency={c.data.settings.currency} /><small> {t('hw.subsYear')}</small></p>
    <div className="w-monos">{top.slice(0, 6).map(e => <Monogram key={e.id} service={e.service} name={e.title} size={30} />)}
      {top.length > 6 && <span className="w-monos-more">+{top.length - 6}</span>}</div>
    <p className="w-note">{up ? t('hw.subsUp', { n: up }) : t('hw.subsCount', { n: subs.length })}</p>
  </>, () => navigate({ tab: 'profile', page: 'yearCost' }), up > 0)
}

export function Documents({ c, box }: { c: WidgetCtx; box: Box }) {
  const { t, date } = useI18n()
  const docs = c.data.settings.events.filter(e => e.kind === 'document').sort((a, b) => a.date.localeCompare(b.date))
  if (!docs.length) return null
  const next = docs[0]
  const s = docStatus(next, c.today)
  return box(<>
    <p className={`w-big w-doc ${s.state}`}>{next.title}</p>
    <p className="w-note">{s.state === 'expired' ? t('doc.expiredAgo', { n: -s.days }) : `${s.days === 0 ? t('doc.today') : t('doc.inDays', { n: s.days })} · ${date(next.date, { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
    {docs.length > 1 && <p className="w-note">{t('hw.docsMore', { n: docs.length - 1 })}</p>}
  </>, () => navigate({ tab: 'profile', page: 'documents' }), s.state !== 'ok')
}
