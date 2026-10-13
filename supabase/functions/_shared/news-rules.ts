// Regole del Knowledge Hub (fase 1, senza AI): categorie, livello, rilevanza, clickbait, doppioni e stessa notizia.
// Funzioni pure, senza dipendenze: le usa la funzione news-ingest (Deno) e le provano i test dell'app (vitest).

export const CATEGORIES = ['economy', 'markets', 'etf', 'stocks', 'bonds', 'commodities', 'realestate', 'personal', 'saving',
  'budget', 'pension', 'psychology', 'tax', 'tech', 'ai', 'startup', 'crypto'] as const
export type Category = typeof CATEGORIES[number]

// parole nelle quattro lingue (italiano, inglese, francese, spagnolo); si cerca in titolo + estratto, senza maiuscole
const RULES: Record<Category, RegExp> = {
  economy: /\b(pil|gdp|inflazion|inflation|inflaci|recession|r[ée]cession|disoccupazion|unemployment|ch[ôo]mage|desempleo|crescita economica|economic growth|banca centrale|central bank|banque centrale|banco central|bce|ecb|fed|federal reserve|tassi d.interesse|interest rates?|taux d.int|tipos de inter|dazi|tariffs?|droits de douane|aranceles|economia|economy|[ée]conomie|econom[ií]a)\b/,
  markets: /\b(borsa|borse|mercati|markets?|bourses?|march[ée]s|mercados|wall street|s&p|nasdaq|dow jones|ftse|piazza affari|cac 40|ibex|stoxx|selloff|rally)\b/,
  etf: /\b(etf|etc|fondi indicizzati|index funds?|fonds indiciels?|fondos indexados|vanguard|ishares|msci world|all.world|passive investing|investimento passivo)\b/,
  stocks: /\b(azion[ie]|stocks?|shares|equit(y|ies)|actions?|acciones|dividend[oi]?s?|ipo)\b/,
  bonds: /\b(obbligazion[ie]|bonds?|btp|bund|treasur(y|ies)|rendiment[io]|yields?|obligations?|bonos)\b/,
  commodities: /\b(petrolio|oil|oro|gold|gas naturale|natural gas|materie prime|commodit(y|ies)|rame|copper|p[ée]trole|petr[óo]leo|mati[èe]res premi[èe]res)\b/,
  realestate: /\b(immobil\w*|mutu[oi]|real estate|housing|mortgages?|house prices|affitt\w*|rent(s|al)?|immobilier|loyers?|vivienda|hipotecas?|alquiler)\b/,
  personal: /\b(finanza personale|personal finance|finances personnelles|finanzas personales|conto corrente|checking account|carta di credito|credit cards?|debt|debiti|prestit[oi]|loans?|credit score|patrimonio|net worth)\b/,
  saving: /\b(risparm\w*|savings?|[ée]pargne|ahorro\w*|emergency fund|fondo di emergenza)\b/,
  budget: /\b(budget|spese|spending|bollett\w*|bills|costo della vita|cost of living|co[uû]t de la vie|presupuesto|gastos|frugal\w*)\b/,
  pension: /\b(pension[ei]?|pensions?|previdenz\w*|retirement|retire|401\(?k\)?|ira|tfr|retraite|jubilaci[óo]n)\b/,
  psychology: /\b(psicolog\w*|psycholog\w*|behaviou?r\w*|comportament\w*|bias|emozion\w*|emotions?|happiness|felicit[àa]|habits?|abitudini)\b/,
  tax: /\b(tass[ae]|fisco|fiscal[ei]?|irpef|imposte|tax(es)?|imp[ôo]ts?|impuestos?|dichiarazione dei redditi)\b/,
  tech: /\b(tecnologi\w*|technolog\w*|big tech|apple|microsoft|nvidia|semiconductors?|chips?|alphabet|amazon|meta)\b/,
  ai: /\b(intelligenza artificiale|artificial intelligence|intelligence artificielle|inteligencia artificial|chatgpt|openai|anthropic|llm|machine learning|generative)\b/,
  startup: /\b(startups?|start-up|venture capital|vc|fundraising|round di finanziamento|unicorn\w*|levée de fonds)\b/,
  crypto: /\b(bitcoin|crypto\w*|cripto\w*|ethereum|blockchain|stablecoins?|btc|eth|nft|solana|binance|coinbase)\b/,
}

const normalize = (s: string) => s.toLowerCase().normalize('NFC')

/** Categorie di un contenuto. Senza parole riconosciute, quella tipica della fonte. */
export function categorize(text: string, sourceTopics: readonly string[] = []): Category[] {
  const t = normalize(text)
  // la sigla AI/IA conta solo in maiuscolo: in italiano "ai" è una preposizione
  const out = CATEGORIES.filter(c => RULES[c].test(t) || (c === 'ai' && /\b(AI|IA)\b/.test(text)))
  if (out.length) return out
  return sourceTopics.filter((x): x is Category => (CATEGORIES as readonly string[]).includes(x))
}

// solo formule da spiegazione ("how to" no: "how to lose money betting against Europe" non è per principianti)
const BEGINNER = /\b(cos.?è|cosa sono|come funziona|guida (a|al|alla|per)|per principianti|spiegat[oaie] (bene|semplice)|in parole semplici|basics|for beginners|beginner.s guide|what is an?|explained simply|101|qu.est-ce qu|comment fonctionne|pour d[ée]butants|qu[ée] es (un|una|el|la)|c[óo]mo funciona|para principiantes)\b/
// le guide pratiche di finanza personale: "come risparmiare", "how to start investing", "cómo ahorrar"…
const HOWTO = /\b(come|how to|c[óo]mo|comment)\s+(\w+\s+)?(risparmi\w*|investire|iniziare|gestire|pagare|scegliere|save|saving|invest|investing|start|budget\w*|pay off|ahorrar|invertir|empezar|[ée]pargner|investir|commencer|g[ée]rer)\b/
/** Livello: le ricerche e le istituzioni sono "avanzato"; le guide e le spiegazioni "principiante". */
export function level(text: string, kind: string): 'beginner' | 'intermediate' | 'advanced' {
  const t = normalize(text)
  if (BEGINNER.test(t) || HOWTO.test(t)) return 'beginner'
  return kind === 'research' || kind === 'institution' ? 'advanced' : 'intermediate'
}

const CORE: Category[] = ['personal', 'saving', 'budget', 'pension', 'tax', 'etf', 'realestate']
/** Quanto riguarda chi gestisce un budget personale (0-1). Una ricerca senza parole di finanza (es. sanità) scende in fondo. */
export function relevance(cats: readonly Category[], matched = true): number {
  if (!matched) return 0.2
  if (cats.some(c => CORE.includes(c))) return 1
  if (cats.some(c => c === 'economy' || c === 'psychology' || c === 'bonds' || c === 'stocks')) return 0.6
  return 0.3
}

const BAIT = /(non crederai|shock|incredibil[ei]|you won.?t believe|nobody tells you|nessuno ti dice|il segreto|the secret|devastante|crollo totale|ti cambierà la vita|life.changing|get rich|diventare ricco|!!|\?!)/
/** Clickbait (0 = pulito, 1 = esca evidente): parole da esca e titoli urlati in maiuscolo. */
export function clickbait(title: string): number {
  let s = BAIT.test(normalize(title)) ? 0.7 : 0
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const caps = letters.replace(/[^A-ZÀ-Þ]/g, '').length
  if (letters.length > 12 && caps / letters.length > 0.6) s += 0.5
  return Math.min(1, s)
}

/** Titolo pulito: senza l'elenco degli autori che alcuni archivi di ricerca aggiungono ("… -- by Rossi, Bianchi"). */
export const cleanTitle = (title: string) => title.replace(/\s+-{1,2}\s+by\s+.+$/i, '').trim()

/** Titoli senza sostanza: dirette, contenuti sponsorizzati, Shorts. Non entrano. */
export const isJunk = (title: string) =>
  /\b(live|diretta|minuto per minuto|en direct|en directo|sponsored|sponsorizzato|in collaborazione con|partner content|publi-?reportage)\b|#shorts/i.test(title)
  // file di dati pubblicati nei feed delle istituzioni: "Titoli XS [csv, 4.2 KB]"
  || /\[(csv|pdf|xlsx?|zip|xml)\s*,\s*[\d.,]+\s*[kmg]?b\]/i.test(title)

/** Indirizzo canonico: senza parametri di tracciamento né ancore. Due link uguali = lo stesso contenuto. */
export function canonical(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|ref_|cmpid|ito|xtor)/i.test(k)) u.searchParams.delete(k)
    u.hostname = u.hostname.replace(/^www\./, '')
    return u.toString().replace(/\/$/, '')
  } catch { return url }
}

const STOP = new Set(('della delle dello degli nella nelle sulla sulle dalla anche come dopo prima perché quando questo questa sono stato hanno ' +
  'with from that this have will what about into after over their there your more than says said ' +
  'dans pour avec sont plus leur cette entre aussi ' +
  'para como pero sobre entre este esta desde tras').split(' '))
/** Parole che contano in un titolo (per riconoscere la stessa notizia scritta da fonti diverse). */
export function keywords(title: string): string[] {
  return [...new Set(normalize(title).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w)))]
}
export function similarity(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0
  const B = new Set(b)
  const inter = a.filter(w => B.has(w)).length
  return inter / (a.length + b.length - inter)
}
export const SAME_EVENT = 0.4

/** Punteggio: fiducia della fonte, freschezza (dimezza in circa un giorno), rilevanza, meno il clickbait. */
export function score(o: { trust: number; ageHours: number; relevance: number; clickbait: number }): number {
  return (o.trust / 5) * Math.exp(-o.ageHours / 36) * (0.6 + 0.4 * o.relevance) * (1 - Math.min(0.6, o.clickbait * 0.6))
}
