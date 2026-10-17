// La mappa del Profilo: sezioni e voci, in ordine. La schermata principale si disegna da qui, e il titolo di ogni pagina
// è l'etichetta della sua voce. Una funzione nuova (Face ID, autenticazione a due fattori, sessioni) è una riga in più,
// e compare solo quando `when` dice che funziona davvero su questo dispositivo/account.
import type { ProfilePage } from '../../profile/pages'
import type { Dict } from '../../i18n/en'
import type { Prefs } from '../../app/prefs'

export interface Ctx {
  signedIn: boolean
  isAdmin: boolean
  prefs: Prefs
  contactEmail: string
  version: string
  unread: number                    // notifiche non lette nel centro notifiche
  stats: boolean
  privacyUrl: string
  termsUrl: string
  t: (k: keyof Dict) => string
  setStats: (on: boolean) => void
  invite: () => void
  openAdmin: () => void
}

export type Item = { label: keyof Dict; when?: (c: Ctx) => boolean; danger?: boolean } & (
  | { page: ProfilePage; value?: (c: Ctx) => string | null }
  | { href: (c: Ctx) => string }
  | { toggle: (c: Ctx) => { on: boolean; onChange: (on: boolean) => void } }
  | { action: (c: Ctx) => void }
  | { info: (c: Ctx) => string }
)

export const SECTIONS: { title: keyof Dict; items: Item[] }[] = [
  { title: 'prof.sec.account', items: [
    { page: 'personal', label: 'prof.personal' },
    { page: 'security', label: 'prof.security', when: c => c.signedIn },
    { page: 'plan', label: 'prof.plan' },
  ] },
  { title: 'prof.sec.budget', items: [
    { page: 'budget', label: 'prof.budget' },
    { page: 'capital', label: 'prof.capital' },
    { page: 'recurring', label: 'prof.recurring' },
    { page: 'yearCost', label: 'yc.title', when: () => false },   // si apre da Abbonamenti
    { page: 'goals', label: 'prof.goalsPage' },
    { page: 'documents', label: 'prof.documents' },
    { page: 'rules', label: 'prof.rules' },
    { page: 'shared', label: 'prof.shared' },
  ] },
  { title: 'prof.sec.prefs', items: [
    { page: 'appearance', label: 'prof.appearance', value: c => c.t(`theme.${c.prefs.theme}`) },
    { page: 'language', label: 'prof.language' },
    { page: 'inbox', label: 'prof.inbox', value: c => c.unread ? String(c.unread) : null },
    { page: 'notifications', label: 'prof.notifications' },
    { page: 'motion', label: 'prof.motion' },
    { page: 'accessibility', label: 'prof.accessibility' },
  ] },
  { title: 'prof.sec.privacy', items: [
    { href: c => c.privacyUrl, label: 'legal.privacy' },
    { href: c => c.termsUrl, label: 'legal.terms' },
    { toggle: c => ({ on: c.stats, onChange: c.setStats }), label: 'beta.stats' },
    { page: 'data', label: 'prof.exportImport' },
    { page: 'delete', label: 'prof.delete', danger: true, when: c => c.signedIn },
    { page: 'delete', label: 'prof.deleteLocal', danger: true, when: c => !c.signedIn },
  ] },
  { title: 'prof.sec.support', items: [
    { page: 'help', label: 'prof.help' },
    { href: c => `mailto:${c.contactEmail}`, label: 'prof.contact', when: c => !!c.contactEmail },
    { page: 'feedback', label: 'prof.feedback' },
    { action: c => c.invite(), label: 'beta.invite' },
    { page: 'licenses', label: 'prof.licenses' },
    { action: c => c.openAdmin(), label: 'admin.open', when: c => c.isAdmin },
    { info: c => c.version, label: 'prof.version' },
  ] },
]

/** Titolo di una pagina: l'etichetta della voce che la apre (Progressi non è in elenco: si apre dalla testata). */
export function pageLabel(page: ProfilePage, signedIn: boolean): keyof Dict {
  if (page === 'progress') return 'prof.progress'
  if (page === 'delete') return signedIn ? 'prof.delete' : 'prof.deleteLocal'
  for (const s of SECTIONS) for (const i of s.items) if ('page' in i && i.page === page) return i.label
  return 'nav.profile'
}
