import { useState } from 'react'
import type { Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import { Flame } from '../Streak'
import { Sheet } from '../kit/Sheet'
import { tap, useCountUp } from '../kit/motion'
import { StreakCalendar } from './StreakCalendar'

/**
 * Barra in alto, sempre visibile: logo, slancio, quanto puoi spendere oggi, profilo.
 * Ogni contatore si tocca e apre un pannello con i dettagli (come i contatori in cima a Duolingo).
 */
export function TopBar({ streak, activity, today, todayLeft, parts, currency, initial, pro, onProfile }: {
  streak: Streak | null; activity: readonly string[]; today: string; todayLeft: number | null
  parts: { name: string; color: string; perDay: number; over: boolean }[]; currency: string; initial: string; pro: boolean; onProfile: () => void
}) {
  const { t, money } = useI18n()
  const [open, setOpen] = useState<'streak' | 'today' | null>(null)
  const left = useCountUp(todayLeft ?? 0)
  return (
    <>
      <header className="topbar">
        <span className="tb-logo" aria-label="Quadriamo"><i /><i /><i /><i /></span>
        {streak && <button className={`tb-chip streak-chip${streak.doneToday ? ' lit' : ''}`} onClick={() => { tap(); setOpen('streak') }} aria-label={t('streak.title')}>
          <Flame /><b>{streak.count}</b></button>}
        {todayLeft != null && <button className="tb-chip today-chip" onClick={() => { tap(); setOpen('today') }} aria-label={t('w.today')}>
          <span className="tb-coin" aria-hidden="true">€</span><b>{money(left, currency).replace(/\s?€|€\s?/, '')}</b></button>}
        <button className={`tb-avatar${pro ? ' pro' : ''}`} onClick={() => { tap(); onProfile() }} aria-label={t('nav.profile')}>{initial}</button>
      </header>

      <Sheet open={open === 'streak'} onClose={() => setOpen(null)}>
        {streak && <div className="sheet-hero">
          <span className={`big-flame${streak.doneToday ? ' lit' : ''}`}><Flame /></span>
          <h2>{streak.count === 1 ? t('streak.one') : t('streak.days', { n: streak.count })}</h2>
          <p className="muted">{streak.doneToday ? t('streak.safe') : streak.atRisk ? t('streak.atRisk') : t('streak.start')}</p>
        </div>}
        <StreakCalendar days={activity} today={today} />
        {streak && <div className="stat-row">
          <div><b>{streak.count}</b><span>{t('prof.current')}</span></div>
          <div><b>{streak.best}</b><span>{t('prof.best')}</span></div>
          <div><b>{activity.length}</b><span>{t('prof.activeDays')}</span></div>
        </div>}
      </Sheet>

      <Sheet open={open === 'today'} onClose={() => setOpen(null)}>
        <div className="sheet-hero">
          <p className="eyebrow">{t('w.today')}</p>
          <h2 className="hero-num">{money(todayLeft ?? 0, currency)}</h2>
          <p className="muted">{t('home.todayHint')}</p>
        </div>
        <ul className="part-list">
          {parts.map(p => <li key={p.name}><i style={{ background: p.color }} /><span>{p.name}</span>
            <b className={p.over ? 'bad-text' : ''}>{p.over ? t('home.overShort') : t('safe.perDay', { amount: money(p.perDay, currency) })}</b></li>)}
        </ul>
      </Sheet>
    </>
  )
}
