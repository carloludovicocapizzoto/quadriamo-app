import { describe, expect, it } from 'vitest'
import { filterInbox, pruneFlags, withFlags, type InboxEntry, type InboxFlags } from './inbox'

const e = (id: string, at: string, title: string, extra: Partial<InboxEntry> = {}): InboxEntry =>
  ({ id, at, kind: 'reminder', title, body: '', url: './app/', ...extra })
const entries = [
  e('a', '2026-10-15T09:00:00Z', 'Domani: Affitto', { body: '380,00 €' }),
  e('b', '2026-10-16T07:30:00Z', 'Oggi puoi spendere', { kind: 'morning', opened: true }),
  e('c', '2026-10-17T12:00:00Z', 'Tassi: la BCE', { kind: 'news' }),
  e('d', '2026-10-14T09:00:00Z', 'Vecchia', { kind: 'strano' as never }),
]
const flags: InboxFlags = { read: ['c'], important: ['a'], archived: ['d'], deleted: [] }

describe('centro notifiche', () => {
  it('stato di ogni notifica, dalla più recente; i tipi sconosciuti diventano messaggi', () => {
    const items = withFlags(entries, flags)
    expect(items.map(x => x.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(items.find(x => x.id === 'b')!.read).toBe(true)            // aperta dalla notifica
    expect(items.find(x => x.id === 'a')).toMatchObject({ read: false, important: true })
    expect(items.find(x => x.id === 'd')!.kind).toBe('message')
  })
  it('filtri: le archiviate solo nel loro; da leggere, importanti', () => {
    const items = withFlags(entries, flags)
    expect(filterInbox(items, 'all').map(x => x.id)).toEqual(['c', 'b', 'a'])
    expect(filterInbox(items, 'unread').map(x => x.id)).toEqual(['a'])
    expect(filterInbox(items, 'important').map(x => x.id)).toEqual(['a'])
    expect(filterInbox(items, 'archived').map(x => x.id)).toEqual(['d'])
  })
  it('ricerca nel titolo e nel testo, senza maiuscole né accenti', () => {
    const items = withFlags([...entries, e('x', '2026-10-17T13:00:00Z', 'Più tardi: Caffè')], flags)
    expect(filterInbox(items, 'all', 'affitto').map(x => x.id)).toEqual(['a'])
    expect(filterInbox(items, 'all', '380').map(x => x.id)).toEqual(['a'])
    expect(filterInbox(items, 'all', 'CAFFE').map(x => x.id)).toEqual(['x'])
  })
  it('le eliminate spariscono; gli stati delle notifiche non più salvate si dimenticano', () => {
    expect(withFlags(entries, { ...flags, deleted: ['a'] }).map(x => x.id)).not.toContain('a')
    expect(pruneFlags({ ...flags, deleted: ['zz'] }, ['a', 'c'])).toEqual({ read: ['c'], important: ['a'], archived: [], deleted: [] })
  })
})
