// L'app vera e propria: barra in alto, pagina corrente (dall'indirizzo), barra in basso, "nuovo movimento", messaggi.
import { lazy, Suspense, useState } from 'react'
import { mainIncome, todayBudget, type ClassifiedTx, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { createInitial } from '../store/state'
import { useSync } from '../sync/context'
import { usePlan } from '../billing/plan'
import { ConsentCard } from '../ui/beta/ConsentCard'
import { FeedbackCard } from '../ui/beta/FeedbackCard'
import { FxAutoUpdate } from '../ui/FxAutoUpdate'
import { HomeScreen } from '../ui/home/HomeScreen'
import { BUCKET_COLORS, bucketName } from '../ui/names'
import { ProfileForm } from '../ui/ProfileForm'
import { BottomNav } from '../ui/shell/BottomNav'
import { TopBar } from '../ui/shell/TopBar'
import { StreakCelebration } from '../ui/Streak'
import { TxForm } from '../ui/TxForm'
import { profilePrompt } from '../sync/profile'
import { closeComposer, openComposer, useComposer } from './composer'
import { useBootstrap, useDailyPing, useMorningSnapshot, useProReturn, usePushSync, useReviewed } from './effects'
import { useEntry } from './entryContext'
import { closeFeedback, openFeedback, useFeedbackOpen } from './prompts'
import { navigate, useRoute, type Route } from './router'
import { toast, useToast } from './toast'
import { useModel, ymKey } from './useModel'
import { SectionBoundary } from './SectionBoundary'

// le pagine meno usate si scaricano solo quando servono
const AnalysisScreen = lazy(() => import('../ui/screens/AnalysisScreen').then(m => ({ default: m.AnalysisScreen })))
const NewsScreen = lazy(() => import('../ui/screens/NewsScreen').then(m => ({ default: m.NewsScreen })))
const ProfileScreen = lazy(() => import('../ui/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })))

export function AppShell() {
  const { t, lang } = useI18n()
  const { state, dispatch } = useStore()
  const sync = useSync()
  const plan = usePlan()
  const route = useRoute()
  const entry = useEntry()
  const data = state.data!
  const { today, viewed, month, thisMonth, streak } = useModel(data, route)
  const composer = useComposer()
  const feedback = useFeedbackOpen()
  const note = useToast()
  const [askProfile, setAskProfile] = useState(() => profilePrompt.get())

  useBootstrap()
  useProReturn(t)
  useMorningSnapshot(data, thisMonth, streak, today, lang, t)
  usePushSync(lang, !!streak?.doneToday, today, !!data.demo)
  const ping = useDailyPing(data, state.loaded, !!sync.user, today, lang)
  const reviewed = useReviewed(route.tab === 'analysis', today)

  if (!month || !thisMonth || !viewed) return null
  const openTx = (tx: ClassifiedTx | Transaction) => {
    if ('recurring' in tx && tx.recurring) { toast(t('tx.recurringHint')); return }
    const orig = data.transactions.find(x => x.id === tx.id)
    if (orig) openComposer({ tx: orig })
  }
  // la data proposta è oggi se si guarda il mese corrente, altrimenti l'inizio del mese guardato
  const defaultDate = route.tab !== 'analysis' || (month.period.start <= today && today <= month.period.end) ? today : month.period.start
  const budget = todayBudget(thisMonth, data.settings, today)
  const parts = budget.parts.map(p => {
    const i = data.settings.buckets.findIndex(b => b.id === p.bucketId)
    return { name: bucketName(data.settings.buckets[i], t), color: BUCKET_COLORS[i], perDay: p.perDay, over: p.free < 0 }
  })
  const go = (r: Route) => navigate(r)
  const toTransactions = () => go({ tab: 'analysis', view: 'transactions' })
  const importStatement = () => { toTransactions(); setTimeout(() => document.querySelector<HTMLInputElement>('input[type=file]')?.click(), 150) }

  return (
    <div className="app has-nav app2">
      <TopBar streak={streak} activity={data.activity ?? []} today={today} todayLeft={budget.parts.length && thisMonth.income ? budget.left : null}
              parts={parts} currency={data.settings.currency} initial={(sync.user?.firstName || sync.user?.email || '').charAt(0).toUpperCase()}
              pro={plan.pro} onProfile={() => go({ tab: 'profile' })} />
      {data.demo && (
        <div className="demo-banner">
          <span>{t('demo.banner')}</span>
          <button className="btn small-btn" onClick={() => {
            dispatch({ type: 'replace', data: createInitial(data.settings.currency, today, data.settings.monthStartDay) }); go({ tab: 'home' })
          }}>{t('demo.clear')}</button>
        </div>
      )}

      <main key={route.tab} className="app-enter tab-in">
        <SectionBoundary>
          <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
            {route.tab === 'home' && <>
              <ConsentCard onAnswer={yes => ping(yes)} />
              {sync.user && askProfile && !data.demo && !entry.inSetup && (
                <section className="card"><h3 className="h-plain">{t('prof.promptTitle')}</h3><ProfileForm onDone={() => setAskProfile(false)} /></section>)}
              {feedback && <FeedbackCard onClose={closeFeedback} />}
              <HomeScreen data={data} r={thisMonth} today={today} streak={streak} reviewed={reviewed}
                onAdd={kind => openComposer(kind === 'income' ? { prefill: { category: mainIncome(data.settings) } } : {})}
                onOpen={openTx} onAll={toTransactions} onImport={importStatement}
                onShared={() => go({ tab: 'profile', page: 'shared' })}
                onAnalysis={() => go({ tab: 'analysis', view: 'month' })}
                onRecurring={() => go({ tab: 'profile', page: 'recurring' })}
                onNews={() => go({ tab: 'news' })} />
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
              onFeedback={() => { openFeedback(); go({ tab: 'home' }) }}
              onAdmin={() => window.location.assign(`${import.meta.env.BASE_URL}admin/`)} />}
          </Suspense>
        </SectionBoundary>
        <FxAutoUpdate today={today} />
      </main>

      {note && <div key={note.id} className="toast" role="status">{note.text}</div>}
      <StreakCelebration s={streak} />
      <BottomNav tab={route.tab} onTab={tab => go(tab === 'analysis' ? { tab, view: 'transactions' } : { tab } as Route)} onAdd={() => openComposer()} badge={{ analysis: data.inbox?.length ?? 0 }} />

      {composer && (
        <TxForm settings={data.settings} initial={composer.tx} prefill={composer.prefill} defaultDate={defaultDate}
          onClose={closeComposer}
          onSave={tx => { dispatch({ type: composer.tx ? 'updateTx' : 'addTx', tx }); closeComposer() }}
          onDelete={id => { dispatch({ type: 'deleteTx', id }); closeComposer() }} />
      )}
    </div>
  )
}
