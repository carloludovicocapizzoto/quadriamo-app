import { useEffect, useRef, useState } from 'react'
import { STREAK_MILESTONES, type Streak } from '../engine'
import { useI18n } from '../i18n/core'

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
