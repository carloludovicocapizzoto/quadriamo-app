import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/core'
import type { AccountStore } from '../store/accountStore'
import { exportCache } from '../store/persist'
import type { ScopeLease } from '../store/scope'
import type { AppData } from '../store/types'
import { downloadFile } from '../ui/kit/download'
import { bucketName, categoryName } from '../ui/names'
import type { SyncStatus } from './context'
import { clone, EVENT, resolveConflict, valueAt, type DataConflict } from './protocol'
import { differences } from './differences'
import '../styles/sync.css'
import { useSession } from './sessionContext'

type SyncFailureKey = 'cloud.documentTooLarge' | 'cloud.requestTooLarge' | 'cloud.documentInvalid' | 'cloud.operationRejected'

export function SyncRecovery({ storage, lease, status, retry, activate, failureCode }: {
  storage: AccountStore; lease: ScopeLease; status: SyncStatus; retry: () => Promise<void>; activate: () => Promise<void>; failureCode?: SyncFailureKey | null
}) {
  const { t } = useI18n(), snapshot = storage.getSnapshot(), cloud = snapshot.cloud
  const { localSession } = useSession()
  const [failed, setFailed] = useState(false)
  const cooldownAt = cloud?.cooldownUntil ? Date.parse(cloud.cooldownUntil) : 0
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!cooldownAt) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= cooldownAt) window.clearInterval(timer)
    }, 250)
    return () => window.clearInterval(timer)
  }, [cooldownAt])
  const exportAll = async () => {
    let persisted: unknown
    try { persisted = await exportCache(lease.scope) } catch { /* anche il buffer non salvato è esportabile */ }
    if (lease.current()) downloadFile('quadriamo-sync-recovery', 'json', JSON.stringify({ format: 'quadriamo-sync-recovery-v1', scope: lease.scope,
      current: storage.getSnapshot(), persisted }, null, 2), 'application/json')
  }
  if (!lease.current()) return null
  const coolingDown = cooldownAt > now
  return <section className="cloud-notice card" aria-label={t('cloud.title')} data-testid="cloud-status">
    {localSession && <p>{t('auth.localSession')}</p>}
    <p role="status" aria-live="polite">{status === 'ok' && cloud?.base ? t('cloud.confirmed', { revision: cloud.base.revision })
      : status === 'syncing' ? t('sync.syncing') : status === 'ok' ? t('cloud.idle') : t(`cloud.${status}`)}</p>
    {coolingDown && <p role="note">{t('cloud.rateLimited', { time: new Date(cooldownAt).toLocaleTimeString() })}</p>}
    {status === 'error' && failureCode && <p role="alert">{t(failureCode)}</p>}
    {(status === 'upgrade' || status === 'paused') && <p>{t(cloud?.activationBlocked ? 'cloud.pilotWait' : cloud?.available ? 'cloud.activationHint' : 'cloud.upgradeHint')}</p>}
    <div className="cloud-actions">
      <button className="btn small-btn" onClick={() => void exportAll().catch(() => setFailed(true))}>{t('cloud.exportAll')}</button>
      <button className="btn small-btn" disabled={status === 'syncing' || !!snapshot.error || coolingDown} onClick={() => void retry()}>{t('cloud.retry')}</button>
      {cloud?.available && <button className="btn" disabled={status === 'syncing' || !!snapshot.error} onClick={() => void activate()}>{t('cloud.activate')}</button>}
    </div>
    {failed && <p role="alert">{t('cloud.actionError')}</p>}
    {cloud?.conflict?.cause === 'expired-receipt' && <p role="alert">{t('cloud.expiredReceiptConflict')}</p>}
    {cloud?.conflict && <ConflictForm key={cloud.conflict.id} conflict={cloud.conflict} storage={storage} lease={lease} onResolved={retry} />}
    {!!cloud?.recovery.length && <details><summary>{t('cloud.archive', { count: cloud.recovery.length })}</summary>
      <p>{t('cloud.archiveHint')}</p>
      {cloud.recovery.map(copy => <div className="cloud-archive" key={copy.id}>
        <time dateTime={copy.at}>{new Date(copy.at).toLocaleString()}</time>
        {(['local', 'remote'] as const).map(side => <button className="btn small-btn" key={side} disabled={copy[side] === null} title={copy[side] === null ? t('cloud.empty') : undefined} onClick={() => {
          if (lease.current()) downloadFile('quadriamo-recovered-' + side, 'json', JSON.stringify(copy[side], null, 2), 'application/json')
        }}>{t(side === 'local' ? 'cloud.exportLocal' : 'cloud.exportRemote')}</button>)}
      </div>)}
    </details>}
  </section>
}

function ConflictForm({ conflict, storage, lease, onResolved }: { conflict: DataConflict; storage: AccountStore; lease: ScopeLease; onResolved: () => Promise<void> }) {
  const { t } = useI18n(), [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({})
  const [error, setError] = useState(false), [saving, setSaving] = useState(false)
  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault(); setError(false); setSaving(true)
    try {
      await storage.updateCloud(lease, ({ data, cloud }) => {
        if (cloud.conflict?.id !== conflict.id) throw Error('conflict changed')
        const selected = resolveConflict(conflict, choices)
        // La cancellazione dell'intero archivio remoto richiede un protocollo distinto.
        if (!selected && conflict.remote.document) throw Error('remote archive deletion unsupported')
        cloud.recovery.push({ id: crypto.randomUUID(), at: new Date().toISOString(), reason: 'resolution',
          local: clone(data), remote: clone(conflict.remote.document), base: clone(conflict.base?.document ?? null) })
        cloud.base = clone(conflict.remote); cloud.pending = null; cloud.conflict = null; cloud.status = 'pending'
        return { data: selected, cloud }
      })
      // la scelta va subito sul cloud: se si tiene questa versione i dati locali non cambiano e niente altro farebbe ripartire l'invio
      if (lease.current()) void onResolved()
    } catch { if (lease.current()) setError(true) }
    finally { if (lease.current()) setSaving(false) }
  }
  // la domanda riguarda tutto l'archivio, un movimento, una scadenza o un solo campo (es. "Configurazione / Giorno di inizio del mese")
  const title = (path: string) => {
    if (path === '/document') return t('cloud.wholeDocument')
    if (path.startsWith(EVENT)) return t('cloud.events')
    if (path.startsWith('/transactions/')) return t('cloud.transaction')
    const names: Record<string, Parameters<typeof t>[0]> = { settings: 'cloud.configuration', currency: 'cloud.currency', monthStartDay: 'cloud.startDay',
      buckets: 'cloud.buckets', categories: 'cloud.categories', firstMonth: 'cloud.firstMonth', goals: 'cloud.goals', rules: 'cloud.rules' }
    const parts = path.split('/').slice(1), item = ['categories', 'rules', 'goals'].includes(parts.at(-2)!)
    const words = parts.filter(part => Object.hasOwn(names, part)).map(part => t(names[part]))
    return (item || Object.hasOwn(names, parts.at(-1)!) ? words : [...words, t('cloud.setting')]).join(' / ')
  }
  return <details className="cloud-conflict" open>
    <summary>{t(conflict.base ? 'cloud.conflictTitle' : 'cloud.recoveryTitle')}</summary>
    <p>{t(conflict.base ? 'cloud.conflictHint' : 'cloud.noBase')}</p>
    {conflict.cause === 'revision' && <p role="alert">{t('cloud.revisionConflict')}</p>}
    {conflict.local === null && conflict.remote.document !== null && <p role="note">{t('cloud.clearBlocked')}</p>}
    <form onSubmit={event => void submit(event)}>
      {conflict.paths.map(path => <fieldset key={path}>
        <legend>{title(path)}</legend>
        {path === '/document' && <p>{t('cloud.wholeHint')}</p>}
        <div className="cloud-versions">{(['local', 'remote'] as const).map(side => {
          const document = side === 'local' ? conflict.local : conflict.remote.document
          return <label className="cloud-version" key={side}>
            <span><input type="radio" name={conflict.id + path} value={side} checked={choices[path] === side}
              disabled={saving || path === '/document' && document === null && conflict.remote.document !== null}
              onChange={() => setChoices(old => ({ ...old, [path]: side }))} /> {t(side === 'local' ? 'cloud.local' : 'cloud.remote')}</span>
            <Version document={document} other={side === 'local' ? conflict.remote.document : conflict.local} path={path} />
          </label>
        })}</div>
      </fieldset>)}
      <p>{t('cloud.resolveHint')}</p>
      <button className="btn primary" disabled={saving || conflict.paths.some(path => !choices[path]) || !!storage.getSnapshot().error}>{t('cloud.apply')}</button>
      <p className="small">{t('cloud.defer')}</p>
      {error && <p role="alert">{t('cloud.actionError')}</p>}
    </form>
  </details>
}

function Version({ document, other, path }: { document: AppData | null; other: AppData | null; path: string }) {
  const { t, money, date, lang } = useI18n()
  if (!document) return <p>{t('cloud.empty')}</p>
  const labels: Record<string, string> = { settings: t('cloud.configuration'), currency: t('cloud.currency'), monthStartDay: t('cloud.startDay'),
    amount: t('cloud.amount'), description: t('cloud.description'), date: t('cloud.date'), category: t('cloud.category'),
    buckets: t('cloud.buckets'), categories: t('cloud.categories'), events: t('cloud.events'), share: t('cloud.share'),
    startingBalance: t('cloud.startingBalance'), name: t('cloud.name'), firstMonth: t('cloud.firstMonth'), year: t('cloud.year'), month: t('cloud.month'),
    paidFrom: t('cloud.paidFrom'), split: t('cloud.split'), fxRate: t('cloud.exchangeRate'), updatedAt: t('cloud.changedAt') }
  const configuration = (d: AppData | null) => Object.fromEntries(Object.entries(d ?? {}).filter(([key]) => !['transactions', 'deleted', 'activity', 'version'].includes(key) && !key.endsWith('UpdatedAt')))
  if (path === '/document') return <>
    <p>{t('cloud.transactionCount', { count: document.transactions.length })}</p>
    <dl><dt>{t('cloud.currency')}</dt><dd>{document.settings.currency}</dd>
      <dt>{t('cloud.startDay')}</dt><dd>{document.settings.monthStartDay}</dd></dl>
    <ul>{document.settings.buckets.map(bucket => <li key={bucket.id}>{bucketName(bucket, t)}: {(bucket.share * 100).toLocaleString(lang, { maximumFractionDigits: 4 })}%</li>)}</ul>
    <dl className="cloud-differences">{differences(configuration(document), configuration(other)).map((row, index) => <div key={index}>
      <dt>{row.path.map(key => labels[key] ?? (/^\d+$/.test(key) ? String(Number(key) + 1) : key)).join(' / ')}</dt>
      <dd>{row.value === undefined || row.value === null ? '—' : typeof row.value === 'boolean' ? t(row.value ? 'cloud.yes' : 'cloud.no') : String(row.value)}</dd>
    </div>)}</dl>
    <details><summary>{t('cloud.contents')}</summary>{document.transactions.map(tx => <p key={tx.id}>{tx.date ? date(tx.date) : '—'} · {tx.description} · {tx.amount === null ? '—' : money(tx.amount, tx.currency || document.settings.currency)}</p>)}</details>
  </>
  if (path.startsWith(EVENT)) {
    // tutto l'evento (`…/<id>`) oppure un solo campo (`…/<id>/<campo>`), quando l'altra versione ha cambiato altri campi
    const [id, field] = path.slice(EVENT.length).split('/')
    const event = document.settings.events.find(item => item.id === id)
    if (!event) return <p>{t('cloud.deleted')}</p>
    if (field) {
      const value = (event as unknown as Record<string, unknown>)[field]
      return <dl><dt>{t('cloud.name')}</dt><dd>{event.title}</dd>
        <dt>{labels[field] ?? field}</dt><dd>{value === undefined || value === null ? '—' : field === 'amount' && typeof value === 'number'
          ? money(value, document.settings.currency) : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></dl>
    }
    return <dl><dt>{t('cloud.name')}</dt><dd>{event.title}</dd>
      <dt>{t('cloud.amount')}</dt><dd>{event.amount === null ? '—' : money(event.amount, document.settings.currency)}</dd>
      <dt>{t('cloud.date')}</dt><dd>{date(event.date)}</dd>
      {differences(event, other?.settings.events.find(item => item.id === event.id)).filter(row => !['id', 'title', 'amount', 'date'].includes(row.path[0])).map((row, index) => <div key={index}>
        <dt>{row.path.map(key => labels[key] ?? key).join(' / ')}</dt><dd>{row.value === undefined || row.value === null ? '—' : String(row.value)}</dd>
      </div>)}
    </dl>
  }
  if (!path.startsWith('/transactions/')) {
    // un solo campo, una categoria, una regola o un obiettivo: il valore di questa versione e cosa cambia rispetto all'altra
    const value = valueAt(document, path)
    if (value === undefined) return <p>{t('cloud.deleted')}</p>
    if (value === null || typeof value !== 'object') return <p>{value === null ? '—' : typeof value === 'boolean' ? t(value ? 'cloud.yes' : 'cloud.no') : String(value)}</p>
    return <dl className="cloud-differences">{differences(value, valueAt(other, path)).map((row, index) => <div key={index}>
      <dt>{row.path.map(key => labels[key] ?? key).join(' / ')}</dt><dd>{row.value === undefined || row.value === null ? '—' : String(row.value)}</dd>
    </div>)}</dl>
  }
  const tx = document.transactions.find(item => item.id === path.slice('/transactions/'.length))
  if (!tx) return <p>{t('cloud.deleted')}</p>
  return <dl><dt>{t('cloud.date')}</dt><dd>{tx.date ? date(tx.date) : '—'}</dd>
    <dt>{t('cloud.description')}</dt><dd>{tx.description}</dd>
    <dt>{t('cloud.amount')}</dt><dd>{tx.amount === null ? '—' : money(tx.amount, tx.currency || document.settings.currency)}</dd>
    <dt>{t('cloud.currency')}</dt><dd>{tx.currency || document.settings.currency}</dd>
    <dt>{t('cloud.category')}</dt><dd>{categoryName(document.settings.categories.find(c => c.id === tx.category), t)}</dd>
    {differences(tx, other?.transactions.find(item => item.id === tx.id)).filter(row => !['id', 'date', 'description', 'amount', 'currency', 'category'].includes(row.path[0])).map((row, index) => <div key={index}>
      <dt>{row.path.map(key => { const bucket = document.settings.buckets.find(b => b.id === key); return labels[key] ?? (bucket ? bucketName(bucket, t) : key) }).join(' / ')}</dt>
      <dd>{row.value === undefined || row.value === null ? '—' : row.path[0] === 'paidFrom' && document.settings.buckets.some(b => b.id === row.value)
        ? bucketName(document.settings.buckets.find(b => b.id === row.value)!, t) : String(row.value)}</dd>
    </div>)}
  </dl>
}
