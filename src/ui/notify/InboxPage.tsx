// Profilo → Centro notifiche: le notifiche arrivate su questo telefono (src/beta/inbox). Filtri per stato, ricerca,
// e per ognuna: apri (porta dove serve), letta/non letta, importante, archivia, elimina. Niente arriva qui dal server
// oltre a quello che hai già visto come notifica.
import { useState } from 'react'
import { inbox, filterInbox, useInbox, type InboxFilter, type InboxItem } from '../../beta/inbox'
import { navigate } from '../../app/router'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import type { ProfilePage } from '../../profile/pages'
import { Icon } from '../Icon'
import { Empty } from '../kit/Empty'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'

const k = (s: string) => s as keyof Dict
const FILTERS: InboxFilter[] = ['all', 'unread', 'important', 'archived']

/** Dove porta ogni notifica: le scadenze al calendario, le notizie alle Notizie, il resto alla Home o al parere. */
function open(x: InboxItem, onPage: (p: ProfilePage) => void) {
  if (x.kind === 'reminder') navigate({ tab: 'analysis', view: 'calendar' })
  else if (x.kind === 'news') navigate({ tab: 'news' })
  else if (x.kind === 'morning' || x.kind === 'nudge') navigate({ tab: 'home' })
  else if (x.url.includes('feedback=1')) onPage('feedback')
}

export function InboxPage({ today, onPage }: { today: string; onPage: (p: ProfilePage) => void }) {
  const { t, date, lang } = useI18n()
  const items = useInbox()
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const list = filterInbox(items, filter, q)
  const unread = filterInbox(items, 'unread').map(x => x.id)
  const current = items.find(x => x.id === sel) ?? null
  const time = (iso: string) => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const when = (iso: string) => {
    const d = new Date(iso), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return day === today ? time(iso) : `${date(day, { day: 'numeric', month: 'short' })} · ${time(iso)}`
  }

  if (!items.length) return <>
    <Empty title={t('inbox.emptyTitle')} text={t('inbox.emptyText')} action={{ label: t('inbox.settings'), onClick: () => onPage('notifications') }} />
  </>

  return (
    <div className="nc">
      <label className="news-search"><Icon name="search" size={18} />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('inbox.search')} aria-label={t('inbox.search')} enterKeyHint="search" />
      </label>
      <div className="chips" role="tablist" aria-label={t('inbox.filter')}>
        {FILTERS.map(f => <button key={f} type="button" role="tab" aria-selected={filter === f} className={`chip${filter === f ? ' on' : ''}`}
          onClick={() => { tap(); setFilter(f) }}>{t(k(`inbox.f.${f}`))}</button>)}
      </div>

      {list.length ? <ul className="group-list nc-list">{list.map(x => (
        <li key={x.id} className={x.read ? 'read' : 'unread'}>
          <button className="row nc-row" onClick={() => { tap(); inbox.read([x.id]); open(x, onPage) }}>
            <span className="nc-dot" aria-hidden="true" />
            <span className="row-main">
              <span>{x.title}</span>
              {x.body && <small className="nc-body">{x.body}</small>}
              <small>{[t(k(`inbox.kind.${x.kind}`)), when(x.at), x.important ? t('inbox.important') : null].filter(Boolean).join(' · ')}</small>
              {!x.read && <span className="sr-only">{t('inbox.new')}</span>}
            </span>
          </button>
          <button className="icon-btn ghost nc-more" aria-label={t('inbox.actions')} onClick={() => { tap(); setSel(x.id) }}>
            <Icon name="more" size={18} /></button>
        </li>))}
      </ul> : <p className="muted small cal-none">{q ? t('inbox.noMatch') : t(k(`inbox.none.${filter}`))}</p>}

      <div className="nc-foot">
        {filter !== 'archived' && unread.length > 0 && <button className="link-btn" onClick={() => { tap(); inbox.read(unread) }}>{t('inbox.readAll')}</button>}
        {filter === 'archived' && list.length > 0 && <button className="link-btn danger-link"
          onClick={() => { if (confirm(t('inbox.deleteAllConfirm'))) inbox.remove(list.map(x => x.id)) }}>{t('inbox.deleteAll')}</button>}
        <button className="link-btn" onClick={() => { tap(); onPage('notifications') }}>{t('inbox.settings')}</button>
      </div>

      <Sheet open={!!current} onClose={() => setSel(null)} title={current?.title}>
        {current && <div className="nc-actions">
          {current.body && <p>{current.body}</p>}
          <p className="small muted">{t(k(`inbox.kind.${current.kind}`))} · {when(current.at)}</p>
          <ul className="group-list">
            <li><button className="row" onClick={() => { tap(); inbox.read([current.id], !current.read); setSel(null) }}>
              <span className="row-main"><span>{current.read ? t('inbox.markUnread') : t('inbox.markRead')}</span></span></button></li>
            <li><button className="row" onClick={() => { tap(); inbox.important(current.id, !current.important); setSel(null) }}>
              <span className="row-main"><span>{current.important ? t('inbox.unimportant') : t('inbox.markImportant')}</span></span></button></li>
            <li><button className="row" onClick={() => { tap(); inbox.archive([current.id], !current.archived); setSel(null) }}>
              <span className="row-main"><span>{current.archived ? t('inbox.unarchive') : t('inbox.archive')}</span></span></button></li>
            <li><button className="row" onClick={() => { tap(); inbox.remove([current.id]); setSel(null) }}>
              <span className="row-main"><span className="bad-text">{t('inbox.delete')}</span></span></button></li>
          </ul>
        </div>}
      </Sheet>
    </div>
  )
}
