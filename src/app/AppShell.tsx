// L'app vera e propria: pagina corrente (dall'indirizzo), barra in basso, "nuovo movimento", messaggi.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { mainIncome, type ClassifiedTx, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { createInitial } from '../store/state'
import { useSync } from '../sync/context'
import { ConsentCard } from '../ui/beta/ConsentCard'
import { FeedbackCard } from '../ui/beta/FeedbackCard'
import { FxAutoUpdate } from '../ui/FxAutoUpdate'
import { HomeScreen } from '../ui/home/HomeScreen'
import { ProfileForm } from '../ui/ProfileForm'
import { BottomNav } from '../ui/shell/BottomNav'
import { StreakCelebration } from '../ui/Streak'
import { TxForm } from '../ui/TxForm'
import { Sheet } from '../ui/kit/Sheet'
import { profilePrompt } from '../sync/profile'
import { closeComposer, openComposer, useComposer } from './composer'
import { useBootstrap, useDailyPing, useMorningSnapshot, useProReturn, useUpdatedNotice, usePushSync } from './effects'
import { useEntry } from './entryContext'
import { SHORTCUTS, useShortcuts } from './shortcuts'
import { closeFeedback, useFeedbackOpen } from './prompts'
import { ANALYSIS_VIEWS, navigate, useRoute, type Route } from './router'
import { toast, useToast } from './toast'
import { useModel, ymKey } from './useModel'
import { SectionBoundary } from './SectionBoundary'
import { ENV } from '../env'

// le pagine meno usate si scaricano solo quando servono
// le altre sezioni si scaricano a parte; appena il telefono è libero si precaricano, così il primo tocco è immediato
const loadAnalysis = () => import('../ui/screens/AnalysisScreen'), loadNews = () => import('../ui/screens/NewsScreen'), loadProfile = () => import('../ui/profile/ProfileScreen')
const AnalysisScreen = lazy(() => loadAnalysis().then(m => ({ default: m.AnalysisScreen })))
const NewsScreen = lazy(() => loadNews().then(m => ({ default: m.NewsScreen })))
const ProfileScreen = lazy(() => loadProfile().then(m => ({ default: m.ProfileScreen })))
const idle = (f: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 2000))

export function AppShell() {
  const { t, lang } = useI18n()
  const { state, dispatch } = useStore()
  const sync = useSync()
  const route = useRoute()
  const entry = useEntry()
  const data = state.data!
  const { today, viewed, month, thisMonth, streak } = useModel(data, route)
  useEffect(() => { idle(() => { void loadAnalysis(); void loadNews(); void loadProfile() }) }, [])
  const [keysHelp, setKeysHelp] = useState(false)
  const openKeys = useCallback(() => setKeysHelp(true), [])
  useShortcuts(openKeys)

  // lo sfondo della sezione (design/backgrounds.css): Investi ha il suo dentro Analisi; le barre di sistema seguono il colore
  const section = route.tab === 'analysis' && route.view === 'investments' ? 'investments' : route.tab
  useEffect(() => {
    document.documentElement.dataset.section = section
    const id = setTimeout(() => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--bg-t').trim()
      if (c) for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = c
    }, 700)
    // uscendo dall'app (es. dall'account) lo sfondo torna quello dell'ingresso
    return () => { clearTimeout(id); delete document.documentElement.dataset.section }
  }, [section])
  const composer = useComposer()
  const feedback = useFeedbackOpen()
  const note = useToast()
  const [askProfile, setAskProfile] = useState(() => profilePrompt.get())

  useBootstrap()
  useProReturn(t)
  useUpdatedNotice(t)
  useMorningSnapshot(data, thisMonth, streak, today, lang, t)
  usePushSync(lang, !!streak?.doneToday, today, !!data.demo)
  const ping = useDailyPing(data, state.loaded, !!sync.user, today, lang)

  if (!month || !thisMonth || !viewed) return null
  const openTx = (tx: ClassifiedTx | Transaction) => {
    if ('recurring' in tx && tx.recurring) { toast(t('tx.recurringHint')); return }
    const orig = data.transactions.find(x => x.id === tx.id)
    if (orig) openComposer({ tx: orig })
  }
  // la data proposta è oggi se si guarda il mese corrente, altrimenti l'inizio del mese guardato
  const defaultDate = route.tab !== 'analysis' || (month.period.start <= today && today <= month.period.end) ? today : month.period.start
  const go = (r: Route) => navigate(r)
  const toTransactions = () => go({ tab: 'analysis', view: 'transactions' })
  const importStatement = () => { toTransactions(); setTimeout(() => document.querySelector<HTMLInputElement>('input[type=file]')?.click(), 150) }

  return (
    <div className="app has-nav app2">
      {data.demo && (
        <div className="demo-banner">
          <span>{t('demo.banner')}</span>
          <button className="btn small-btn" onClick={() => {
            // senza account si torna all'accesso: i propri dati si inseriscono solo con l'account
            dispatch({ type: 'replace', data: sync.enabled && !sync.user ? null : createInitial(data.settings.currency, today, data.settings.monthStartDay) }); go({ tab: 'home' })
          }}>{t('demo.clear')}</button>
        </div>
      )}

      <main key={route.tab}>
        <SectionBoundary>
          <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
            {route.tab === 'home' && <>
              <ConsentCard onAnswer={yes => ping(yes)} />
              {sync.user && askProfile && !data.demo && !entry.inSetup && (
                <section className="card"><h3 className="h-plain">{t('prof.promptTitle')}</h3><ProfileForm onDone={() => setAskProfile(false)} /></section>)}
              {feedback && <FeedbackCard onClose={closeFeedback} />}
              <HomeScreen data={data} r={thisMonth} today={today} streak={streak}
                onAdd={kind => openComposer(kind === 'income' ? { prefill: { category: mainIncome(data.settings) } } : {})}
                onOpen={openTx} onAll={toTransactions} />
            </>}
            {route.tab === 'news' && <NewsScreen onAction={a => {
              if (a === 'add') openComposer()
              else if (a === 'analysis') go({ tab: 'analysis', view: 'month' })
              else if (a === 'import') importStatement()
              else if (a === 'shared') go({ tab: 'profile', page: 'shared' })
              else if (a === 'recurring') go({ tab: 'profile', page: 'recurring' })
              else go({ tab: 'home' })
            }} />}
            {route.tab === 'analysis' && <AnalysisScreen view={route.view} data={data} result={month} current={viewed} homeResult={thisMonth} today={today}
              year={route.year ?? viewed.year}
              onView={v => go({ tab: 'analysis', view: v, ...(route.month ? { month: route.month } : {}) })}
              onMonth={ym => navigate({ tab: 'analysis', view: route.view, month: ymKey(ym) }, { replace: true })}
              onYear={y => navigate({ tab: 'analysis', view: route.view, year: y, ...(route.month ? { month: route.month } : {}) }, { replace: true })}
              onOpen={openTx} />}
            {route.tab === 'profile' && <ProfileScreen page={route.page ?? null} onPage={p => go(p ? { tab: 'profile', page: p } : { tab: 'profile' })}
              data={data} streak={streak} today={today} onLogin={entry.openLogin}
              onAdmin={() => window.location.assign(`${ENV.base}admin/`)} />}
          </Suspense>
        </SectionBoundary>
        <FxAutoUpdate today={today} />
      </main>

      {note && <div key={note.id} className="toast" role="status">{note.text}</div>}
      <StreakCelebration s={streak} />
      <Sheet open={keysHelp} onClose={() => setKeysHelp(false)} title={t('kb.title')}>
        <ul className="group-list kb-list">{SHORTCUTS.map(([k, label]) => (
          <li key={k}><div className="row"><span className="row-main">{t(label as 'kb.new')}</span><span className="row-value">{k.split(' ').map(x => <kbd key={x}>{x}</kbd>)}</span></div></li>))}</ul>
      </Sheet>
      <BottomNav tab={route.tab} onTab={tab => go(tab === 'analysis' ? { tab, view: ANALYSIS_VIEWS[0] } : { tab } as Route)} onAdd={() => openComposer()} badge={{ analysis: data.inbox?.length ?? 0 }} />

      <Sheet open={composer.open} onClose={closeComposer} label={composer.value.tx ? t('tx.edit') : t('tx.new')}>
        <TxForm key={composer.key} settings={data.settings} initial={composer.value.tx} prefill={composer.value.prefill} defaultDate={defaultDate}
          onClose={closeComposer}
          onSave={tx => { dispatch({ type: composer.value.tx ? 'updateTx' : 'addTx', tx }); closeComposer() }}
          onDelete={id => { dispatch({ type: 'deleteTx', id }); closeComposer() }} />
      </Sheet>
    </div>
  )
}
