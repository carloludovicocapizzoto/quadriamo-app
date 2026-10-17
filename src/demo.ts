// Dati di esempio: quattro mesi di uno studente fuori sede (assegno dei genitori, part-time, affitto della stanza,
// spesa, uscite con i coinquilini), nella lingua dell'app. Servono a capire l'app in un minuto: nessun dato reale.
import { addDays, applyPersona, defaultSettings, makeDate, monthOf, parseDate, prevMonth, type Recurring, type Transaction } from './engine'
import type { AppData } from './store/state'

type Lang = 'it' | 'en' | 'fr' | 'es'
const VARIABLE = new Set(['groceries', 'eatingOut', 'transport', 'funShopping', 'university'])

// testi per lingua: [chiave] -> descrizione
const TEXT: Record<Lang, Record<string, string>> = {
  it: { saturday: 'Uscita del sabato', clothes: 'Vestiti', gift: 'Regalo di compleanno', sushi: 'Sushi con le amiche', allowance: 'Assegno dei genitori', partTime: 'Part-time in libreria', lidl: 'Spesa Lidl', esse: 'Spesa Esselunga', apero: 'Aperitivo con i coinquilini',
    books: 'Libri e fotocopie', pizza: 'Pizza con il gruppo di studio', cinema: 'Cinema', train: 'Treno per tornare a casa', kebab: 'Kebab dopo lezione',
    fund: 'Fondo imprevisti', concert: 'Concerto', rent: 'Affitto', pass: 'Abbonamento bus e metro', phone: 'Telefono', music: 'Spotify Student', goal: 'Erasmus a Lisbona' },
  en: { saturday: 'Saturday night out', clothes: 'Clothes', gift: 'Birthday present', sushi: 'Sushi with friends', allowance: 'Allowance from parents', partTime: 'Part-time at the bookshop', lidl: 'Groceries (Lidl)', esse: 'Groceries (supermarket)', apero: 'Drinks with flatmates',
    books: 'Books and photocopies', pizza: 'Pizza with the study group', cinema: 'Cinema', train: 'Train home', kebab: 'Kebab after class',
    fund: 'Emergency fund', concert: 'Concert', rent: 'Rent', pass: 'Bus and metro pass', phone: 'Phone', music: 'Spotify Student', goal: 'Erasmus in Lisbon' },
  fr: { saturday: 'Sortie du samedi', clothes: 'Vêtements', gift: 'Cadeau d’anniversaire', sushi: 'Sushi entre amis', allowance: 'Aide des parents', partTime: 'Job à la librairie', lidl: 'Courses Lidl', esse: 'Courses supermarché', apero: 'Apéro avec les colocs',
    books: 'Livres et photocopies', pizza: 'Pizza avec le groupe de révision', cinema: 'Cinéma', train: 'Train pour rentrer', kebab: 'Kebab après les cours',
    fund: 'Fonds imprévus', concert: 'Concert', rent: 'Loyer', pass: 'Abonnement bus et métro', phone: 'Téléphone', music: 'Spotify Student', goal: 'Erasmus à Lisbonne' },
  es: { saturday: 'Salida del sábado', clothes: 'Ropa', gift: 'Regalo de cumpleaños', sushi: 'Sushi con amigas', allowance: 'Ayuda de los padres', partTime: 'Media jornada en la librería', lidl: 'Compra Lidl', esse: 'Compra supermercado', apero: 'Cañas con los compañeros de piso',
    books: 'Libros y fotocopias', pizza: 'Pizza con el grupo de estudio', cinema: 'Cine', train: 'Tren para volver a casa', kebab: 'Kebab después de clase',
    fund: 'Fondo de imprevistos', concert: 'Concierto', rent: 'Alquiler', pass: 'Abono de bus y metro', phone: 'Teléfono', music: 'Spotify Student', goal: 'Erasmus en Lisboa' },
}

export function demoAppData(today: string, lang = 'it'): AppData {
  const tx = TEXT[(lang in TEXT ? lang : 'en') as Lang]
  const cur = monthOf(today, 1)
  const months = [prevMonth(prevMonth(prevMonth(cur))), prevMonth(prevMonth(cur)), prevMonth(cur), cur]
  // spese variabili un po' diverse ogni mese, così andamento e confronti hanno qualcosa da mostrare
  const factor = [1.12, 1.04, 1, 0.93]
  const recurring: Recurring[] = [
    { name: tx.rent, amount: 380, category: 'rent', day: 1, active: true },
    { name: tx.pass, amount: 22, category: 'transport', day: 2, active: true },
    { name: tx.phone, amount: 7.99, category: 'fixedCosts', day: 5, active: true },
    { name: tx.music, amount: 5.99, category: 'fixedCosts', day: 18, active: true },
  ]
  const base = applyPersona(defaultSettings({ firstMonth: months[0], recurring }), 'student')
  // la musica e il telefono sono abbonamenti: monogramma, rinnovo e costo annuale (Profilo → Abbonamenti e ricorrenti)
  const settings = { ...base, events: base.events.map(e => e.title === tx.music ? { ...e, kind: 'subscription' as const, service: 'spotify', method: 'card' }
    : e.title === tx.phone ? { ...e, kind: 'subscription' as const, service: 'iliad', method: 'card' } : e) }
  settings.buckets.forEach((b, i) => { b.startingBalance = [20, 0, 60, 0][i] })

  const rows: [number, string, string, number][] = [
    [1, 'allowance', 'allowance', 750],
    [3, 'lidl', 'groceries', 34.8],
    [6, 'apero', 'eatingOut', 12.5],
    [8, 'books', 'university', 18.4],
    [10, 'esse', 'groceries', 41.25],
    [12, 'pizza', 'eatingOut', 14],
    [14, 'cinema', 'funShopping', 8.5],
    [15, 'partTime', 'partTime', 280],
    [17, 'train', 'transport', 34.9],
    [20, 'lidl', 'groceries', 29.6],
    [22, 'kebab', 'eatingOut', 6.5],
    [25, 'fund', 'safetyFundSaving', 40],
    [27, 'concert', 'funShopping', 25],
    [9, 'saturday', 'eatingOut', 28],
    [18, 'clothes', 'funShopping', 45],
    [21, 'gift', 'gifts', 20],
    [26, 'sushi', 'eatingOut', 22],
  ]
  const todayDay = parseDate(today).day
  const txs: Transaction[] = []
  months.forEach((ym, m) => {
    rows.forEach(([day, key, category, amount], i) => {
      if (ym === cur && day > todayDay) return                      // niente movimenti nel futuro
      txs.push({ id: `demo-${ym.month}-${i}`, date: makeDate(ym.year, ym.month, day), description: tx[key], category,
                 amount: VARIABLE.has(category) ? Math.round(amount * factor[m] * 100) / 100 : amount, paidFrom: null })
    })
  })
  // slancio di esempio: 12 giorni di fila fino a oggi
  const activity = Array.from({ length: 12 }, (_, i) => addDays(today, i - 11))
  // un obiettivo di esempio: l'Erasmus, a buon punto
  const goals = [{ id: 'demo-goal', name: tx.goal, target: 1200, deadline: `${months[3].year + 1}-06`, icon: 'plane',
    contributions: months.map((m, i) => ({ id: `demo-gc-${i}`, date: makeDate(m.year, m.month, 2), amount: 90 })),
    createdAt: makeDate(months[0].year, months[0].month, 1), updatedAt: new Date(0).toISOString() }]
  // capitale di partenza: i risparmi di prima dell'università, in tre destinazioni (uno collegato all'obiettivo Erasmus)
  const capStart = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`
  const L = ({ it: ['Fondo di emergenza', 'Liquidità', 'Erasmus'], en: ['Emergency fund', 'Cash', 'Erasmus'],
    fr: ['Fonds d’urgence', 'Liquidités', 'Erasmus'], es: ['Fondo de emergencia', 'Liquidez', 'Erasmus'] } as Record<string, string[]>)[lang] ?? ['Emergency fund', 'Cash', 'Erasmus']
  settings.capital = {
    date: today,
    parts: [
      { id: 'demo-cap-1', name: L[0], kind: 'emergency', amount: 1200, policy: 'emergency' },
      { id: 'demo-cap-2', name: L[1], kind: 'liquid', amount: 450, policy: 'always' },
      { id: 'demo-cap-3', name: L[2], kind: 'goal', amount: 600, policy: 'big', bigPurchases: ['travel'], goalId: goals[0]?.id ?? null },
    ],
    history: [{ date: capStart, total: 2500 }, { date: today, total: 2250 }],
  }
  return { version: 1, settings, transactions: txs, demo: true, activity, goals }
}
