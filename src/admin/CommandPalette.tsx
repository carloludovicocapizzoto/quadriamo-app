// Ricerca globale dell'admin (⌘K / Ctrl+K): pannelli, azioni e dati già caricati (account, feedback, dispositivi).
// Frecce per scegliere, Invio per aprire, Esc per chiudere. Le scorciatoie G + lettera portano ai pannelli anche senza aprirla.
import { useMemo, useState } from 'react'
import { Icon, type IconName } from '../ui/Icon'
import type { Account, Device, Feedback } from './data'

export interface Command { id: string; label: string; hint?: string; icon: IconName; run: () => void; group: string }

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Montata solo quando è aperta: ogni apertura parte da una ricerca vuota. */
export function CommandPalette({ onClose, commands, accounts, feedback, devices, onPanel }: {
  onClose: () => void; commands: Command[]
  accounts: Account[]; feedback: Feedback[]; devices: Device[]; onPanel: (p: 'account' | 'feedback' | 'dispositivi') => void
}) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)

  const results = useMemo(() => {
    const words = plain(q).split(/\s+/).filter(Boolean)
    const ok = (text: string) => words.every(w => plain(text).includes(w))
    const data: Command[] = words.length ? [
      ...accounts.filter(a => ok(`${a.first_name ?? ''} ${a.last_name ?? ''} ${a.email}`)).slice(0, 5).map(a => ({
        id: `a-${a.email}`, group: 'Account', icon: 'user' as IconName, label: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email, hint: a.email, run: () => onPanel('account') })),
      ...feedback.filter(f => ok(`${f.message ?? ''} ${f.email ?? ''}`)).slice(0, 5).map(f => ({
        id: `f-${f.id}`, group: 'Feedback', icon: 'message' as IconName, label: (f.message ?? '').slice(0, 80) || `Voto ${f.rating ?? '—'}`, hint: new Date(f.created_at).toLocaleDateString('it-IT'), run: () => onPanel('feedback') })),
      ...devices.filter(d => ok(`${d.platform ?? ''} ${d.lang ?? ''} ${d.app_version ?? ''}`)).slice(0, 3).map(d => ({
        id: `d-${d.device_id}`, group: 'Dispositivi', icon: 'list' as IconName, label: `${d.platform ?? 'dispositivo'} · ${d.lang ?? ''}`, hint: `ultimo uso ${d.last_day}`, run: () => onPanel('dispositivi') })),
    ] : []
    return [...commands.filter(c => !words.length || ok(`${c.label} ${c.group} ${c.hint ?? ''}`)), ...data]
  }, [q, commands, accounts, feedback, devices, onPanel])

  const pick = (c: Command | undefined) => { if (!c) return; onClose(); c.run() }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(results.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[at]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }
  let last = ''
  return (
    <div className="az-cmd-root" role="presentation" onClick={onClose}>
      <div className="az-cmd" role="dialog" aria-modal="true" aria-label="Cerca e azioni" onClick={e => e.stopPropagation()}>
        <label className="az-cmd-search"><Icon name="search" size={18} />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setAt(0) }} onKeyDown={key}
            placeholder="Cerca pannelli, azioni, account, feedback…" aria-controls="az-cmd-list" aria-activedescendant={results[at] ? `cmd-${results[at].id}` : undefined} />
          <kbd>Esc</kbd></label>
        <ul id="az-cmd-list" className="az-cmd-list" role="listbox">
          {results.map((c, i) => {
            const head = c.group !== last ? <li className="az-cmd-group" role="presentation">{c.group}</li> : null
            last = c.group
            return [head, <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === at} className={i === at ? 'on' : ''}
              onMouseMove={() => setAt(i)} onClick={() => pick(c)}>
              <Icon name={c.icon} size={18} /><span className="l">{c.label}</span>{c.hint && <span className="h">{c.hint}</span>}
            </li>]
          })}
          {!results.length && <li className="az-cmd-none">Nessun risultato</li>}
        </ul>
        <p className="az-cmd-foot"><kbd>↑</kbd><kbd>↓</kbd> scegli · <kbd>↵</kbd> apri · <kbd>G</kbd> poi lettera per i pannelli</p>
      </div>
    </div>
  )
}
