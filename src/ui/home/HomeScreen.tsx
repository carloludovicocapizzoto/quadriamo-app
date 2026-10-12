import { useMemo, useState } from 'react'
import { daysBetween, dailyMissions, todayBudget, type BucketRow, type ClassifiedTx, type Mission, type MonthResult, type Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import type { AppData } from '../../store/state'
import { useStore } from '../../store/context'
import { Icon, type IconName } from '../Icon'
import { tap, useCountUp } from '../kit/motion'
import { Ring } from '../kit/Ring'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName } from '../names'
import { TxRow } from '../TxRow'
import { HomeView } from '../HomeView'

/** Home: il numero del giorno, le scorciatoie, le quattro parti, le missioni, le ultime attività e i widget scelti. */
export function HomeScreen({ data, r, today, streak, reviewed, onAdd, onOpen, onAll, onImport, onShared, onAnalysis }: {
  data: AppData; r: MonthResult; today: string; streak: Streak | null; reviewed: boolean
  onAdd: (kind: 'expense' | 'income') => void; onOpen: (tx: ClassifiedTx) => void; onAll: () => void; onImport: () => void
  onShared: () => void; onAnalysis: () => void
}) {
  const { t, money } = useI18n()
  const { dispatch } = useStore()
  const s = data.settings, cur = s.currency
  const budget = useMemo(() => todayBudget(r, s, today), [r, s, today])
  const missions = useMemo(() => dailyMissions(r, s, today, { doneToday: !!streak?.doneToday, inbox: data.inbox?.length ?? 0, reviewed }),
    [r, s, today, streak?.doneToday, data.inbox?.length, reviewed])
  const [part, setPart] = useState<BucketRow | null>(null)
  const left = useCountUp(budget.left)
  const dayN = daysBetween(r.period.start, today) + 1, total = daysBetween(r.period.start, r.period.end) + 1
  const hasPlan = budget.parts.length > 0 && r.income > 0

  return (
    <div className="home2">
      {/* il numero del giorno */}
      <section className={`hero${hasPlan ? '' : ' empty'}`}>
        <p className="hero-eyebrow">{t('w.today')}</p>
        {hasPlan ? <>
          <p className="hero-amount">{money(left, cur)}</p>
          <div className="hero-parts">
            {budget.parts.map(p => {
              const b = s.buckets.find(x => x.id === p.bucketId)!
              return <span key={p.bucketId}>{bucketName(b, t)} <b>{p.free < 0 ? t('home.overShort') : money(p.perDay, cur)}</b></span>
            })}
          </div>
          <div className="hero-day"><span style={{ width: `${(dayN / total) * 100}%` }} /></div>
          <p className="hero-foot">{t('home.dayOf', { n: dayN, total })}{budget.spent > 0 ? ` · ${t('home.spentToday', { amount: money(budget.spent, cur) })}` : ''}</p>
        </> : <>
          <p className="hero-empty">{t('home.noSalary')}</p>
          <button className="btn hero-btn" onClick={() => onAdd('income')}>{t('home.addSalary')}</button>
        </>}
      </section>

      {/* scorciatoie */}
      <div className="qa">
        <QA icon="plus" label={t('qa.expense')} onClick={() => onAdd('expense')} />
        <QA icon="down" label={t('qa.income')} onClick={() => onAdd('income')} />
        <QA icon="check" label={streak?.doneToday ? t('qa.done') : t('qa.noSpend')} done={!!streak?.doneToday}
            onClick={() => { if (!streak?.doneToday) dispatch({ type: 'checkIn' }) }} />
        <QA icon="upload" label={t('qa.import')} onClick={onImport} badge={data.inbox?.length || undefined} />
      </div>

      {/* le quattro parti */}
      <h2 className="sec-title">{t('home.parts')}</h2>
      <div className="parts">
        {r.buckets.map((b, i) => {
          const used = b.available > 0 ? Math.max(0, Math.min(1, 1 - b.remaining / b.available)) : 0
          return (
            <button key={b.bucket.id} className="part" style={{ ['--pc' as string]: BUCKET_COLORS[i], animationDelay: `${i * 50}ms` }}
                    onClick={() => { tap(); setPart(b) }}>
              <span className="part-top"><span className="part-name">{bucketName(b.bucket, t)}</span>
                <Ring value={used} size={34} stroke={4} color={BUCKET_COLORS[i]} /></span>
              <span className={`part-amount${b.remaining < 0 ? ' bad-text' : ''}`}>{money(b.remaining, cur)}</span>
              <span className="part-sub">{t('home.used', { n: Math.round(used * 100) })}</span>
            </button>
          )
        })}
      </div>

      {/* missioni del giorno */}
      <Missions list={missions} cur={cur} onAction={m => {
        if (m.id === 'log') onAdd('expense')
        else if (m.id === 'inbox') onImport()
        else if (m.id === 'review') onAnalysis()
      }} />

      {/* attività */}
      <div className="sec-head"><h2 className="sec-title">{t('home.activity')}</h2>
        <button className="link-btn" onClick={onAll}>{t('w.seeAll')}<Icon name="chevron" size={16} /></button></div>
      <Activity r={r} today={today} settings={s} onOpen={onOpen} />

      {/* widget scelti dall'utente */}
      <HomeView data={data} r={r} today={today} onOpen={onOpen} onAll={onAll} onShared={onShared} />

      <Sheet open={!!part} onClose={() => setPart(null)} title={part ? bucketName(part.bucket, t) : ''}>
        {part && <PartDetail b={part} r={r} cur={cur} color={BUCKET_COLORS[r.buckets.indexOf(part)]} onOpen={tx => { setPart(null); onOpen(tx) }}
                             onAll={() => { setPart(null); onAll() }} settings={s} />}
      </Sheet>
    </div>
  )
}

function QA({ icon, label, onClick, done, badge }: { icon: IconName; label: string; onClick: () => void; done?: boolean; badge?: number }) {
  return (
    <button className={`qa-btn${done ? ' done' : ''}`} onClick={() => { tap(); onClick() }}>
      <span className="qa-ico"><Icon name={icon} size={22} />{badge ? <em className="nav-badge">{badge}</em> : null}</span>
      <span>{label}</span>
    </button>
  )
}

function Missions({ list, cur, onAction }: { list: Mission[]; cur: string; onAction: (m: Mission) => void }) {
  const { t, money } = useI18n()
  const done = list.filter(m => m.done).length
  return (
    <section className="card missions">
      <div className="sec-head"><h2 className="sec-title">{t('home.missions')}</h2><span className="pill-count">{done}/{list.length}</span></div>
      <ul>
        {list.map(m => (
          <li key={m.id} className={m.done ? 'done' : ''}>
            <button onClick={() => { if (!m.done) onAction(m) }} disabled={m.done && m.id !== 'under'}>
              <span className="m-ico"><Icon name={m.done ? 'check' : ({ log: 'edit', under: 'chart', inbox: 'upload', review: 'growth' } as const)[m.id]} size={18} /></span>
              <span className="m-body">
                <b>{t(`mis.${m.id}` as keyof Dict, { n: m.value ?? 0 })}</b>
                {m.id === 'under' && m.limit != null && <small>{t('mis.underDetail', { value: money(m.value ?? 0, cur), limit: money(m.limit, cur) })}</small>}
                <span className="m-bar"><span style={{ width: `${(m.done && m.id !== 'under' ? 1 : m.progress) * 100}%` }} className={m.id === 'under' && !m.done ? 'bad' : ''} /></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {done === list.length && <p className="small good-text m-all">{t('mis.allDone')}</p>}
    </section>
  )
}

function Activity({ r, today, settings, onOpen }: { r: MonthResult; today: string; settings: AppData['settings']; onOpen: (tx: ClassifiedTx) => void }) {
  const { t, date } = useI18n()
  const list = r.transactions.filter(x => !x.upcoming && x.date && x.date <= today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 8)
  if (!list.length) return <p className="muted small empty-note">{t('w.noRecent')}</p>
  const groups: { day: string; items: ClassifiedTx[] }[] = []
  for (const tx of list) {
    const g = groups.at(-1)
    if (g && g.day === tx.date) g.items.push(tx); else groups.push({ day: tx.date!, items: [tx] })
  }
  const label = (d: string) => d === today ? t('day.today') : daysBetween(d, today) === 1 ? t('day.yesterday') : date(d, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="card activity">
      {groups.map(g => (
        <div key={g.day}>
          <p className="day-label">{label(g.day)}</p>
          <ul className="tx-list">{g.items.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
        </div>
      ))}
    </section>
  )
}

function PartDetail({ b, r, cur, color, settings, onOpen, onAll }: {
  b: BucketRow; r: MonthResult; cur: string; color: string; settings: AppData['settings']; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t, money } = useI18n()
  const used = b.available > 0 ? Math.max(0, Math.min(1, 1 - b.remaining / b.available)) : 0
  const txs = (r.spendingByBucket[b.bucket.id] ?? []).filter(x => !x.upcoming).slice(-6).reverse()
  return <>
    <div className="pd-top">
      <Ring value={used} size={96} stroke={9} color={color}><b>{Math.round(used * 100)}%</b></Ring>
      <dl className="pd-stats">
        <div><dt>{t('bucket.available')}</dt><dd>{money(b.available, cur)}</dd></div>
        <div><dt>{t('bucket.spent')}</dt><dd>{money(b.spent, cur)}</dd></div>
        <div><dt>{t('bucket.remaining')}</dt><dd className={b.remaining < 0 ? 'bad-text' : 'good-text'}>{money(b.remaining, cur)}</dd></div>
      </dl>
    </div>
    <p className="day-label">{t('part.last')}</p>
    {txs.length ? <ul className="tx-list">{txs.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
      : <p className="muted small">{t('month.noSpending')}</p>}
    <button className="btn wide top-gap" onClick={onAll}>{t('w.seeAll')}</button>
  </>
}
