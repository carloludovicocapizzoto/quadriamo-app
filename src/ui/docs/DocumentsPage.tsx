// Profilo → Documenti: carta d'identità, patente, assicurazioni, contratti… con la scadenza e i promemoria. Sono eventi
// del calendario (kind 'document'): compaiono nel calendario, i promemoria arrivano come le altre notifiche, e "Adesso"
// li ricorda quando si avvicinano. Nessuna scansione e nessun numero di documento: solo nome, categoria e date.
import { useState } from 'react'
import { DOC_CATEGORIES, REMINDER_DAYS, docStatus, renewDoc, type CalEvent, type DocCategory, type Reminder } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { Icon, type IconName } from '../Icon'
import { Empty } from '../kit/Empty'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { useEvents } from '../calendar/useEvents'
import { askNotifications } from '../notify/ask'
import { newId } from '../../store/state'

const k = (s: string) => s as keyof Dict
const ICON: Record<DocCategory, IconName> = { personal: 'idcard', car: 'car', home: 'home', health: 'heart', work: 'briefcase', other: 'folder' }
const DOC_DAYS = REMINDER_DAYS.filter(d => d !== 3)

function blankDoc(today: string, category: DocCategory = 'personal'): CalEvent {
  return { id: newId(), kind: 'document', title: '', amount: null, category: null, date: today, repeat: null, until: null, done: [], active: true,
    reminders: [{ days: 30 }, { days: 7 }], doc: { category } }
}

export function DocumentsPage({ today }: { today: string }) {
  const { t, date } = useI18n()
  const { events, save, remove } = useEvents()
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const docs = events.filter(e => e.kind === 'document').sort((a, b) => a.date.localeCompare(b.date))
  const current = docs.find(d => d.id === open) ?? null
  const status = (e: CalEvent) => {
    const s = docStatus(e, today)
    return { ...s, text: s.state === 'expired' ? t(s.days === -1 ? 'doc.expiredAgoOne' : 'doc.expiredAgo', { n: -s.days }) : s.days === 0 ? t('doc.today') : s.state === 'soon' ? t(s.days === 1 ? 'doc.inDaysOne' : 'doc.inDays', { n: s.days }) : t('doc.valid') }
  }
  const next = docs.find(d => docStatus(d, today).state !== 'ok')
  const isNew = edit && !events.some(e => e.id === edit.id)

  const sheets = <>
    <Sheet open={!!current} onClose={() => setOpen(null)}>
      {current && <DocDetail doc={current} status={status(current)} onEdit={() => { setEdit(current); setOpen(null) }}
        onRenew={d => { save(renewDoc(current, d)); setOpen(null) }} />}
    </Sheet>
    <Sheet open={!!edit} onClose={() => setEdit(null)} title={isNew ? t('doc.add') : t('doc.edit')}>
      {edit && <DocForm doc={edit} onSave={d => { save(d); setEdit(null); if (d.reminders?.length) askNotifications() }}
        onDelete={isNew ? undefined : () => { remove(edit.id); setEdit(null) }} />}
    </Sheet>
  </>

  if (!docs.length) return <>
    <Empty title={t('doc.emptyTitle')} text={t('doc.emptyText')} action={{ label: t('doc.add'), onClick: () => setEdit(blankDoc(today)) }} />
    {sheets}
  </>

  return <>
    <section className="subs-head">
      <p className="cs-label">{next ? t('doc.next') : t('doc.allGood')}</p>
      {next ? <>
        <p className={`doc-hero ${docStatus(next, today).state}`}>{next.title}</p>
        <p className="muted small">{status(next).text} · {date(next.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </> : <p className="doc-hero">{t(docs.length === 1 ? 'doc.countOne' : 'doc.count', { n: docs.length })}</p>}
    </section>

    {DOC_CATEGORIES.filter(c => docs.some(d => d.doc?.category === c)).map(c => (
      <section key={c} className="group">
        <h2 className="group-title doc-cat"><Icon name={ICON[c]} size={16} />{t(k(`doc.cat.${c}`))}</h2>
        <ul className="group-list">{docs.filter(d => d.doc?.category === c).map(d => {
          const s = status(d)
          return <li key={d.id}><button className="row" onClick={() => { tap(); setOpen(d.id) }}>
            <span className="row-main"><span>{d.title}</span>
              <small>{t('doc.expires', { date: date(d.date, { day: 'numeric', month: 'short', year: 'numeric' }) })}</small></span>
            <span className={`row-value doc-state ${s.state}`}>{s.text}</span>
            <Icon name="chevron" size={18} className="row-chev" />
          </button></li>
        })}</ul>
      </section>
    ))}
    <button className="link-btn" onClick={() => { tap(); setEdit(blankDoc(today)) }}>+ {t('doc.add')}</button>
    {sheets}
  </>
}

function DocDetail({ doc, status, onEdit, onRenew }: {
  doc: CalEvent; status: { state: string; text: string }; onEdit: () => void; onRenew: (date: string) => void
}) {
  const { t, date } = useI18n()
  const [renewing, setRenewing] = useState(false)
  const [newDate, setNewDate] = useState('')
  const cat = doc.doc?.category ?? 'other'
  const rem = (doc.reminders ?? []).filter((r): r is { days: number } => 'days' in r).map(r => r.days).sort((a, b) => b - a)
  return (
    <div className="event-detail">
      <div className="yc-detail-head"><span className="doc-ico"><Icon name={ICON[cat]} size={22} /></span>
        <div><p className="eyebrow-small">{t(k(`doc.cat.${cat}`))}</p><h2>{doc.title}</h2></div></div>
      <p className={`doc-status ${status.state}`}>{status.text}</p>
      <ul className="ed-facts">
        <li><span>{t('doc.expiry')}</span><b>{date(doc.date, { day: 'numeric', month: 'long', year: 'numeric' })}</b></li>
        <li><span>{t('rem.title')}</span><b>{rem.length ? rem.map(d => d === 0 ? t('rem.sameDay') : t('rem.daysBefore', { n: d })).join(', ') : t('doc.noReminders')}</b></li>
        {(doc.doc?.renewals ?? []).slice().reverse().map(r => <li key={r}><span>{t('doc.renewedFrom')}</span><b>{date(r, { day: 'numeric', month: 'short', year: 'numeric' })}</b></li>)}
      </ul>
      {renewing ? <div className="txs-rows"><label className="txs-row"><span>{t('doc.newExpiry')}</span>
          <input type="date" min={doc.date} value={newDate} onChange={e => setNewDate(e.target.value)} autoFocus /></label>
        <button className="btn primary wide top-gap" disabled={!newDate} onClick={() => { tap(); onRenew(newDate) }}>{t('doc.confirmRenew')}</button></div>
        : <button className="btn primary wide" onClick={() => { tap(); setRenewing(true) }}><Icon name="check" size={16} />{t('doc.renew')}</button>}
      <button className="btn wide top-gap" onClick={onEdit}><Icon name="edit" size={16} />{t('doc.edit')}</button>
    </div>
  )
}

function DocForm({ doc, onSave, onDelete }: { doc: CalEvent; onSave: (d: CalEvent) => void; onDelete?: () => void }) {
  const { t } = useI18n()
  const [d, setD] = useState(doc)
  const [err, setErr] = useState('')
  const cat = d.doc?.category ?? 'other'
  const presets = t(k(`doc.preset.${cat}`)).split('|')
  const has = (n: number) => (d.reminders ?? []).some(r => 'days' in r && r.days === n)
  const toggle = (n: number) => {
    tap()
    const list: Reminder[] = has(n) ? (d.reminders ?? []).filter(r => !('days' in r && r.days === n)) : [...(d.reminders ?? []), { days: n }]
    setD({ ...d, reminders: list })
  }
  return (
    <div className="event-form">
      <div className="chips ev-kinds" role="radiogroup" aria-label={t('doc.category')}>
        {DOC_CATEGORIES.map(c => <button key={c} type="button" role="radio" aria-checked={cat === c} className={`chip${cat === c ? ' on' : ''}`}
          onClick={() => { tap(); setD({ ...d, doc: { ...d.doc, category: c } }) }}>{t(k(`doc.cat.${c}`))}</button>)}
      </div>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('ev.title')}</span>
          <input value={d.title} maxLength={60} placeholder={presets[0]} onChange={e => setD({ ...d, title: e.target.value })} /></label>
      </div>
      <div className="ev-hints">{presets.filter(p => p !== d.title).map(p => <button key={p} type="button" className="ev-hint doc-preset"
        onClick={() => { tap(); setD({ ...d, title: p }) }}>{p}</button>)}</div>
      <div className="txs-rows">
        <label className="txs-row"><span>{t('doc.expiry')}</span>
          <input type="date" value={d.date} onChange={e => e.target.value && setD({ ...d, date: e.target.value })} /></label>
      </div>
      <p className="small fb-q"><b>{t('rem.title')}</b></p>
      <div className="chips" role="group" aria-label={t('rem.title')}>
        {DOC_DAYS.map(n => <button key={n} type="button" aria-pressed={has(n)} className={`chip${has(n) ? ' on' : ''}`} onClick={() => toggle(n)}>
          {n === 0 ? t('rem.sameDay') : n === 1 ? t('rem.dayBefore') : t('rem.daysBefore', { n })}</button>)}
      </div>
      <p className="small muted">{t('doc.privacy')}</p>
      {err && <p className="small bad-text" role="alert">{err}</p>}
      <button className="btn primary wide top-gap" onClick={() => {
        if (!d.title.trim()) return setErr(t('ev.errTitle'))
        tap(); onSave({ ...d, title: d.title.trim().slice(0, 60) })
      }}>{onDelete ? t('action.save') : t('doc.add')}</button>
      {onDelete && <button className="link-btn danger-link" onClick={() => { if (confirm(t('doc.confirmDelete'))) onDelete() }}>{t('doc.delete')}</button>}
    </div>
  )
}
