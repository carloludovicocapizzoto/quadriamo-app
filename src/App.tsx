import { useEffect, useMemo, useState } from 'react'
import { demoAppData } from './demo'
import { computeMonth, monthOf, todayIso, undated, type ClassifiedTx, type Transaction, type YearMonth } from './engine'
import { LANGS, useI18n, type Lang } from './i18n/core'
import { useStore } from './store/context'
import { createInitial } from './store/state'
import { useSync } from './sync/context'
import { MonthNav } from './ui/MonthNav'
import { MonthView } from './ui/MonthView'
import { Onboarding } from './ui/Onboarding'
import { SettingsView } from './ui/SettingsView'
import { TransactionsView } from './ui/TransactionsView'
import { TxForm } from './ui/TxForm'
import { YearNav, YearView } from './ui/YearView'
import { InvestmentsView } from './ui/InvestmentsView'
import { FxAutoUpdate } from './ui/FxAutoUpdate'

type Tab = 'month' | 'transactions' | 'year' | 'investments' | 'settings'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const { state, dispatch } = useStore()
  const sync = useSync()
  const today = todayIso()
  // ?login=1 (pulsante "Accedi" del sito): si apre direttamente l'area account
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(window.location.search).get('login') === '1' ? 'settings' : 'month')
  const [ym, setYm] = useState<YearMonth | null>(null)
  const [year, setYear] = useState(() => Number(todayIso().slice(0, 4)))
  // link di inserimento rapido: ?add=1&amount=12,50&desc=Pizza&cat=eatingOut (scorciatoia sull'icona, Comandi Rapidi)
  const [form, setForm] = useState<{ tx?: Transaction; prefill?: { amount?: string; description?: string; category?: string } } | null>(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('add') !== '1') return null
    return { prefill: { amount: q.get('amount') ?? undefined, description: q.get('desc') ?? undefined, category: q.get('cat') ?? undefined } }
  })
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  const [note, setNote] = useState('')
  const data = state.data

  const current = ym ?? (data ? monthOf(today, data.settings.monthStartDay) : null)
  const result = useMemo(
    () => data && current ? computeMonth(current, data.transactions, data.settings, today) : null,
    [data, current, today])

  if (!state.loaded) return <div className="app"><p className="muted top-gap">{t('app.loading')}</p></div>

  const header = (
    <header className="top">
      <a className="logo" href={import.meta.env.BASE_URL}>Quadriamo<span>.</span> <small className="beta">{t('beta.badge')}</small></a>
      {sync.user && (
        <button className="sync-pill" onClick={() => void sync.syncNow()} title={t('sync.now')}>
          <span className={`dot ${sync.status}`} aria-hidden="true" />
          {sync.status === 'syncing' ? t('sync.syncing') : sync.status === 'error' ? '!' : sync.status === 'offline' ? 'offline' : t('sync.ok')}
        </button>
      )}
      {!data && (
        <select className="lang" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
          {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      )}
    </header>
  )

  if (!data || !result || !current) {
    return (
      <div className="app">
        {header}
        <Onboarding
          onStart={(currency, startDay) => dispatch({ type: 'replace', data: createInitial(currency, today, startDay) })}
          onDemo={() => dispatch({ type: 'replace', data: demoAppData(today) })} />
      </div>
    )
  }

  const openTx = (tx: ClassifiedTx | Transaction) => {
    if ('recurring' in tx && tx.recurring) { setNote(t('tx.recurringHint')); setTimeout(() => setNote(''), 3000); return }
    const orig = data.transactions.find(x => x.id === tx.id)
    if (orig) setForm({ tx: orig })
  }
  // la data proposta è oggi se si guarda il mese corrente, altrimenti l'inizio del mese guardato
  const isCurrent = result.period.start <= today && today <= result.period.end
  const defaultDate = isCurrent ? today : result.period.start

  return (
    <div className="app has-nav">
      {header}
      {data.demo && (
        <div className="demo-banner">
          <span>{t('demo.banner')}</span>
          <button className="btn small-btn" onClick={() => {
            const fresh = createInitial(data.settings.currency, today, data.settings.monthStartDay)
            dispatch({ type: 'replace', data: fresh }); setYm(null)
          }}>{t('demo.clear')}</button>
        </div>
      )}

      <main>
        {(tab === 'month' || tab === 'transactions') && <MonthNav ym={current} onChange={setYm} />}
        {tab === 'year' && <YearNav year={year} onChange={setYear} />}
        {tab === 'year' && <YearView year={year} transactions={data.transactions} settings={data.settings} today={today}
                                     onYear={setYear} onOpenMonth={m => { setYm(m); setTab('month'); window.scrollTo(0, 0) }} />}
        {tab === 'month' && <MonthView r={result} settings={data.settings} onOpen={openTx} today={today} />}
        {tab === 'transactions' &&
          <TransactionsView r={result} settings={data.settings} undated={undated(data.transactions)} onOpen={openTx} />}
        {tab === 'investments' && <InvestmentsView settings={data.settings} transactions={data.transactions} today={today}
                                                   year={year} onYear={setYear} />}
        {tab === 'settings' && <SettingsView />}
        <FxAutoUpdate today={today} />
      </main>

      {note && <div className="toast" role="status">{note}</div>}

      {(tab === 'month' || tab === 'transactions') && (
        <button className="fab" onClick={() => setForm({})} aria-label={t('action.add')}>+</button>
      )}

      <nav className="bottom-nav" aria-label="Quadriamo">
        {(['month', 'transactions', 'year', 'investments', 'settings'] as Tab[]).map(k => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}
                  onClick={() => { setTab(k); if ((k === 'year' || k === 'investments') && current) setYear(current.year); window.scrollTo(0, 0) }}>
            <span aria-hidden="true">{{ month: '◧', transactions: '☰', year: '▥', investments: '↗', settings: '⚙' }[k]}</span>
            {t(`nav.${k}`)}
          </button>
        ))}
      </nav>

      {form && (
        <TxForm
          settings={data.settings}
          initial={form.tx}
          prefill={form.prefill}
          defaultDate={defaultDate}
          onClose={() => setForm(null)}
          onSave={tx => { dispatch({ type: form.tx ? 'updateTx' : 'addTx', tx }); setForm(null) }}
          onDelete={id => { dispatch({ type: 'deleteTx', id }); setForm(null) }} />
      )}
    </div>
  )
}
