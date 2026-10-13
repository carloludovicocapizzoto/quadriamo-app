import { useMemo, type ReactNode } from 'react'
import { badges, goalStatus, monthOf, monthlyTrend, prevMonth, type Streak } from '../../engine'
import { LANGS, useI18n, type Lang } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import type { AppData } from '../../store/state'
import { useSync } from '../../sync/context'
import { usePlan } from '../../billing/plan'
import { AccountSection } from '../AccountSection'
import { Icon, type IconName } from '../Icon'
import { tap } from '../kit/motion'
import { LegalLinks } from '../LegalLinks'
import { PlanCard, ProGate } from '../Pro'
import { SettingsView } from '../SettingsView'
import { SharedView } from '../shared/SharedView'
import { BetaSection } from '../beta/BetaSection'
import { NewsPushToggle, PushToggle } from '../beta/PushToggle'
import { StreakCalendar } from '../shell/StreakCalendar'
import { GoalsStrip } from '../goals/Goals'
import { Flame } from '../Streak'

import type { ProfilePage } from '../../app/router'
const ROWS: { id: ProfilePage; icon: IconName; label: keyof Dict }[] = [
  { id: 'notifications', icon: 'bell', label: 'prof.notifications' },
  { id: 'plan', icon: 'growth', label: 'prof.plan' },
  { id: 'account', icon: 'user', label: 'prof.account' },
  { id: 'budget', icon: 'chart', label: 'prof.budget' },
  { id: 'recurring', icon: 'month', label: 'prof.recurring' },
  { id: 'rules', icon: 'list', label: 'prof.rules' },
  { id: 'shared', icon: 'users', label: 'prof.shared' },
  { id: 'beta', icon: 'message', label: 'prof.beta' },
  { id: 'language', icon: 'settings', label: 'prof.language' },
  { id: 'data', icon: 'lock', label: 'prof.data' },
]

/** Profilo: chi sei, il tuo slancio, i tuoi obiettivi, i traguardi e tutte le impostazioni come elenco di voci. */
export function ProfileScreen({ page, onPage, data, streak, today, onLogin, onFeedback, onAdmin }: {
  page: ProfilePage | null; onPage: (p: ProfilePage | null) => void; data: AppData; streak: Streak | null; today: string
  onLogin: () => void; onFeedback: () => void; onAdmin: () => void
}) {
  const { t, lang, setLang } = useI18n()
  const sync = useSync()
  const plan = usePlan()
  const name = sync.user ? (sync.user.firstName || sync.user.email.split('@')[0]) : t('prof.guest')
  const list = useMemo(() => {
    // solo i mesi già chiusi (fino a 12)
    const months = monthlyTrend(prevMonth(monthOf(today, data.settings.monthStartDay)), 12, data.transactions, data.settings, today)
    const goalsDone = (data.goals ?? []).filter(g => !g.removed && goalStatus(g, today).done).length
    return badges({ txCount: data.transactions.length, bestStreak: streak?.best ?? 0, imported: Object.keys(data.importDone ?? {}).length > 0, goalsDone, months })
  }, [data, streak?.best, today])

  if (page) {
    const back = <button className="back-btn" onClick={() => { tap(); onPage(null) }}><Icon name="back" size={20} />{t('prof.back')}</button>
    const title = t(ROWS.find(r => r.id === page)!.label)
    const body: Record<ProfilePage, ReactNode> = {
      notifications: <section className="card notif-page"><PushToggle /><NewsPushToggle />
        <p className="day-label">{t('notif.which')}</p>
        <ul className="notif-list">{(['morning', 'nudge', 'news', 'feedback'] as const).map(k => (
          <li key={k}><b>{t(`notif.${k}` as keyof Dict)}</b><span className="small muted">{t(`notif.${k}D` as keyof Dict)}</span></li>))}</ul>
        <p className="small muted">{t('notif.privacy')}</p></section>,
      plan: <PlanCard onLogin={onLogin} />,
      account: <AccountSection onLogin={onLogin} />,
      budget: <SettingsView only={['general', 'fx', 'rule', 'categories']} onLogin={onLogin} />,
      recurring: <SettingsView only={['recurring']} onLogin={onLogin} />,
      rules: <SettingsView only={['rules']} onLogin={onLogin} />,
      data: <><SettingsView only={['data']} onLogin={onLogin} /><LegalLinks /></>,
      shared: <ProGate feature="shared"><SharedView onBack={() => onPage(null)} onLogin={onLogin} /></ProGate>,
      beta: <BetaSection onFeedback={onFeedback} onAdmin={onAdmin} />,
      language: <section className="card"><ul className="choice-list">
        {Object.entries(LANGS).map(([c, n]) => <li key={c}><button className={lang === c ? 'on' : ''} onClick={() => { tap(); setLang(c as Lang) }}>
          <span>{n}</span>{lang === c && <Icon name="check" size={18} />}</button></li>)}</ul></section>,
    }
    return <div className="screen sub-in">{back}<h1 className="screen-title">{title}</h1>{body[page]}</div>
  }

  return (
    <div className="screen">
      <section className="prof-head">
        <span className={`prof-avatar${plan.pro ? ' pro' : ''}`}>{sync.user ? name.charAt(0).toUpperCase() : <Icon name="user" size={32} />}</span>
        <div><h1>{name}</h1>
          <p className="muted small">{sync.user ? sync.user.email : t('prof.guestHint')}</p>
          {plan.pro && <span className="pro-badge">Pro</span>}</div>
      </section>
      {!sync.user && sync.enabled && <button className="btn primary wide" onClick={onLogin}><Icon name="user" size={16} />{t('prof.signIn')}</button>}

      {streak && <div className="stat-row big">
        <div><span className="stat-ico"><Flame /></span><b>{streak.count}</b><span>{t('prof.current')}</span></div>
        <div><span className="stat-ico gold">★</span><b>{streak.best}</b><span>{t('prof.best')}</span></div>
        <div><span className="stat-ico blue"><Icon name="check" size={18} /></span><b>{data.activity?.length ?? 0}</b><span>{t('prof.activeDays')}</span></div>
      </div>}

      <section className="card"><StreakCalendar days={data.activity ?? []} today={today} /></section>

      <GoalsStrip goals={data.goals} today={today} currency={data.settings.currency} />

      <h2 className="sec-title">{t('prof.badges')} <small className="muted">{list.filter(b => b.done).length}/{list.length}</small></h2>
      <div className="badges">
        {list.map(b => (
          <div key={b.id} className={`badge${b.done ? ' done' : ''}`}>
            <span className="badge-medal" style={{ ['--p' as string]: b.progress }}><Icon name={b.done ? 'check' : 'lock'} size={20} /></span>
            <b>{t(`badge.${b.id}` as keyof Dict)}</b>
            <small>{t(`badge.${b.id}D` as keyof Dict)}</small>
          </div>
        ))}
      </div>

      <h2 className="sec-title">{t('prof.settings')}</h2>
      <ul className="settings-list card">
        {ROWS.map(r => (
          <li key={r.id}><button onClick={() => { tap(); onPage(r.id); window.scrollTo(0, 0) }}>
            <span className="set-ico"><Icon name={r.icon} size={18} /></span><span>{t(r.label)}</span><Icon name="chevron" size={18} className="row-chev" /></button></li>
        ))}
      </ul>
    </div>
  )
}

