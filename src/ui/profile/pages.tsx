// I contenuti delle pagine del Profilo (quale pagina mostra cosa: registry.tsx). Ognuna è un componente piccolo: legge lo stato da dove vive già
// (store, sincronizzazione, preferenze del dispositivo) e usa gli stessi elementi (Group, Row) delle altre.
import { useState, type FormEvent } from 'react'
import { Segmented } from '../kit/Segmented'
import { type Badge, type Streak } from '../../engine'
import { LANGS, useI18n, type Lang } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { setPrefs, usePrefs } from '../../app/prefs'
import { removeAvatar, setAvatar, useAvatar } from '../../profile/avatar'
import { countries, countryName } from '../../profile/countries'
import { useHelp } from '../../profile/help'
import { LICENSES } from '../../profile/licenses'
import { useStore } from '../../store/context'
import type { AppData } from '../../store/state'
import { useSync } from '../../sync/context'
import { Icon } from '../Icon'
import { Group, Row } from '../kit/List'
import { Avatar } from './Avatar'
import { StreakCalendar } from '../shell/StreakCalendar'
import { Flame } from '../Streak'
import { ENV } from '../../env'
import { PAGES as LEGAL } from '../../config'

export function Progress({ data, streak, today, badges }: { data: AppData; streak: Streak | null; today: string; badges: Badge[] }) {
  const { t } = useI18n()
  return <>
    <dl className="progress-row">
      <div><dt><Flame />{t('prof.current')}</dt><dd>{streak?.count ?? 0}</dd></div>
      <div><dt>{t('prof.best')}</dt><dd>{streak?.best ?? 0}</dd></div>
      <div><dt>{t('prof.activeDays')}</dt><dd>{data.activity?.length ?? 0}</dd></div>
    </dl>
    <StreakCalendar days={data.activity ?? []} today={today} />
    <Group title={`${t('prof.badges')} · ${badges.filter(b => b.done).length}/${badges.length}`}>
      {badges.map(b => (
        <Row key={b.id} label={t(`badge.${b.id}` as keyof Dict)} detail={t(`badge.${b.id}D` as keyof Dict)}
             value={b.done ? <Icon name="check" size={18} /> : `${Math.round(b.progress * 100)}%`} />
      ))}
    </Group>
  </>
}

export function Personal({ onLogin }: { onLogin: () => void }) {
  const { t, lang } = useI18n()
  const sync = useSync()
  const { state, dispatch } = useStore()
  const profile = state.data?.profile
  const [first, setFirst] = useState(sync.user?.firstName ?? '')
  const [last, setLast] = useState(sync.user?.lastName ?? '')
  const [note, setNote] = useState('')
  const [abroad, setAbroad] = useState(!!profile?.residence)
  const list = countries(lang)
  const setCountry = (k: 'country' | 'residence', v: string | null) =>
    dispatch({ type: 'setProfile', profile: { monthlyIncome: null, goals: [], cards: [], invested: null, investWhere: [], research: false, ...profile, [k]: v } })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    try { await sync.updateNames(first.trim(), last.trim()); setNote(t('personal.saved')) } catch { setNote(t('prof.errSave')) }
  }
  const pick = (k: 'country' | 'residence', label: keyof Dict) => (
    <label className="txs-row"><span>{t(label)}</span>
      <select value={profile?.[k] ?? ''} onChange={e => setCountry(k, e.target.value || null)}>
        <option value="">{t('personal.none')}</option>
        {list.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select></label>
  )
  const avatar = useAvatar()
  const [photoErr, setPhotoErr] = useState('')
  const pickPhoto = async (f: File | undefined) => {
    if (!f) return
    setPhotoErr('')
    try { await setAvatar(f, sync.user?.id ?? null) } catch { setPhotoErr(t('photo.err')) }
  }
  return <>
    <div className="photo">
      <Avatar name={sync.user ? (first || sync.user.email) : null} size={88} />
      <div className="photo-actions">
        <label className="link-btn">{avatar ? t('photo.change') : t('photo.add')}
          <input type="file" accept="image/*" hidden onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} /></label>
        {avatar && <button className="link-btn danger-link" onClick={() => { void removeAvatar(sync.user?.id ?? null) }}>{t('photo.remove')}</button>}
        <small className="muted">{photoErr ? <span className="bad-text">{photoErr}</span> : t('photo.private')}</small>
      </div>
    </div>
    {!sync.user && <div className="guest-note"><p className="muted">{t('personal.guest')}</p>
      {sync.enabled && <button className="btn primary" onClick={onLogin}>{t('prof.signIn')}</button>}</div>}

    {/* una sola lista: nome, email, paese, fuso orario; «Salva» compare solo quando nome o cognome cambiano */}
    <form className="txs-rows" onSubmit={save}>
      {sync.user && <>
        <label className="txs-row"><span>{t('auth.firstName')}</span>
          <input autoComplete="given-name" maxLength={80} placeholder={t('personal.add')} value={first} onChange={e => { setFirst(e.target.value); setNote('') }} /></label>
        <label className="txs-row"><span>{t('auth.lastName')}</span>
          <input autoComplete="family-name" maxLength={80} placeholder={t('personal.add')} value={last} onChange={e => { setLast(e.target.value); setNote('') }} /></label>
        <div className="txs-row"><span>{t('personal.email')}</span>
          <span className="row-value personal-email"><span>{sync.user.email}</span>
            {sync.user.emailConfirmed ? <small>{t('personal.verified')}</small>
              : <button type="button" className="link-btn warn-text" onClick={() => { void sync.resendSignup(sync.user!.email).then(() => setNote(t('personal.sent'))) }}>
                  {t('personal.unverified')} · {t('personal.resend')}</button>}</span></div>
      </>}
      {pick('country', 'personal.country')}
      <label className="txs-row"><span>{t('personal.abroad')}</span>
        <span className="row-switch"><button type="button" role="switch" aria-checked={abroad} aria-label={t('personal.abroad')} className={`switch${abroad ? ' on' : ''}`}
          onClick={() => { const on = !abroad; setAbroad(on); if (!on) setCountry('residence', null) }}><i /></button></span></label>
      {abroad && pick('residence', 'personal.residence')}
      <div className="txs-row"><span>{t('personal.tz')}</span><span className="row-value">{Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}</span></div>
      <p className="group-foot">{t('personal.tzHint')}{profile?.country && profile.residence ? ` ${countryName(profile.country, lang)} → ${countryName(profile.residence, lang)}` : ''}</p>
      {sync.user && (note || first !== sync.user.firstName || last !== sync.user.lastName) && <div className="form-end">
        {note && <span className="muted small" role="status">{note}</span>}
        {(first !== sync.user.firstName || last !== sync.user.lastName) && <button className="btn primary small-btn">{t('personal.save')}</button>}</div>}
    </form>
  </>
}

export function Security() {
  const { t } = useI18n()
  const sync = useSync()
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const change = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setMsg({ ok: false, text: t('auth.errPassword') })
    if (next !== again) return setMsg({ ok: false, text: t('sec.errMatch') })
    setBusy(true)
    try { await sync.changePassword(cur, next); setCur(''); setNext(''); setAgain(''); setMsg({ ok: true, text: t('sec.changed') }) }
    catch (err) { setMsg({ ok: false, text: (err as { code?: string }).code === 'bad_current' ? t('sec.errCurrent') : t('auth.errGeneric') }) }
    finally { setBusy(false) }
  }
  return <>
    <form onSubmit={change}>
      <h2 className="group-title">{t('sec.password')}</h2>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('sec.current')}</span><input type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></label>
        <label className="txs-row"><span>{t('sec.new')}</span><input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} /></label>
        <label className="txs-row"><span>{t('sec.repeat')}</span><input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} /></label>
      </div>
      <div className="form-end">{msg && <span className={`small ${msg.ok ? 'muted' : 'bad-text'}`} role="status">{msg.text}</span>}
        <button className="btn small-btn" disabled={busy || !cur || !next || !again}>{t('sec.change')}</button></div>
    </form>
    <Group>
      <Row label={t('sec.signOutOthers')} onClick={() => { void sync.signOutOthers().then(() => setMsg({ ok: true, text: t('sec.othersDone') })) }} />
      {(sync.status === 'offline' || sync.localSession) && <p className="small">{t('auth.localLogoutHint')}</p>}
      <Row label={t('sec.signOut')} detail={t('sync.signOutHint')} onClick={() => { void sync.signOut().catch(() => setMsg({ ok: false, text: t('auth.localError') })) }} />
    </Group>
  </>
}

export function Appearance() {
  const { t } = useI18n()
  const prefs = usePrefs()
  const opts = ['auto', 'light', 'dark'] as const
  return <>
    <Segmented role="radiogroup" label={t('prof.appearance')} value={prefs.theme} onChange={o => setPrefs({ theme: o })}
      options={opts.map(o => ({ id: o, label: t(`theme.${o}`) }))} />
    <p className="group-foot">{t('theme.hint')}</p>
  </>
}

export function Language() {
  const { lang, setLang } = useI18n()
  return <Group>{Object.entries(LANGS).map(([c, n]) =>
    <Row key={c} label={n} value={lang === c ? <Icon name="check" size={18} /> : null} onClick={() => setLang(c as Lang)} />)}</Group>
}

export function Motion({ titled = false }: { titled?: boolean }) {
  const { t } = useI18n()
  const prefs = usePrefs()
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
  return <Group title={titled ? t('prof.motion') : undefined}>
    {canVibrate && <Row label={t('motion.haptics')} detail={t('motion.hapticsHint')} toggle={{ on: prefs.haptics, onChange: on => setPrefs({ haptics: on }) }} />}
    <Row label={t('motion.reduce')} detail={t('motion.reduceHint')} toggle={{ on: prefs.motion === 'reduce', onChange: on => setPrefs({ motion: on ? 'reduce' : 'system' }) }} />
  </Group>
}

export function Accessibility() {
  const { t } = useI18n()
  const prefs = usePrefs()
  return <Group title={t('prof.accessibility')} foot={t('a11y.hint')}>
    <Row label={t('a11y.large')} toggle={{ on: prefs.text === 'large', onChange: on => setPrefs({ text: on ? 'large' : 'normal' }) }} />
  </Group>
}

/** Privacy policy e termini d'uso: due link in una pagina sola. */
export function Legal() {
  const { t, lang } = useI18n()
  return <Group>
    <Row label={t('legal.privacy')} href={`${LEGAL.privacy}?lang=${lang}`} />
    <Row label={t('legal.terms')} href={`${LEGAL.terms}?lang=${lang}`} />
  </Group>
}

/** Eliminazione con doppia conferma: si apre la pagina (primo passo) e si scrive la parola (secondo). */
export function Delete({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const { dispatch } = useStore()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const word = t('del.word')
  if (ENV.name === 'alpha') return <p className="muted">{t('auth.alphaDeleteHold')}</p>
  const go = async () => {
    setBusy(true); setErr('')
    try {
      if (sync.user) await sync.deleteAccount()
      dispatch({ type: 'replace', data: null })   // si riparte dal benvenuto, come la prima volta
      onDone()
    } catch { setErr(t('auth.errGeneric')) } finally { setBusy(false) }
  }
  return <>
    <p>{sync.user ? t('del.text') : t('del.local')}</p>
    <label className="field"><span>{t('del.type', { word })}</span>
      <input value={typed} onChange={e => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label={t('del.type', { word })} /></label>
    {err && <p className="bad-text small">{err}</p>}
    <button className="btn danger-fill wide" disabled={busy || typed.trim().toUpperCase() !== word} onClick={go}>
      {sync.user ? t('del.go') : t('del.goLocal')}</button>
  </>
}

export function Licenses() {
  const { t } = useI18n()
  return <Group foot={t('lic.intro')}>
    {LICENSES.map(l => <Row key={l.name} label={l.name} detail={`${l.license} · ${l.by}`} href={l.url} />)}
  </Group>
}

/** Centro assistenza: le domande per argomento (si aprono al tocco), poi come scriverci. */
export function HelpCenter({ onReport }: { onReport: () => void }) {
  const { t, lang } = useI18n()
  const help = useHelp()
  if (!help) return <p className="muted">{t('app.loading')}</p>
  const h = help[lang]
  return <>
    <p className="muted">{h.intro}</p>
    {h.sections.map(s => (
      <section key={s.title} className="group">
        <h2 className="group-title">{s.title}</h2>
        <ul className="group-list faq">{s.items.map(i => (
          <li key={i.q}><details><summary className="row"><span className="row-main">{i.q}</span><Icon name="chevron" size={18} className="row-chev" /></summary>
            <p>{i.a}</p></details></li>))}</ul>
      </section>
    ))}
    <Group title={h.contactTitle} foot={help.contact ? h.contactText : h.contactSoon}>
      {help.contact && <Row label={help.contact} href={`mailto:${help.contact}?subject=Quadriamo`} />}
      <Row label={t('prof.feedback')} onClick={onReport} />
    </Group>
  </>
}
