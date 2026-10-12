import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { balances, sharesFor, todayIso, transfers, type SExpense, type SplitMode } from '../../engine'
import { ENTRY } from '../../entry'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { newId, parseAmount } from '../../store/state'
import { useSync } from '../../sync/context'
import { createBudget, createInvite, deleteExpense, joinBudget, leaveBudget, loadBudget, myBudgets, saveExpense, settle,
  updateBudget, updateMember, type SBudget, type SFull } from '../../shared/api'
import { Icon } from '../Icon'
import { categoryName } from '../names'

const LAST = 'q.sharedBudget'
const remember = (id: string | null) => { try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST) } catch { /* niente */ } }
const remembered = () => { try { return localStorage.getItem(LAST) } catch { return null } }

/** Budget comune (di coppia o tra coinquilini): spese condivise, divisione scelta dagli utenti, chi deve quanto a chi. */
export function SharedView({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const [list, setList] = useState<SBudget[] | null>(null)
  const [current, setCurrent] = useState<string | null>(remembered)
  const [error, setError] = useState('')

  const refreshList = useCallback(async () => {
    try { const l = await myBudgets(); setList(l); if (!l.some(b => b.id === current)) setCurrent(l[0]?.id ?? null) }
    catch { setError(t('sh.errLoad')); setList([]) }
  }, [current, t])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server
    if (sync.user) void refreshList()
  }, [sync.user, refreshList])

  const head = <div className="sh-head"><button className="link-btn" onClick={onBack}><Icon name="back" size={16} />{t('sh.back')}</button><h1>{t('sh.title')}</h1></div>
  if (!sync.user) return <div className="shared">{head}<section className="card"><p>{t('sh.needAccount')}</p>
    <button className="btn primary" onClick={onLogin}><Icon name="user" size={16} />{t('onb.account')}</button></section></div>
  if (!list) return <div className="shared">{head}<p className="muted">…</p></div>
  return (
    <div className="shared">
      {head}
      {error && <p className="bad-text small">{error}</p>}
      {list.length > 1 && (
        <div className="chips sh-pick">{list.map(b => <button key={b.id} className={`chip${b.id === current ? ' on' : ''}`} onClick={() => { setCurrent(b.id); remember(b.id) }}>{b.name}</button>)}</div>
      )}
      {current && list.some(b => b.id === current)
        ? <BudgetDetail key={current} id={current} onLeft={() => { remember(null); setCurrent(null); void refreshList() }} />
        : null}
      <StartCard first={!list.length} onReady={id => { remember(id); setCurrent(id); void refreshList() }} />
    </div>
  )
}

/** Crea un budget comune o entra con il codice d'invito. */
function StartCard({ first, onReady }: { first: boolean; onReady: (id: string) => void }) {
  const { t } = useI18n()
  const sync = useSync()
  const { state } = useStore()
  const [open, setOpen] = useState<'create' | 'join' | null>(ENTRY.get('join') ? 'join' : first ? 'create' : null)
  const [name, setName] = useState(t('sh.defaultName'))
  const [me, setMe] = useState(sync.user?.firstName || '')
  const [code, setCode] = useState(ENTRY.get('join') ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg('')
    if (!me.trim()) { setMsg(t('sh.errName')); return }
    setBusy(true)
    try {
      onReady(open === 'create' ? await createBudget(name.trim() || t('sh.defaultName'), state.data?.settings.currency ?? 'EUR', me.trim())
        : await joinBudget(code.trim(), me.trim()))
      setOpen(null)
    } catch { setMsg(open === 'join' ? t('sh.errCode') : t('sh.errLoad')) } finally { setBusy(false) }
  }
  return (
    <section className="card sh-start">
      {first && <><h3 className="h-plain">{t('sh.introTitle')}</h3><p className="muted small">{t('sh.intro')}</p></>}
      <div className="stack-row">
        <button className={`btn${open === 'create' ? ' primary' : ''}`} onClick={() => setOpen('create')}>+ {t('sh.create')}</button>
        <button className={`btn${open === 'join' ? ' primary' : ''}`} onClick={() => setOpen('join')}><Icon name="key" size={16} />{t('sh.join')}</button>
      </div>
      {open && (
        <form className="auth-form step-body" key={open} onSubmit={submit}>
          {open === 'create'
            ? <label className="field"><span>{t('sh.name')}</span><input maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
            : <label className="field"><span>{t('sh.code')}</span><input className="code-input" maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoFocus /></label>}
          <label className="field"><span>{t('sh.yourName')}</span><input maxLength={40} value={me} onChange={e => setMe(e.target.value)} /></label>
          <div><button className="btn primary" disabled={busy}>{open === 'create' ? t('sh.create') : t('sh.join')}</button></div>
          {msg && <p className="bad-text small">{msg}</p>}
        </form>
      )}
    </section>
  )
}

function BudgetDetail({ id, onLeft }: { id: string; onLeft: () => void }) {
  const { t, money, date } = useI18n()
  const sync = useSync()
  const [d, setD] = useState<SFull | null>(null)
  const [form, setForm] = useState<SExpense | 'new' | null>(null)
  const [settings, setSettings] = useState(false)
  const reload = useCallback(async () => { try { setD(await loadBudget(id)) } catch { /* resta l'ultimo caricato */ } }, [id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server
    void reload()
    const timer = setInterval(() => { void reload() }, 30000)            // aggiornamento leggero mentre è aperto
    return () => clearInterval(timer)
  }, [reload])

  const me = sync.user!.id
  const bal = useMemo(() => d ? balances(d.members, d.expenses, d.settlements, d.budget.split_mode) : {}, [d])
  const plan = useMemo(() => transfers(bal), [bal])
  if (!d) return <p className="muted">…</p>
  const cur = d.budget.currency
  const nameOf = (uid: string) => d.members.find(m => m.user_id === uid)?.display_name ?? '?'
  const month = todayIso().slice(0, 7)
  const monthExp = d.expenses.filter(e => e.date.startsWith(month))
  const monthTot = monthExp.reduce((a, e) => a + e.amount, 0)
  const modeLabel = (e: SExpense) => t(`sh.mode.${e.split?.mode ?? d.budget.split_mode}` as keyof Dict)

  return (
    <>
      <section className="card sh-summary">
        <div className="card-head"><h3 className="h-plain">{d.budget.name}</h3>
          <button className="btn small-btn" onClick={() => setSettings(!settings)}><Icon name="settings" size={16} />{t('sh.settings')}</button></div>
        <p className="muted small">{d.members.map(m => m.display_name).join(' · ')} · {t(`sh.mode.${d.budget.split_mode}` as keyof Dict)}</p>
        {plan.length ? (
          <ul className="sh-transfers">
            {plan.map(p => (
              <li key={p.from + p.to}>
                <span><b>{nameOf(p.from)}</b> {t('sh.owes')} <b>{money(p.amount, cur)}</b> {t('sh.to')} <b>{nameOf(p.to)}</b></span>
                <button className="btn small-btn" onClick={async () => {
                  if (!confirm(t('sh.settleConfirm', { from: nameOf(p.from), to: nameOf(p.to), amount: money(p.amount, cur) }))) return
                  await settle(id, p.from, p.to, p.amount); void reload()
                }}><Icon name="check" size={16} />{t('sh.settle')}</button>
              </li>
            ))}
          </ul>
        ) : <p className="good-text"><b><Icon name="check" size={16} />{t('sh.even')}</b></p>}
        <dl className="w-flow">
          <div><dt>{t('sh.monthTotal')}</dt><dd>{money(monthTot, cur)}</dd></div>
          {d.members.map(m => <div key={m.user_id}><dt>{t('sh.paidBy', { name: m.display_name })}</dt>
            <dd>{money(monthExp.filter(e => e.paid_by === m.user_id).reduce((a, e) => a + e.amount, 0), cur)}</dd></div>)}
        </dl>
      </section>

      {settings && <BudgetSettings d={d} me={me} onChange={() => void reload()} onLeft={onLeft} />}

      <section className="card">
        <div className="card-head"><h3 className="h-plain">{t('sh.expenses')}</h3>
          <button className="btn primary small-btn" onClick={() => setForm('new')}>+ {t('sh.add')}</button></div>
        {!d.expenses.length && <p className="muted small">{t('sh.noExpenses')}</p>}
        <ul className="sh-list">
          {d.expenses.slice(0, 100).map(e => (
            <li key={e.id} onClick={() => setForm(e)}>
              <span className="muted small">{date(e.date, { day: 'numeric', month: 'short' })}</span>
              <span><b>{e.description}</b><small className="muted"> {t('sh.paidShort', { name: nameOf(e.paid_by) })} · {modeLabel(e)}</small></span>
              <b>{money(e.amount, cur)}</b>
            </li>
          ))}
        </ul>
      </section>

      {form && <ExpenseForm d={d} me={me} initial={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); void reload() }} />}
    </>
  )
}

function ExpenseForm({ d, me, initial, onClose, onSaved }: { d: SFull; me: string; initial: SExpense | null; onClose: () => void; onSaved: () => void }) {
  const { t, money } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data?.settings
  const expenseCats = settings?.categories.filter(c => c.type === 'expense') ?? []
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace('.', ',') : '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [paidBy, setPaidBy] = useState(initial?.paid_by ?? me)
  const [mode, setMode] = useState<SplitMode | 'default'>(initial?.split?.mode ?? 'default')
  const [custom, setCustom] = useState<Record<string, string>>(() => Object.fromEntries(d.members.map(m =>
    [m.user_id, String(initial?.split?.shares?.[m.user_id] ?? Math.round(100 / d.members.length))])))
  const [cat, setCat] = useState(initial?.category ?? expenseCats[0]?.id ?? '')
  const [mine, setMine] = useState(!initial && !!settings)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const n = parseAmount(amount) ?? 0
  const split: SExpense['split'] = mode === 'default' ? null
    : mode === 'custom' ? { mode, shares: Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, parseAmount(v) ?? 0])) } : { mode }
  const preview = n > 0 ? sharesFor({ id: '', paid_by: paidBy, date, description: '', amount: n, category: null, split }, d.members, d.budget.split_mode) : null

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!(n > 0) || !desc.trim()) { setErr(t('sh.errExpense')); return }
    setBusy(true)
    try {
      await saveExpense(d.budget.id, { id: initial?.id, paid_by: paidBy, date, description: desc.trim(), amount: n, category: cat || null, split })
      // la propria quota anche nel budget personale (come spesa nella categoria scelta)
      if (mine && preview && preview[me] > 0 && settings) {
        const share = Math.round(n * preview[me] * 100) / 100
        dispatch({ type: 'addTx', tx: { id: newId(), date, description: `${desc.trim()} · ${d.budget.name}`, category: cat || null, amount: share } })
      }
      onSaved()
    } catch { setErr(t('sh.errLoad')) } finally { setBusy(false) }
  }
  return (
    <div className="sh-backdrop" onClick={onClose}>
      <form className="card sh-form" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="card-head"><h3 className="h-plain">{initial ? t('sh.editExpense') : t('sh.add')}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('action.cancel')}>×</button></div>
        <label className="field"><span>{t('tx.amount')} ({d.budget.currency})</span>
          <input className="salary-input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} autoFocus /></label>
        <label className="field"><span>{t('tx.description')}</span><input maxLength={120} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('sh.descHint')} /></label>
        <div className="two-col">
          <label className="field"><span>{t('tx.date')}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="field"><span>{t('sh.whoPaid')}</span>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)}>{d.members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}</select></label>
        </div>
        {expenseCats.length > 0 && <label className="field"><span>{t('tx.category')}</span>
          <select value={cat} onChange={e => setCat(e.target.value)}>{expenseCats.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}</select></label>}
        <fieldset className="field"><legend>{t('sh.split')}</legend>
          <div className="chips">
            {(['default', 'equal', 'income', 'payer', 'custom'] as const).map(k => (
              <button type="button" key={k} className={`chip${mode === k ? ' on' : ''}`} onClick={() => setMode(k)}>
                {k === 'default' ? t('sh.splitDefault', { mode: t(`sh.mode.${d.budget.split_mode}` as keyof Dict) }) : t(`sh.mode.${k}` as keyof Dict)}</button>
            ))}
          </div>
          {mode === 'custom' && <div className="share-grid">{d.members.map(m => (
            <label key={m.user_id} className="share-input"><span>{m.display_name}</span>
              <span className="pct-input"><input inputMode="decimal" value={custom[m.user_id]} onChange={e => setCustom({ ...custom, [m.user_id]: e.target.value })} />%</span></label>))}</div>}
          {preview && <p className="small muted">{d.members.map(m => `${m.display_name} ${money(n * (preview[m.user_id] ?? 0), d.budget.currency)}`).join(' · ')}</p>}
        </fieldset>
        {!initial && settings && <label className="check wrap-text"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
          <span>{t('sh.addMine')}</span></label>}
        {err && <p className="bad-text small">{err}</p>}
        <div className="stack-row top-gap">
          <button className="btn primary" disabled={busy}>{t('action.save')}</button>
          {initial && <button type="button" className="btn danger" onClick={async () => {
            if (!confirm(t('sh.deleteConfirm'))) return
            await deleteExpense(initial.id); onSaved()
          }}>{t('action.delete')}</button>}
        </div>
      </form>
    </div>
  )
}

function BudgetSettings({ d, me, onChange, onLeft }: { d: SFull; me: string; onChange: () => void; onLeft: () => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const self = d.members.find(m => m.user_id === me)
  const link = code ? `${window.location.origin}${import.meta.env.BASE_URL}app/?join=${code}` : ''
  const setMode = async (m: SFull['budget']['split_mode']) => { await updateBudget(d.budget.id, { split_mode: m }); onChange() }
  return (
    <section className="card sh-settings">
      <h3 className="h-plain">{t('sh.settings')}</h3>
      <label className="field"><span>{t('sh.name')}</span>
        <input maxLength={60} defaultValue={d.budget.name} onBlur={async e => { if (e.target.value.trim() && e.target.value !== d.budget.name) { await updateBudget(d.budget.id, { name: e.target.value.trim() }); onChange() } }} /></label>
      <fieldset className="field"><legend>{t('sh.defaultSplit')}</legend>
        <div className="chips">{(['equal', 'income', 'custom'] as const).map(m => (
          <button type="button" key={m} className={`chip${d.budget.split_mode === m ? ' on' : ''}`} onClick={() => void setMode(m)}>{t(`sh.mode.${m}` as keyof Dict)}</button>))}</div>
        <small className="muted">{t('sh.splitHint')}</small>
      </fieldset>
      {self && d.budget.split_mode === 'income' && (
        <label className="field"><span>{t('sh.myIncome')}</span>
          <input inputMode="decimal" defaultValue={self.income != null ? String(self.income).replace('.', ',') : ''}
            onBlur={async e => { await updateMember(d.budget.id, me, { income: parseAmount(e.target.value) }); onChange() }} />
          <small className="muted">{t('sh.incomeHint')}</small></label>
      )}
      {d.budget.split_mode === 'custom' && (
        <div className="share-grid">{d.members.map(m => (
          <label key={m.user_id} className="share-input"><span>{m.display_name}</span>
            <span className="pct-input"><input inputMode="decimal" defaultValue={m.share ?? ''}
              onBlur={async e => { await updateMember(d.budget.id, m.user_id, { share: parseAmount(e.target.value) }); onChange() }} />%</span></label>))}</div>
      )}
      <div className="sh-invite">
        <p><b>{t('sh.invite')}</b><br /><span className="small muted">{t('sh.inviteHint')}</span></p>
        {!code ? <button className="btn" onClick={async () => setCode(await createInvite(d.budget.id))}><Icon name="key" size={16} />{t('sh.makeCode')}</button> : <>
          <p className="sh-code">{code}</p>
          <div className="stack-row">
            <button className="btn" onClick={async () => {
              const text = t('sh.inviteText', { name: d.budget.name, code })
              try { if (navigator.share) await navigator.share({ title: 'Quadriamo', text, url: link }); else { await navigator.clipboard.writeText(`${text} ${link}`); setCopied(true) } } catch { /* annullato */ }
            }}><Icon name="share" size={16} />{t('sh.shareInvite')}</button>
            {copied && <span className="small good-text"><Icon name="check" size={16} />{t('beta.copied')}</span>}
          </div>
        </>}
      </div>
      <button className="link-btn bad-text" onClick={async () => {
        if (!confirm(t('sh.leaveConfirm'))) return
        await leaveBudget(d.budget.id, me); onLeft()
      }}>{t('sh.leave')}</button>
    </section>
  )
}
