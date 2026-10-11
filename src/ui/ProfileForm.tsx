import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useStore } from '../store/context'
import { useSync } from '../sync/context'
import { CARDS, GOALS, WHERE, emptyProfile, loadProfile, profilePrompt, saveProfile, type Profile } from '../sync/profile'
import { bucketName } from './names'
import { StepHeader, StepNav } from './Steps'

const PRESETS = [[55, 20, 15, 10], [50, 25, 15, 10], [60, 15, 15, 10], [50, 20, 15, 15]]
const num = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }

/** Profilo facoltativo: entrate, obiettivi, carte, investimenti e divisione delle entrate tra i quattro portafogli. */
/** `withShares=false`: senza il passaggio sulla divisione (già scelta nella configurazione iniziale). */
export function ProfileForm({ onDone, withShares = true }: { onDone: () => void; withShares?: boolean }) {
  const { t } = useI18n()
  const sync = useSync()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const [p, setP] = useState<Profile | null>(null)
  const [income, setIncome] = useState('')
  const [shares, setShares] = useState<string[]>(() => settings.buckets.map(b => String(Math.round(b.share * 1000) / 10)))
  const [apply, setApply] = useState(true)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    let live = true
    loadProfile().catch(() => emptyProfile()).then(pr => {
      if (!live) return
      setP({ ...pr, first_name: pr.first_name ?? (sync.user?.firstName || null) })
      if (pr.monthly_income != null) setIncome(String(pr.monthly_income).replace('.', ','))
      if (withShares && pr.shares?.length === settings.buckets.length) setShares(pr.shares.map(String))
    })
    return () => { live = false }
  }, [settings.buckets.length, sync.user?.firstName, withShares])

  if (!p || !sync.user) return <p className="muted small">…</p>
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch })
  const toggle = (key: 'goals' | 'cards' | 'invest_where', v: string) =>
    set({ [key]: p[key].includes(v) ? p[key].filter(x => x !== v) : [...p[key], v] })
  const values = shares.map(num)
  const total = Math.round(values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) * 10) / 10
  const cardLabel = (c: string) => (c === c.toLowerCase() ? t(`prof.${c === 'other' ? 'other' : `c.${c}`}` as keyof Dict) : c)

  async function save() {
    if (total !== 100 || values.some(v => !Number.isFinite(v) || v < 0)) { setMsg({ text: t('prof.errTotal'), bad: true }); return }
    const inc = income.trim() ? num(income) : null
    setBusy(true); setMsg(null)
    try {
      await saveProfile(sync.user!.id, { ...p!, monthly_income: inc != null && Number.isFinite(inc) ? inc : null, currency: settings.currency, shares: values })
      if (apply && withShares) {
        const buckets = settings.buckets.map((b, i) => ({ ...b, share: values[i] / 100 }))
        if (buckets.some((b, i) => b.share !== settings.buckets[i].share)) dispatch({ type: 'setSettings', settings: { ...settings, buckets } })
      }
      profilePrompt.clear()
      setMsg({ text: t('prof.saved') })
      setTimeout(onDone, 900)
    } catch { setMsg({ text: t('prof.errSave'), bad: true }) } finally { setBusy(false) }
  }
  async function clear() {
    if (!confirm(t('prof.clearConfirm'))) return
    const cleared = { ...emptyProfile(), first_name: p!.first_name, last_name: p!.last_name }
    try { await saveProfile(sync.user!.id, cleared); setP(cleared); setIncome(''); setMsg({ text: t('prof.saved') }) }
    catch { setMsg({ text: t('prof.errSave'), bad: true }) }
  }

  const TOTAL = withShares ? 5 : 4
  const titles = [t('prof.stepIncome'), t('prof.goals'), t('prof.cards'), t('prof.stepInvest'), t('prof.shares')]
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
              <input autoComplete="given-name" maxLength={80} value={p.first_name ?? ''} onChange={e => set({ first_name: e.target.value })} /></label>
            <label className="field"><span>{t('auth.lastName')}</span>
              <input autoComplete="family-name" maxLength={80} value={p.last_name ?? ''} onChange={e => set({ last_name: e.target.value })} /></label>
          </div>
          <label className="field"><span>{t('prof.income')} ({settings.currency})</span>
            <input inputMode="decimal" placeholder="1.600" value={income} onChange={e => setIncome(e.target.value.replace(/[^\d.,]/g, ''))} autoFocus />
            <small className="muted">{t('prof.incomeHint')}</small></label>
        </>}

        {step === 2 && <div className="chips">{GOALS.map(g => <button key={g} type="button" className={`chip${p.goals.includes(g) ? ' on' : ''}`}
          aria-pressed={p.goals.includes(g)} onClick={() => toggle('goals', g)}>{t(`prof.g.${g}` as keyof Dict)}</button>)}</div>}

        {step === 3 && <div className="chips">{CARDS.map(c => <button key={c} type="button" className={`chip${p.cards.includes(c) ? ' on' : ''}`}
          aria-pressed={p.cards.includes(c)} onClick={() => toggle('cards', c)}>{cardLabel(c)}</button>)}</div>}

        {step === 4 && <>
          <p className="field-label">{t('prof.invested')}</p>
          <div className="chips">{(['yes', 'want', 'no'] as const).map(v => <button key={v} type="button" className={`chip${p.invested === v ? ' on' : ''}`}
            aria-pressed={p.invested === v} onClick={() => set({ invested: p.invested === v ? null : v })}>{t(`prof.i.${v}`)}</button>)}</div>
          {p.invested === 'yes' && <>
            <p className="field-label top-gap">{t('prof.where')}</p>
            <div className="chips">{WHERE.map(w => <button key={w} type="button" className={`chip${p.invest_where.includes(w) ? ' on' : ''}`}
              aria-pressed={p.invest_where.includes(w)} onClick={() => toggle('invest_where', w)}>{t(w === 'other' ? 'prof.other' : `prof.w.${w}` as keyof Dict)}</button>)}</div>
          </>}
        </>}

        {step === 5 && <>
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
      </div>

      <StepNav onBack={step > 1 ? () => setStep(step - 1) : undefined} busy={busy}
        next={step < TOTAL ? `${t('step.next')} →` : t('prof.save')}
        extra={<button type="button" className="link-btn" onClick={() => { profilePrompt.clear(); onDone() }}>{t('prof.skip')}</button>} />
      {step === TOTAL && <button type="button" className="link-btn small" onClick={() => void clear()}>{t('prof.clear')}</button>}
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="status">{msg.text}</p>}
    </form>
  )
}
