// Le pagine del Profilo, in un posto solo: l'indirizzo (#/profile/<id>), la mappa delle sezioni (ui/profile/sections.tsx)
// e i contenuti (ui/profile/pages.tsx) partono tutti da qui. Una pagina nuova (es. Face ID) è una riga in più.
export const PROFILE_PAGES = [
  'progress',
  'personal', 'security', 'plan',
  'budget', 'recurring', 'goals', 'rules', 'shared',
  'appearance', 'language', 'notifications', 'motion', 'accessibility',
  'data', 'delete',
  'feedback', 'licenses',
] as const
export type ProfilePage = typeof PROFILE_PAGES[number]
