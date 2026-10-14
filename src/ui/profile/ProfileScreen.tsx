import { useEffect, useMemo, useState } from 'react'
import { badges, goalStatus, monthOf, monthlyTrend, prevMonth, type Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import { usePrefs } from '../../app/prefs'
import { APP_VERSION, setStatsConsent, statsConsent } from '../../beta/device'
import { track } from '../../beta/telemetry'
import { PAGES as LEGAL } from '../../config'
import { useHelp } from '../../profile/help'
import type { ProfilePage } from '../../profile/pages'
import type { AppData } from '../../store/state'
import { supabase } from '../../sync/client'
import { useSync } from '../../sync/context'
import { usePlan } from '../../billing/plan'
import { Group, Page, Row } from '../kit/List'
import { morph } from '../kit/motion'
import { Avatar } from './Avatar'
import { PAGES } from './registry'
import { SECTIONS, pageLabel, type Ctx } from './sections'

const SITE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'

/**
 * Profilo: chi sei (testata), i tuoi progressi in una riga, poi cinque sezioni disegnate dalla mappa (sections.ts).
 * Ogni voce apre una pagina di dettaglio (pages.tsx) con Indietro e titolo.
 */
export function ProfileScreen({ page, onPage, data, streak, today, onLogin, onAdmin }: {
  page: ProfilePage | null; onPage: (p: ProfilePage | null) => void; data: AppData; streak: Streak | null; today: string
  onLogin: () => void; onAdmin: () => void
}) {
  const { t, lang } = useI18n()
  const sync = useSync()
  const plan = usePlan()
  const prefs = usePrefs()
  const help = useHelp()
  const [stats, setStats] = useState(statsConsent() === 'yes')
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!supabase || !sync.user) return
    void supabase.rpc('is_admin').then(({ data: ok }) => setIsAdmin(ok === true))
  }, [sync.user])
  const list = useMemo(() => {
    // solo i mesi già chiusi (fino a 12)
    const months = monthlyTrend(prevMonth(monthOf(today, data.settings.monthStartDay)), 12, data.transactions, data.settings, today)
    const goalsDone = (data.goals ?? []).filter(g => !g.removed && goalStatus(g, today).done).length
    return badges({ txCount: data.transactions.length, bestStreak: streak?.best ?? 0, imported: Object.keys(data.importDone ?? {}).length > 0, goalsDone, months })
  }, [data, streak?.best, today])
  // la voce toccata diventa il titolo della pagina; "Indietro" fa la strada inversa
  const open = (p: ProfilePage | null) => morph(p ?? page ?? '', () => { onPage(p); window.scrollTo(0, 0) })

  if (page) return (
    <Page title={t(pageLabel(page, !!sync.user))} onBack={() => open(null)} morph={page}>
      {PAGES[page]({ data, streak, today, badges: list, onBack: () => open(null), onLogin, onHome: () => open(null), onPage: open })}
    </Page>
  )

  const ctx: Ctx = {
    signedIn: !!sync.user, isAdmin, prefs, contactEmail: help?.contact ?? '', version: APP_VERSION, stats,
    privacyUrl: `${LEGAL.privacy}?lang=${lang}`, termsUrl: `${LEGAL.terms}?lang=${lang}`, t,
    setStats: on => { setStats(on); setStatsConsent(on ? 'yes' : 'no') },
    invite: async () => {
      const url = `${SITE}?lang=${lang}`
      try {
        if (navigator.share) await navigator.share({ title: 'Quadriamo', text: t('beta.inviteText'), url })
        else await navigator.clipboard.writeText(`${t('beta.inviteText')} ${url}`)
        void track('share')
      } catch { /* condivisione annullata */ }
    },
    openAdmin: onAdmin,
  }
  const name = sync.user ? [sync.user.firstName, sync.user.lastName].filter(Boolean).join(' ') || sync.user.email.split('@')[0] : t('prof.guest')
  const done = list.filter(b => b.done).length

  return (
    <div className="screen">
      <header className="me">
        <Avatar name={sync.user ? name : null} />
        <div className="me-text">
          <h1>{name}{plan.pro && <span className="pro-badge">Pro</span>}</h1>
          <p>{sync.user ? <>{sync.user.email}{!sync.user.emailConfirmed && <span className="warn-text"> · {t('personal.unverified')}</span>}</> : t('prof.guestHint')}</p>
        </div>
      </header>
      {!sync.user && sync.enabled && <button className="btn primary wide me-signin" onClick={onLogin}>{t('prof.signIn')}</button>}

      <Group>
        <Row label={t('prof.progress')} value={t('prof.progressLine', { n: streak?.count ?? 0, done, total: list.length })} onClick={() => open('progress')} morph="progress" />
      </Group>

      {SECTIONS.map(s => {
        const items = s.items.filter(i => !i.when || i.when(ctx))
        return (
          <Group key={s.title} title={t(s.title)}>
            {items.map((i, n) => {
              const label = t(i.label)
              if ('page' in i) return <Row key={n} label={label} danger={i.danger} value={i.value?.(ctx)} onClick={() => open(i.page)} morph={i.page} />
              if ('href' in i) return <Row key={n} label={label} href={i.href(ctx)} />
              if ('toggle' in i) return <Row key={n} label={label} toggle={i.toggle(ctx)} />
              if ('action' in i) return <Row key={n} label={label} onClick={() => i.action(ctx)} />
              return <Row key={n} label={label} value={i.info(ctx)} />
            })}
          </Group>
        )
      })}
    </div>
  )
}
