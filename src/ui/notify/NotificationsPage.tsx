// Profilo → Notifiche: acceso/spento su questo dispositivo (e come riattivarle se il sistema le blocca), quali categorie,
// quando (orario preferito, ore di silenzio, giorni attivi), quante al massimo al giorno; email quando ci sarà il dominio.
// Finché le notifiche personali sono sospese, le scelte restano visibili ma spente.
// Le preferenze stanno nelle impostazioni (settings.notify): valgono su tutti i dispositivi dell'account.
import { platform } from '../../beta/device'
import { PERSONAL_PUSH_PAUSED, pushSupported } from '../../beta/push'
import { notifyPrefs } from '../../beta/reminders'
import { type NotifyPrefs } from '../../engine'
import { ENV } from '../../env'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { PushToggle } from '../beta/PushToggle'
import { Group, Row } from '../kit/List'
import { tap } from '../kit/motion'

const k = (s: string) => s as keyof Dict
const CATEGORIES = ['reminders', 'morning', 'nudge', 'news'] as const

export function NotificationsPage() {
  const { t, lang } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const p = notifyPrefs(settings.notify)
  const set = (patch: Partial<NotifyPrefs>) => dispatch({ type: 'setSettings', settings: { ...settings, notify: { ...p, ...patch } } })
  const blocked = pushSupported() && Notification.permission === 'denied'
  // notifiche personali sospese (vedi PushToggle): le scelte si vedono, attenuate, ma non si toccano finché non tornano
  const paused = PERSONAL_PUSH_PAUSED && !!ENV.supabase
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 5 + i))))
  return <>
    <section className="notif-page"><PushToggle /></section>
    {blocked && <p className="small notif-blocked">{t(platform() === 'ios' ? 'ask.howIos' : platform() === 'android' ? 'ask.howAndroid' : 'ask.howDesktop')}</p>}

    <fieldset className="notif-set" disabled={paused}>
    <Group title={t('notif.which')} foot={t('notif.privacy')}>
      {CATEGORIES.map(c => <Row key={c} label={t(k(`notif.${c}`))} detail={t(k(`notif.${c}D`))} toggle={{ on: p[c], onChange: on => set({ [c]: on }) }} />)}
      <Row label={t('notif.feedback')} detail={t('notif.feedbackD')} />
      <Row label={t('notif.email')} detail={t('notif.emailD')} toggle={{ on: false, onChange: () => {}, disabled: true }} />
    </Group>

    <Group title={t('notif.when')}>
      <li><label className="row"><span className="row-main"><span>{t('notif.hour')}</span><small>{t('notif.hourD')}</small></span>
        <input type="time" className="row-input" value={p.hour} onChange={e => e.target.value && set({ hour: e.target.value })} /></label></li>
      <Row label={t('notif.quiet')} detail={p.quiet ? t('notif.quietOn', { from: p.quiet.from, to: p.quiet.to }) : t('notif.quietD')}
        toggle={{ on: !!p.quiet, onChange: on => set({ quiet: on ? { from: '22:00', to: '08:00' } : null }) }} />
      {p.quiet && <li><div className="row notif-quiet">
        <label>{t('notif.from')} <input type="time" className="row-input" value={p.quiet.from} onChange={e => e.target.value && set({ quiet: { ...p.quiet!, from: e.target.value } })} /></label>
        <label>{t('notif.to')} <input type="time" className="row-input" value={p.quiet.to} onChange={e => e.target.value && set({ quiet: { ...p.quiet!, to: e.target.value } })} /></label>
      </div></li>}
      <li><div className="row notif-days">
        <span className="row-main"><span>{t('notif.days')}</span></span>
        <span className="chips" role="group" aria-label={t('notif.days')}>{weekdays.map((w, i) => {
          const on = p.days.includes(i + 1)
          return <button key={i} type="button" aria-pressed={on} className={`chip${on ? ' on' : ''}`}
            onClick={() => { tap(); const days = on ? p.days.filter(d => d !== i + 1) : [...p.days, i + 1].sort(); if (days.length) set({ days }) }}>{w}</button>
        })}</span>
      </div></li>
      <li><label className="row"><span className="row-main"><span>{t('notif.max')}</span><small>{t('notif.maxD')}</small></span>
        <select className="row-input" value={p.maxPerDay} onChange={e => set({ maxPerDay: Number(e.target.value) })}>
          {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}</select></label></li>
    </Group>
    </fieldset>
  </>
}
