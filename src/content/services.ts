// Catalogo degli abbonamenti più comuni in Italia e in Europa: nome, categoria e colore del marchio. Niente loghi
// (sono marchi registrati: scelta di Carlo, 17/10): ogni servizio si riconosce da un monogramma nel suo colore
// (ui/kit/Monogram). Niente prezzi di listino: cambiano spesso e un numero sbagliato varrebbe meno di un campo vuoto.
export type ServiceCategory = 'video' | 'music' | 'cloud' | 'apps' | 'news' | 'gaming' | 'fitness' | 'phone' | 'learning' | 'other'
export const SERVICE_CATEGORIES: ServiceCategory[] = ['video', 'music', 'cloud', 'apps', 'news', 'gaming', 'fitness', 'phone', 'learning', 'other']

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  color: string          // colore del marchio (sfondo del monogramma)
  mono?: string          // sigla, se non basta l'iniziale
  popular?: boolean      // tra i "più usati"
  yearly?: boolean       // di solito si paga ogni anno
}

const S = (id: string, name: string, category: ServiceCategory, color: string, extra: Partial<Service> = {}): Service =>
  ({ id, name, category, color, ...extra })

export const SERVICES: Service[] = [
  S('netflix', 'Netflix', 'video', '#E50914', { popular: true }),
  S('prime-video', 'Prime Video', 'video', '#1A98FF', { mono: 'PV', popular: true }),
  S('disney-plus', 'Disney+', 'video', '#113CCF', { mono: 'D+', popular: true }),
  S('now', 'NOW', 'video', '#0F2D3A'),
  S('dazn', 'DAZN', 'video', '#0C161C', { mono: 'DA', popular: true }),
  S('apple-tv', 'Apple TV+', 'video', '#1D1D1F', { mono: 'tv' }),
  S('paramount-plus', 'Paramount+', 'video', '#0064FF', { mono: 'P+' }),
  S('sky', 'Sky', 'video', '#0072C9', { mono: 'sky' }),
  S('timvision', 'TIMVISION', 'video', '#0033A0', { mono: 'TV' }),
  S('crunchyroll', 'Crunchyroll', 'video', '#F47521'),
  S('discovery-plus', 'discovery+', 'video', '#2175D9', { mono: 'd+' }),
  S('mubi', 'MUBI', 'video', '#001489'),
  S('youtube-premium', 'YouTube Premium', 'video', '#FF0000', { mono: 'YT', popular: true }),
  S('spotify', 'Spotify', 'music', '#1DB954', { popular: true }),
  S('apple-music', 'Apple Music', 'music', '#FA243C', { mono: 'AM' }),
  S('amazon-music', 'Amazon Music Unlimited', 'music', '#25D1DA', { mono: 'AM' }),
  S('deezer', 'Deezer', 'music', '#A238FF'),
  S('tidal', 'TIDAL', 'music', '#000000'),
  S('audible', 'Audible', 'music', '#F8991C'),
  S('storytel', 'Storytel', 'music', '#FF501A'),
  S('icloud', 'iCloud+', 'cloud', '#3693F3', { popular: true }),
  S('google-one', 'Google One', 'cloud', '#4285F4', { mono: 'G1' }),
  S('dropbox', 'Dropbox', 'cloud', '#0061FF'),
  S('onedrive', 'OneDrive', 'cloud', '#0078D4'),
  S('pcloud', 'pCloud', 'cloud', '#17BED0', { yearly: true }),
  S('microsoft-365', 'Microsoft 365', 'apps', '#D83B01', { mono: 'M', popular: true, yearly: true }),
  S('adobe-cc', 'Adobe Creative Cloud', 'apps', '#DA1F26', { mono: 'Cc' }),
  S('canva', 'Canva Pro', 'apps', '#00C4CC'),
  S('notion', 'Notion', 'apps', '#191919'),
  S('chatgpt', 'ChatGPT Plus', 'apps', '#10A37F', { mono: 'GPT', popular: true }),
  S('claude', 'Claude Pro', 'apps', '#D97757'),
  S('1password', '1Password', 'apps', '#0572EC', { mono: '1P' }),
  S('bitwarden', 'Bitwarden', 'apps', '#175DDC', { yearly: true }),
  S('nordvpn', 'NordVPN', 'apps', '#4687FF', { yearly: true }),
  S('surfshark', 'Surfshark', 'apps', '#178A9E', { yearly: true }),
  S('grammarly', 'Grammarly', 'apps', '#15C39A'),
  S('todoist', 'Todoist', 'apps', '#E44332'),
  S('linkedin-premium', 'LinkedIn Premium', 'apps', '#0A66C2', { mono: 'in' }),
  S('amazon-prime', 'Amazon Prime', 'other', '#FF9900', { mono: 'a', popular: true, yearly: true }),
  S('tinder', 'Tinder', 'other', '#FE3C72'),
  S('deliveroo-plus', 'Deliveroo Plus', 'other', '#00CCBC', { mono: 'D' }),
  S('glovo-prime', 'Glovo Prime', 'other', '#FFC244', { mono: 'G' }),
  S('uber-one', 'Uber One', 'other', '#000000', { mono: 'U1' }),
  S('il-post', 'Il Post', 'news', '#111111', { mono: 'P', yearly: true }),
  S('corriere', 'Corriere della Sera', 'news', '#1A1A1A', { mono: 'C' }),
  S('repubblica', 'la Repubblica', 'news', '#262626', { mono: 'R' }),
  S('sole24ore', 'Il Sole 24 Ore', 'news', '#C8102E', { mono: '24' }),
  S('economist', 'The Economist', 'news', '#E3120B', { mono: 'E', yearly: true }),
  S('ft', 'Financial Times', 'news', '#FCD0B1', { mono: 'FT' }),
  S('nyt', 'The New York Times', 'news', '#121212', { mono: 'T' }),
  S('medium', 'Medium', 'news', '#000000'),
  S('substack', 'Substack', 'news', '#FF6719'),
  S('game-pass', 'Xbox Game Pass', 'gaming', '#107C10', { mono: 'X' }),
  S('ps-plus', 'PlayStation Plus', 'gaming', '#0070D1', { mono: 'PS', yearly: true }),
  S('nintendo-online', 'Nintendo Switch Online', 'gaming', '#E60012', { mono: 'N', yearly: true }),
  S('ea-play', 'EA Play', 'gaming', '#FF4747', { mono: 'EA' }),
  S('apple-arcade', 'Apple Arcade', 'gaming', '#1D1D1F', { mono: 'AA' }),
  S('twitch', 'Twitch Turbo', 'gaming', '#9146FF', { mono: 'Tw' }),
  S('gym', 'Palestra', 'fitness', '#3D3F44', { mono: 'G' }),
  S('strava', 'Strava', 'fitness', '#FC4C02'),
  S('apple-fitness', 'Apple Fitness+', 'fitness', '#1D1D1F', { mono: 'F+' }),
  S('freeletics', 'Freeletics', 'fitness', '#1E1E1E'),
  S('headspace', 'Headspace', 'fitness', '#FF7E1D'),
  S('calm', 'Calm', 'fitness', '#3A6EEB'),
  S('tim', 'TIM', 'phone', '#0033A0', { mono: 'TIM' }),
  S('vodafone', 'Vodafone', 'phone', '#E60000', { mono: 'V', popular: true }),
  S('windtre', 'WindTre', 'phone', '#FF6A00', { mono: 'W3' }),
  S('iliad', 'iliad', 'phone', '#E2001A', { mono: 'i', popular: true }),
  S('fastweb', 'Fastweb', 'phone', '#FDC300', { mono: 'F' }),
  S('ho-mobile', 'ho. Mobile', 'phone', '#2B2B2B', { mono: 'ho.' }),
  S('very-mobile', 'Very Mobile', 'phone', '#00A651', { mono: 'V' }),
  S('kena', 'Kena Mobile', 'phone', '#7AB800', { mono: 'K' }),
  S('duolingo', 'Duolingo Super', 'learning', '#58CC02', { mono: 'D' }),
  S('babbel', 'Babbel', 'learning', '#FF6700'),
  S('coursera', 'Coursera Plus', 'learning', '#0056D2'),
  S('udemy', 'Udemy', 'learning', '#A435F0'),
  S('masterclass', 'MasterClass', 'learning', '#1A1A1A', { mono: 'MC', yearly: true }),
  S('skillshare', 'Skillshare', 'learning', '#00FF84'),
]

export const serviceById = (id: string | null | undefined) => (id ? SERVICES.find(s => s.id === id) : undefined)

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()

/**
 * Ricerca istantanea: prima chi inizia con quello che scrivi (nome o una sua parola), poi chi lo contiene; a parità, i più
 * usati. Senza testo: i più usati della categoria (o di tutte).
 */
export function searchServices(query: string, category: ServiceCategory | null = null, max = 24): Service[] {
  const q = norm(query)
  const pool = SERVICES.filter(s => !category || s.category === category)
  if (!q) return (category ? pool : pool.filter(s => s.popular)).slice(0, max)
  const score = (s: Service) => {
    const n = norm(s.name), words = n.split(' ')
    if (n.startsWith(q)) return 0
    if (words.some(w => w.startsWith(q))) return 1
    if (n.replace(/ /g, '').includes(q.replace(/ /g, ''))) return 2
    return -1
  }
  return pool.map(s => ({ s, r: score(s) })).filter(x => x.r >= 0)
    .sort((a, b) => a.r - b.r || Number(!!b.s.popular) - Number(!!a.s.popular) || a.s.name.localeCompare(b.s.name))
    .map(x => x.s).slice(0, max)
}
