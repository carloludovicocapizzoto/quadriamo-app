// I dettagli tecnici di una segnalazione dell'Alpha (ui/beta/AlphaReport): si copiano nel messaggio a chi ha invitato il tester.
import type { deviceInfo } from '../app/diagnostics'

/** Solo dati tecnici: versione, dispositivo, stato della sincronizzazione. Mai importi, descrizioni, email o identificativi. */
export function technicalDetails(d: ReturnType<typeof deviceInfo>, sync: { status: string }, cloud: {
  status?: string; base?: { revision: string } | null; pending?: unknown; conflict?: { paths: string[] } | null; recovery?: unknown[]; cooldownUntil?: string
} | null | undefined, storageError: string | null | undefined, worker: boolean, now = new Date()) {
  return [
    `Quadriamo ${d.release} (${d.env}, ${String(d.commit).slice(0, 7)})`,
    `${d.os} · ${d.installed ? 'app installata' : 'browser'} · ${d.screen} · ${d.lang} · ${d.online ? 'online' : 'offline'} · service worker ${worker ? 'sì' : 'no'}`,
    `Sincronizzazione: ${sync.status}; cloud ${cloud?.status ?? '—'}, revisione ${cloud?.base?.revision ?? '—'}, in attesa ${cloud?.pending ? 'sì' : 'no'}, conflitti ${cloud?.conflict?.paths.length ?? 0}, copie di recupero ${cloud?.recovery?.length ?? 0}${cloud?.cooldownUntil ? `, attesa fino a ${cloud.cooldownUntil}` : ''}`,
    `Archivio locale: ${storageError ? `errore (${storageError})` : 'ok'}`,
    `Ora: ${now.toISOString()}`,
  ].join('\n')
}
