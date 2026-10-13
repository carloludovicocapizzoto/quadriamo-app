import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useStore } from '../store/context'
import type { PrivateProfile } from '../store/state'
import { useSync } from '../sync/context'
import { CARDS, GOALS, WHERE, loadNames, profilePrompt, saveNames, type Names } from '../sync/profile'
import { syncResearch } from '../sync/research'
import { bucketName } from './names'
import { Icon } from './Icon'
import { StepHeader, StepNav } from './Steps'
import { AmountInput } from './kit/AmountInput'
import { amountText } from './kit/amount'

const PRESETS = [[55, 20, 15, 10], [50, 25, 15, 10], [60, 15, 15, 10], [50, 20, 15, 15]]
const num = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const emptyPrivate = (): PrivateProfile => ({ monthlyIncome: null, goals: [], cards: [], invested: null, investWhere: [], research: false })

/**
 * Profilo facoltativo. Nome e cognome stanno nell'account; entrate, obiettivi, carte e investimenti sono dati sensibili:
 * restano nei dati dell'utente (come il budget) e non arrivano mai all'area amministratore. Solo se l'utente lo sceglie,
 * una scheda anonima (senza nome, email né account; entrate per fascia) va alla ricerca statistica.
 * `withShares=false`: senza il passaggio sulla divisione (già scelta nella configurazione iniziale).
 */
export function ProfileForm({ onDone, withShares = true }: { onDone: () => void; withShares?: boolean }) {
  const { t, lang } = useI18n()
  const sync = useSync()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const [names, setNames] = useState<Names | null>(null)
  const [pp, setPp] = useState<PrivateProfile>(() => ({ ...emptyPrivate(), ...state.data!.profile }))
  const [income, setIncome] = useState(() => state.data!.profile?.monthlyIncome != null ? amountText(state.data!.profile.monthlyIncome, lang) : '')
  const [shares, setShares] = useState<string[]>(() => settings.buckets.map(b => String(Math.round(b.share * 1000) / 10)))
  const [apply, setApply] = useState(true)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    let live = true
    loadNames().catch(() => ({ first_name: null, last_name: null })).then(n => {
      if (live) setNames({ ...n, first_name: n.first_name ?? (sync.user?.firstName || null) })
    })
    return () => { live = false }
  }, [sync.user?.firstName])

  if (!names || !sync.user) return <p className="muted small">…</p>
  const set = (patch: Partial<PrivateProfile>) => setPp({ ...pp, ...patch })
  const toggle = (key: 'goals' | 'cards' | 'investWhere', v: string) =>
    set({ [key]: pp[key].includes(v) ? pp[key].filter(x => x !== v) : [...pp[key], v] })
  const values = shares.map(num)
  const total = Math.round(values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) * 10) / 10
  const cardLabel = (c: string) => (c === c.toLowerCase() ? t(`prof.${c === 'other' ? 'other' : `c.${c}`}` as keyof Dict) : c)

  async function save() {
    if (withShares && (total !== 100 || values.some(v => !Number.isFinite(v) || v < 0))) { setMsg({ text: t('prof.errTotal'), bad: true }); return }
    const inc = income.trim() ? num(income) : null
    const profile: PrivateProfile = { ...pp, monthlyIncome: inc != null && Number.isFinite(inc) ? inc : null, investWhere: pp.invested === 'yes' ? pp.investWhere : [] }
    setBusy(true); setMsg(null)
    try {
      await saveNames(sync.user!.id, names!)
      dispatch({ type: 'setProfile', profile })
      let rule = settings.buckets.map(b => Math.round(b.share * 1000) / 10)
      if (apply && withShares) {
        const buckets = settings.buckets.map((b, i) => ({ ...b, share: values[i] / 100 }))
        if (buckets.some((b, i) => b.share !== settings.buckets[i].share)) dispatch({ type: 'setSettings', settings: { ...settings, buckets } })
        rule = values
      }
      await syncResearch(profile, rule)
      profilePrompt.clear()
      setMsg({ text: t('prof.saved') })
      setTimeout(onDone, 900)
    } catch { setMsg({ text: t('prof.errSave'), bad: true }) } finally { setBusy(false) }
  }
  async function clear() {
    if (!confirm(t('prof.clearConfirm'))) return
    dispatch({ type: 'setProfile', profile: null })
    setPp(emptyPrivate()); setIncome('')
    try { await syncResearch(null, []) } catch { /* la scheda si ritira al prossimo salvataggio */ }
    setMsg({ text: t('prof.saved') })
  }

  const TOTAL = withShares ? 6 : 5
  const titles = [t('prof.stepIncome'), t('prof.goals'), t('prof.cards'), t('prof.stepInvest'), ...(withShares ? [t('prof.shares')] : []), t('prof.stepPrivacy')]
  const submit = (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    if (step < TOTAL) setStep(step + 1)
    else void save()
  }
  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      {step === 1 && <p className="muted small">{t('prof.intro')}</p>}
      <StepHeader n={step} total={TOTAL} title={titles[step - 1]} />
      <div className="step-body" key={step}>
        {step === 1 && <>
          <div className="two-col">
            <label className="field"><span>{t('auth.firstName')}</span>
              <input autoComplete="given-name" maxLength={80} value={names.first_name ?? ''} onChange={e => setNames({ ...names, first_name: e.target.value })} /></label>
            <label className="field"><span>{t('auth.lastName')}</span>
              <input autoComplete="family-name" maxLength={80} value={names.last_name ?? ''} onChange={e => setNames({ ...names, last_name: e.target.value })} /></label>
          </div>
          <label className="field"><span>{t('prof.income')} ({settings.currency})</span>
            <AmountInput placeholder="1.600" value={income} onChange={setIncome} autoFocus />
            <small className="muted">{t('prof.incomeHint')}</small></label>
        </>}

        {step === 2 && <div className="chips">{GOALS.map(g => <button key={g} type="button" className={`chip${pp.goals.includes(g) ? ' on' : ''}`}
          aria-pressed={pp.goals.includes(g)} onClick={() => toggle('goals', g)}>{t(`prof.g.${g}` as keyof Dict)}</button>)}</div>}

        {step === 3 && <div className="chips">{CARDS.map(c => <button key={c} type="button" className={`chip${pp.cards.includes(c) ? ' on' : ''}`}
          aria-pressed={pp.cards.includes(c)} onClick={() => toggle('cards', c)}>{cardLabel(c)}</button>)}</div>}

        {step === 4 && <>
          <p className="field-label">{t('prof.invested')}</p>
          <div className="chips">{(['yes', 'want', 'no'] as const).map(v => <button key={v} type="button" className={`chip${pp.invested === v ? ' on' : ''}`}
            aria-pressed={pp.invested === v} onClick={() => set({ invested: pp.invested === v ? null : v })}>{t(`prof.i.${v}`)}</button>)}</div>
          {pp.invested === 'yes' && <>
            <p className="field-label top-gap">{t('prof.where')}</p>
            <div className="chips">{WHERE.map(w => <button key={w} type="button" className={`chip${pp.investWhere.includes(w) ? ' on' : ''}`}
              aria-pressed={pp.investWhere.includes(w)} onClick={() => toggle('investWhere', w)}>{t(w === 'other' ? 'prof.other' : `prof.w.${w}` as keyof Dict)}</button>)}</div>
          </>}
        </>}

        {withShares && step === 5 && <>
          <small className="muted">{t('prof.sharesHint')}</small>
          <div className="chips">{PRESETS.filter(pr => pr.length === settings.buckets.length).map(pr => (
            <button key={pr.join()} type="button" className={`chip${pr.every((v, i) => v === values[i]) ? ' on' : ''}`} onClick={() => setShares(pr.map(String))}>
              {pr.join('-')}{pr[0] === 55 && pr[1] === 20 ? ` · ${t('prof.recommended')}` : ''}</button>))}</div>
          <div className="share-grid">
            {settings.buckets.map((b, i) => (
              <label key={b.id} className="share-input"><span>{bucketName(b, t)}</span>
                <span className="pct-input"><input inputMode="decimal" value={shares[i]} onChange={e => setShares(shares.map((x, j) => (j === i ? e.target.value.replace(/[^\d.,]/g, '') : x)))} />%</span></label>
            ))}
          </div>
          <p className={`small ${total === 100 ? 'muted' : 'bad-text'}`}>{t('prof.sharesTotal', { n: String(total).replace('.', ',') })}</p>
          <label className="check"><input type="checkbox" checked={apply} onChange={e => setApply(e.target.checked)} /> {t('prof.apply')}</label>
        </>}
        {step === TOTAL && <>
          <div className="privacy-note">
            <p><b><Icon name="lock" size={14} />{t('prof.privTitle')}</b></p>
            <p className="small">{t('prof.privText')}</p>
          </div>
          <label className="check wrap-text research-check">
            <input type="checkbox" checked={pp.research} onChange={e => set({ research: e.target.checked })} />
            <span><b>{t('prof.research')}</b><br /><span className="small muted">{t('prof.researchHint')}</span></span>
          </label>
        </>}
      </div>

      <StepNav onBack={step > 1 ? () => setStep(step - 1) : undefined} busy={busy}
        next={step < TOTAL ? `${t('step.next')}` : t('prof.save')}
        extra={<button type="button" className="link-btn" onClick={() => { profilePrompt.clear(); onDone() }}>{t('prof.skip')}</button>} />
      {step === TOTAL && <button type="button" className="link-btn small" onClick={() => void clear()}>{t('prof.clear')}</button>}
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="status">{msg.text}</p>}
    </form>
  )
}
