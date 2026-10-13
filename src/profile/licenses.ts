// Licenze open source di ciò che gira nell'app (le dipendenze di sviluppo non arrivano sul telefono).
// Un test controlla che ogni dipendenza di package.json sia qui: aggiungerne una senza dichiararla fa fallire i test.
export const LICENSES: { name: string; license: string; by: string; url: string }[] = [
  { name: 'React', license: 'MIT', by: 'Meta Platforms, Inc.', url: 'https://github.com/facebook/react' },
  { name: 'React DOM', license: 'MIT', by: 'Meta Platforms, Inc.', url: 'https://github.com/facebook/react' },
  { name: 'Supabase JS', license: 'MIT', by: 'Supabase', url: 'https://github.com/supabase/supabase-js' },
  { name: 'idb-keyval', license: 'Apache-2.0', by: 'Jake Archibald', url: 'https://github.com/jakearchibald/idb-keyval' },
  { name: 'Inter', license: 'SIL Open Font License 1.1', by: 'Rasmus Andersson', url: 'https://github.com/rsms/inter' },
  { name: 'DM Serif Display', license: 'SIL Open Font License 1.1', by: 'Colophon Foundry', url: 'https://github.com/googlefonts/dm-fonts' },
]
/** Nome del pacchetto npm -> voce sopra (per il test). */
export const PACKAGES: Record<string, string> = {
  react: 'React', 'react-dom': 'React DOM', '@supabase/supabase-js': 'Supabase JS', 'idb-keyval': 'idb-keyval',
}
