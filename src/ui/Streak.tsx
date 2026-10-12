import { useEffect, useRef, useState } from 'react'
import { addDays, STREAK_MILESTONES, type Streak } from '../engine'
import { useI18n } from '../i18n/core'
import { Icon } from './Icon'
import { useStore } from '../store/context'

/** Fiamma disegnata (niente emoji: resta uguale su ogni telefono). */
export function Flame() {
  return (
    <svg className="streak-flame" viewBox="0 0 24 32" aria-hidden="true">
      <defs><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB547" /><stop offset="1" stopColor="#F2542D" /></linearGradient></defs>
      <path fill="url(#fl)" d="M12 1c1 5 7 8.5 7 16a7 7 0 0 1-14 0c0-3.6 1.8-6 3.6-7.6-.1 2.2.7 3.8 2.1 4.6C10 9.8 10.6 5 12 1Z" />
      <path fill="#FFE2A8" d="M12 15.5c.5 2.4 3.2 3.6 3.2 6.6a3.2 3.2 0 0 1-6.4 0c0-1.9 1-3 2-3.8-.1 1 .3 1.8 1 2.2-.3-1.8 0-3.4.2-5Z" />
    </svg>
  )
}

/** Slancio in cima alla Home: giorni di fila, gli ultimi 7 giorni e "Oggi niente spese" per tenerlo vivo. */
export function StreakCard({ s, today }: { s: Streak; today: string }) {
  const { t, lang } = useI18n()
  const { dispatch } = useStore()
  const day = (i: number) => new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(`${addDays(today, i - 6)}T12:00:00`))
  const next = STREAK_MILESTONES.find(m => m > s.count)
  return (
    <section className={`card streak${s.doneToday ? ' lit' : ''}${s.atRisk ? ' risk' : ''}`}>
      <div className="streak-top">
        <Flame />
        <div>
          <b className="streak-n">{s.count === 1 ? t('streak.one') : t('streak.days', { n: s.count })}</b>
          <p className="small muted">{s.doneToday ? t('streak.safe') : s.atRisk ? t('streak.atRisk') : t('streak.start')}</p>
        </div>
      </div>
      <ol className="streak-week" aria-label={t('streak.title')}>
        {s.week.map((on, i) => <li key={i} className={`${on ? 'on' : ''}${i === 6 ? ' today' : ''}`}><i />{day(i)}</li>)}
      </ol>
      <div className="streak-foot">
        {!s.doneToday && <button className="btn small-btn" onClick={() => dispatch({ type: 'checkIn' })}><Icon name="check" size={16} />{t('streak.checkIn')}</button>}
        <span className="small muted">{next ? t('streak.next', { n: next }) : ''}{s.best > 1 ? ` · ${t('streak.best', { n: s.best })}` : ''}</span>
      </div>
    </section>
  )
}

/** Piccola festa quando lo slancio cresce (più grande ai traguardi). */
export function StreakCelebration({ s }: { s: Streak | null }) {
  const { t } = useI18n()
  const prev = useRef<number | null>(null)
  const [show, setShow] = useState<number | null>(null)
  useEffect(() => {
    if (!s) return
    const was = prev.current
    prev.current = s.doneToday ? s.count : -1
    if (was == null || !s.doneToday || was === s.count) return
    setShow(s.count)
    const id = setTimeout(() => setShow(null), STREAK_MILESTONES.includes(s.count) ? 3200 : 2200)
    return () => clearTimeout(id)
  }, [s])
  if (show == null) return null
  const big = STREAK_MILESTONES.includes(show)
  return (
    <div className={`streak-pop${big ? ' big' : ''}`} role="status" onClick={() => setShow(null)}>
      <Flame />
      <b>{show === 1 ? t('streak.started') : t('streak.days', { n: show })}</b>
      {big && <span>{t('streak.milestone', { n: show })}</span>}
    </div>
  )
}
