// Harness di test: provider, SDK e componenti del prodotto, storage del browser reale.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@app/App'
import '@app/styles/index.css'
import { I18nProvider } from '@app/i18n'
import { prepareI18n } from '@app/i18n/core'
import { SessionProvider } from '@app/sync/SessionProvider'
import { AccountBoundary } from '@app/sync/AccountBoundary'
import { useSession } from '@app/sync/sessionContext'
import { useStore } from '@app/store/context'
import { useSync } from '@app/sync/context'
import { useSettingsDraft } from '@app/ui/settings/draft'
import { DataSection } from '@app/ui/settings/Data'
import { InboxView } from '@app/ui/InboxView'
import { createInitial } from '@app/store/model'
import type { AppData } from '@app/store/types'
import { composerSnapshot, openComposer } from '@app/app/composer'
import { useAvatar, loadAvatar, setAvatar } from '@app/profile/avatar'
import { personalFor } from '@app/storage'
import { supabase } from '@app/sync/client'

const today = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export function Probe() {
  const { state, dispatch, storage, lease } = useStore()
  const session = useSession(), sync = useSync(), avatar = useAvatar()
  useEffect(() => {
    const api = {
      snapshot: () => ({ state: storage.getSnapshot(), scope: lease.scope, epoch: lease.id,
        user: session.user?.id, status: sync.status, composer: composerSnapshot(), avatar }),
      signIn: (id: string) => session.signIn(id + '@synthetic.invalid', 'Synthetic-test-only-42'),
      signOut: () => session.signOut(),
      add: (id: string) => dispatch({ type: 'addTx', tx: { id, description: id, date: today(), amount: 1, category: 'groceries' } }),
      edit: (id: string, amount: number, currency?: string) => { const tx = storage.getSnapshot().state.data?.transactions.find(t => t.id === id); if (tx) dispatch({ type: 'updateTx', tx: { ...tx, amount, ...(currency ? { currency } : {}) } }) },
      remove: (id: string) => dispatch({ type: 'deleteTx', id }),
      currency: (currency: string) => { const data = storage.getSnapshot().state.data; if (data) dispatch({ type: 'setSettings', settings: { ...data.settings, currency } }) },
      replace: (data: AppData | null) => dispatch({ type: 'replace', data }),
      initial: (id: string) => {
        const data = createInitial('EUR', today())
        data.transactions.push({ id, description: id, date: today(), amount: 10, category: 'groceries' })
        return data
      },
      flush: () => storage.flush(), retry: () => storage.retry(), sync: sync.syncNow,
      demo: () => session.startDemo({ ...createInitial('EUR', today()), demo: true }),
      exit: session.endPreview,
      draft: () => openComposer({ tx: state.data?.transactions[0] }),
      preference: (value: string) => personalFor(lease.scope).set('q.sharedBudget', value),
      updateNames: session.updateNames, updatePassword: session.updatePassword,
      uploadAvatar: (data: string) => setAvatar(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], 'test.png', {type:'image/png'}), session.user?.id ?? null),
      preload: () => Promise.all([import('@app/ui/screens/AnalysisScreen.tsx'), import('@app/ui/screens/NewsScreen.tsx'), import('@app/ui/profile/ProfileScreen.tsx')]),
      verifyRecovery: session.verifyRecovery, resetPassword: session.resetPassword,
      getPreference: () => personalFor(lease.scope).get('q.sharedBudget'),
      auth: supabase.auth, avatar: (id: string) => loadAvatar(id),
    }
    window.accountTest = api
    return () => { if (window.accountTest === api) delete window.accountTest }
  }, [state, storage, lease, session, sync, dispatch, avatar])
  return <aside data-testid="probe" style={{ padding: 8, border: '2px solid #888' }}>
    <b data-testid="owner">{lease.scope.kind}:{lease.scope.owner || 'none'}</b>
    <span data-testid="records">{state.data?.transactions.map(x => x.description).join('|')}</span>
    {state.data && <TestImports />}
  </aside>
}
export function TestImports() {
  const draft = useSettingsDraft()
  return <details data-testid="test-imports"><summary>Test imports</summary>
    <div data-testid="json-import"><DataSection d={draft} wizard={false} /></div>
    <div data-testid="csv-import"><InboxView settings={draft.data.settings} /></div>
  </details>
}
const originalPut = IDBObjectStore.prototype.put
IDBObjectStore.prototype.put = function(value, key) {
  if (window.failCacheWrites && typeof key === 'string' && key.startsWith('quadriamo.data.v2/')) throw new DOMException('synthetic quota', 'QuotaExceededError')
  return originalPut.call(this, value, key)
}
const originalGet = IDBObjectStore.prototype.get
IDBObjectStore.prototype.get = function(key) {
  if ((window.failCacheReads || sessionStorage.getItem('failCacheReads')) && typeof key === 'string' && key.startsWith('quadriamo.data.v2/')) throw new DOMException('synthetic read failure', 'InvalidStateError')
  return originalGet.call(this, key)
}
void prepareI18n().then(start => createRoot(document.getElementById('root')!).render(
  <StrictMode><I18nProvider start={start}><SessionProvider><AccountBoundary>
    <Probe /><App />
  </AccountBoundary></SessionProvider></I18nProvider></StrictMode>,
))
