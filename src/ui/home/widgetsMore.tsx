// Widget della Home che leggono dati propri: i mercati (orari delle borse, calcolati sul telefono)
// e gli eventi economici (tabella econ_events, inserita dall'amministratore). Niente servizi esterni.
import { useEffect, useState, type ReactNode } from 'react'
import { marketsNow } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { supabase } from '../../sync/client'
import { Icon } from '../Icon'
import type { WidgetCtx } from './widgets'

const k = (s: string) => s as keyof Dict
type Box = (body: ReactNode) => ReactNode

export function Markets({ box }: { box: Box }) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id) }, [])
  return box(<ul className="group-list">{marketsNow(now).map(m => (
    <li key={m.id}><div className="row"><span className="row-main"><span>{t(k(`mk.${m.id}`))}</span>
      <small>{m.open ? t('mk.closes', { at: m.at }) : t(m.next === 'today' ? 'mk.opens' : m.next === 'tomorrow' ? 'mk.opensTomorrow' : 'mk.opensMonday', { at: m.at })}</small></span>
      <span className={`mk-dot${m.open ? ' on' : ''}`} aria-label={t(m.open ? 'mk.open' : 'mk.closedShort')} /></div></li>))}</ul>)
}

export function Events({ c, box }: { c: WidgetCtx; box: Box }) {
  const { lang, date } = useI18n()
  const [rows, setRows] = useState<{ id: number; day: string; title_it: string; title_en: string; title_fr: string | null; title_es: string | null; url: string | null }[] | null>(null)
  useEffect(() => {
    if (!supabase) return
    void supabase.from('econ_events').select('*').gte('day', c.today).order('day').limit(3).then(({ data }) => setRows(data ?? []), () => setRows([]))
  }, [c.today])
  if (!rows?.length) return null
  return box(<ul className="group-list">{rows.map(e => {
    const title = (lang === 'it' ? e.title_it : lang === 'fr' ? e.title_fr : lang === 'es' ? e.title_es : null) || e.title_en
    const body = <><span className="row-main"><span>{title}</span><small>{date(e.day, { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
      {e.url && <Icon name="external" size={16} className="row-chev" />}</>
    return <li key={e.id}>{e.url ? <a className="row" href={e.url} target="_blank" rel="noopener noreferrer">{body}</a> : <div className="row">{body}</div>}</li>
  })}</ul>)
}
