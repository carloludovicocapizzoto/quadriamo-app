import { useMemo, useState } from 'react'
import { dailySpending, type MonthResult, type Settings } from '../engine'
import { useI18n } from '../i18n/core'
import { BUCKET_COLORS, bucketName } from './names'

const R = 80, C = 2 * Math.PI * R, R2 = 58, C2 = 2 * Math.PI * R2

/** Ciambella interattiva dei quattro portafogli: tocca una parte per vedere quanto resta e quanto è stato usato. */
export function BucketDonut({ r, settings }: { r: MonthResult; settings: Settings }) {
  const { t, money } = useI18n()
  const cur = settings.currency
  const [sel, setSel] = useState(0)
  const rows = r.buckets
  // spicchi: quanto è disponibile in ogni parte (se il mese è vuoto, la regola stessa)
  const weights = rows.map(b => Math.max(0, b.available))
  const tot = weights.reduce((a, b) => a + b, 0)
  const w = tot > 0 ? weights.map(x => x / tot) : rows.map(b => b.bucket.share)
  const segs = w.map((f, i) => ({ i, start: w.slice(0, i).reduce((a, x) => a + x, 0) * C, len: f * C }))
  const b = rows[sel]
  const used = b.available > 0 ? Math.min(1, b.spent / b.available) : b.spent > 0 ? 1 : 0
  return (
    <div className="hc-grid">
        <div className="hc-donut">
          <svg viewBox="0 0 200 200" role="img" aria-label={t('home.title')}>
            <g transform="rotate(-90 100 100)" className="donut-in">
              {segs.map(s => (
                <circle key={s.i} cx="100" cy="100" r={R} fill="none" stroke={BUCKET_COLORS[s.i]}
                  strokeWidth={s.i === sel ? 26 : 20} strokeDasharray={`${Math.max(0, s.len - 2)} ${C}`} strokeDashoffset={-s.start}
                  className={`seg${s.i === sel ? ' on' : ''}`} style={{ animationDelay: `${s.i * 90}ms` }}
                  onClick={() => setSel(s.i)} />
              ))}
              <circle cx="100" cy="100" r={R2} fill="none" stroke="var(--line)" strokeWidth="7" />
              <circle cx="100" cy="100" r={R2} fill="none" stroke={BUCKET_COLORS[sel]} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${used * C2} ${C2}`} className="progress" />
            </g>
          </svg>
          <div className="hc-center" key={sel}>
            <span className="small muted">{bucketName(b.bucket, t)}</span>
            <strong className={b.remaining < 0 ? 'bad-text' : ''}>{money(b.remaining, cur)}</strong>
            <span className="small muted">{t('home.left')}</span>
            <span className="hc-used" style={{ color: BUCKET_COLORS[sel] }}>{t('home.used', { n: Math.round(used * 100) })}</span>
          </div>
        </div>
        <ul className="hc-legend" aria-label={t('home.tap')}>
          {rows.map((x, i) => (
            <li key={x.bucket.id}>
              <button className={i === sel ? 'on' : ''} aria-pressed={i === sel} onClick={() => setSel(i)}>
                <i style={{ background: BUCKET_COLORS[i] }} />
                <span>{bucketName(x.bucket, t)}</span>
                <b className={x.remaining < 0 ? 'bad-text' : ''}>{money(x.remaining, cur)}</b>
              </button>
            </li>
          ))}
          <li className="muted small">{t('home.tap')}</li>
        </ul>
      </div>

  )
}

/** Spese giorno per giorno con il totale da inizio mese: tocca (o passa sopra) un giorno per i dettagli. */
export function DailyChart({ r, settings, today }: { r: MonthResult; settings: Settings; today: string }) {
  const { t, money, date } = useI18n()
  const cur = settings.currency
  const days = useMemo(() => dailySpending(r), [r])
  const maxDay = Math.max(1, ...days.map(d => d.spent))
  const maxCum = Math.max(1, days.at(-1)?.cumulative ?? 0)
  const todayIdx = days.findIndex(d => d.day === today)
  const [day, setDay] = useState<number | null>(null)
  const shown = day ?? (todayIdx >= 0 ? todayIdx : days.length - 1)
  const line = days.map((d, i) => `${i + 0.5},${100 - (d.cumulative / maxCum) * 92}`).join(' ')
  const anySpend = days.some(d => d.spent > 0)
  if (!anySpend) return <p className="muted small">{t('home.noSpend')}</p>
  return (
    <>
        <p className="hc-tip" aria-live="polite">{t('home.dayTip', { date: date(days[shown].day, { day: 'numeric', month: 'short' }),
          amount: money(days[shown].spent, cur), total: money(days[shown].cumulative, cur) })}</p>
        <div className="hc-bars" role="img" aria-label={t('home.daily')} onMouseLeave={() => setDay(null)}>
          <svg className="hc-line" viewBox={`0 0 ${days.length} 100`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={line} />
          </svg>
          {days.map((d, i) => (
            <button key={d.day} type="button" className={`col${i === shown ? ' on' : ''}${i === todayIdx ? ' today' : ''}`}
                    aria-label={date(d.day, { day: 'numeric', month: 'short' })} onClick={() => setDay(i)} onMouseEnter={() => setDay(i)}>
              {d.spent > 0 && <span className="bar" style={{ height: `${Math.max(3, (d.spent / maxDay) * 92)}%`, animationDelay: `${i * 15}ms` }} />}
            </button>
          ))}
        </div>
        <p className="hc-legend-line small muted"><i className="lg-bar" /> {t('home.legendDay')} · <i className="lg-line" /> {t('home.legendCum')}</p>
    </>
  )
}

/** Mese: ciambella e spese giorno per giorno insieme (in cima alla scheda Mese). */
export function HomeCharts({ r, settings, today }: { r: MonthResult; settings: Settings; today: string }) {
  const { t } = useI18n()
  return (
    <section className="card home-charts">
      <h3 className="h-plain">{t('home.title')}</h3>
      <BucketDonut r={r} settings={settings} />
      <h4 className="hc-sub">{t('home.daily')}</h4>
      <DailyChart r={r} settings={settings} today={today} />
    </section>
  )
}
