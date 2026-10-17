// Centro notifiche: le notifiche arrivate su questo telefono. Le salva il service worker (public/push-sw.js, IndexedDB
// "quadriamo.inbox", al massimo 100); qui l'app le legge e tiene a parte, nella memoria del browser, cosa hai letto,
// segnato come importante, archiviato o eliminato. Così il service worker e l'app non scrivono mai la stessa cosa.
import { get } from 'idb-keyval'
import { useEffect, useSyncExternalStore } from 'react'
import { local } from '../storage'

export type InboxKind = 'reminder' | 'morning' | 'nudge' | 'news' | 'message'
export interface InboxEntry { id: string; at: string; kind: InboxKind; title: string; body: string; url: string; day?: string | null; opened?: boolean }
export interface InboxFlags { read: string[]; important: string[]; archived: string[]; deleted: string[] }
export type InboxFilter = 'all' | 'unread' | 'important' | 'archived'
export interface InboxItem extends InboxEntry { read: boolean; important: boolean; archived: boolean }

const KEY = 'quadriamo.inbox'
const FLAGS = 'q.inboxFlags'
const KINDS: InboxKind[] = ['reminder', 'morning', 'nudge', 'news', 'message']
const EMPTY: InboxFlags = { read: [], important: [], archived: [], deleted: [] }

/** Le notifiche con il loro stato, dalla più recente; le eliminate spariscono. */
export function withFlags(entries: InboxEntry[], f: InboxFlags): InboxItem[] {
  const del = new Set(f.deleted)
  return entries.filter(e => !del.has(e.id)).map(e => ({
    ...e, kind: KINDS.includes(e.kind) ? e.kind : 'message',
    read: !!e.opened || f.read.includes(e.id), important: f.important.includes(e.id), archived: f.archived.includes(e.id),
  })).sort((a, b) => b.at.localeCompare(a.at))
}

/** Quelle da mostrare: le archiviate solo nel loro filtro; la ricerca guarda titolo e testo, senza badare a maiuscole e accenti. */
export function filterInbox(items: InboxItem[], filter: InboxFilter, query = ''): InboxItem[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const q = norm(query.trim())
  return items.filter(x => (filter === 'archived' ? x.archived : !x.archived)
    && (filter !== 'unread' || !x.read) && (filter !== 'important' || x.important)
    && (!q || norm(`${x.title} ${x.body}`).includes(q)))
}

/** Tiene solo gli stati delle notifiche che esistono ancora (il service worker ne conserva 100). */
export function pruneFlags(f: InboxFlags, ids: string[]): InboxFlags {
  const keep = new Set(ids), only = (l: string[]) => l.filter(id => keep.has(id))
  return { read: only(f.read), important: only(f.important), archived: only(f.archived), deleted: only(f.deleted) }
}

// ---- stato condiviso dall'app: le notifiche lette da IndexedDB e gli stati dalla memoria del browser ----
let entries: InboxEntry[] = []
let flags: InboxFlags = { ...EMPTY, ...local.json<Partial<InboxFlags>>(FLAGS, {}) }
let snapshot = withFlags(entries, flags)
const listeners = new Set<() => void>()
const emit = () => { snapshot = withFlags(entries, flags); listeners.forEach(l => l()) }

export async function reloadInbox(): Promise<void> {
  try { entries = ((await get(KEY)) as InboxEntry[] | undefined) ?? [] } catch { entries = [] }
  if (entries.length) flags = pruneFlags(flags, entries.map(e => e.id))
  emit()
}

function setFlags(change: (f: InboxFlags) => InboxFlags) {
  flags = change(flags)
  local.setJson(FLAGS, flags)
  emit()
}
const add = (l: string[], ids: string[]) => [...new Set([...l, ...ids])]
const drop = (l: string[], ids: string[]) => l.filter(x => !ids.includes(x))

export const inbox = {
  read: (ids: string[], on = true) => setFlags(f => ({ ...f, read: on ? add(f.read, ids) : drop(f.read, ids) })),
  important: (id: string, on: boolean) => setFlags(f => ({ ...f, important: on ? add(f.important, [id]) : drop(f.important, [id]) })),
  archive: (ids: string[], on: boolean) => setFlags(f => ({ ...f, archived: on ? add(f.archived, ids) : drop(f.archived, ids), read: on ? add(f.read, ids) : f.read })),
  remove: (ids: string[]) => setFlags(f => ({ ...f, deleted: add(f.deleted, ids) })),
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Le notifiche arrivate, aggiornate quando l'app torna in primo piano o il service worker ne riceve una. */
export function useInbox(): InboxItem[] {
  useEffect(() => {
    void reloadInbox()
    const onVisible = () => { if (document.visibilityState === 'visible') void reloadInbox() }
    const onMessage = (e: MessageEvent) => { if (e.data?.type === 'inbox') void reloadInbox() }
    document.addEventListener('visibilitychange', onVisible)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => { document.removeEventListener('visibilitychange', onVisible); navigator.serviceWorker?.removeEventListener('message', onMessage) }
  }, [])
  return useSyncExternalStore(subscribe, () => snapshot)
}
