// "Il consiglio di oggi": piccoli consigli pratici per usare bene il metodo (uno al giorno, a rotazione).
// action: cosa apre il pulsante sotto il consiglio.
export type TipAction = 'add' | 'goals' | 'analysis' | 'import' | 'shared' | 'recurring' | null
export interface Tip { id: string; icon: 'home' | 'plus' | 'target' | 'growth' | 'upload' | 'users' | 'month' | 'chart' | 'check' | 'heart' | 'lock'; action: TipAction; title: string; text: string }

type L = 'it' | 'en' | 'fr' | 'es'
const T: Record<L, [string, string][]> = {
  it: [
    ['Una parte, un salvadanaio', 'Crea in banca quattro salvadanai, uno per parte. Quando arrivano le entrate sposti le cifre che ti dice Quadriamo: quello che vedi nell’app è quello che hai davvero.'],
    ['Segna subito, non la sera', 'Bastano 5 secondi alla cassa. La sera non ti ricordi più il caffè e il biglietto del bus.'],
    ['Il numero è un tetto, non un obiettivo', 'Se oggi spendi meno, domani il numero sale: quello che avanzi resta tuo e passa ai giorni dopo.'],
    ['Le spese piccole fanno il mese', 'Un caffè da 1,20 € ogni giorno di lezione sono più di 25 € al mese. Non devi rinunciarci: basta vederlo.'],
    ['L’affitto prima di tutto', 'Metti affitto e bollette tra i pagamenti ricorrenti: il numero del giorno li tiene già da parte e non ti sorprendono il primo del mese.'],
    ['Il fondo di sicurezza non si tocca', 'Serve per il dentista, il portatile che si rompe, il treno da cambiare all’ultimo. Non per i saldi.'],
    ['Un obiettivo con una data', 'Dai una scadenza ai tuoi obiettivi: Quadriamo calcola quanto mettere da parte ogni mese per arrivarci.'],
    ['Coinquilini: dividete subito', 'Segnate la spesa comune quando la fate, non a fine mese: niente discussioni su chi ha pagato cosa.'],
    ['Abbonamenti dimenticati', 'Una volta al mese guarda i pagamenti ricorrenti: l’abbonamento che non usi più è un piccolo affitto che paghi per niente.'],
    ['A metà mese, la previsione', 'Il 15 apri Analisi: se la previsione dice che sfori, hai ancora due settimane per rimediare.'],
    ['Un giorno storto si recupera', 'Hai speso troppo oggi? Il numero dei prossimi giorni si ricalcola da solo. Conta la settimana, non il singolo giorno.'],
    ['L’estratto conto una volta a settimana', 'Importalo la domenica: ritrovi le spese che hai dimenticato di segnare, e le regole le smistano da sole.'],
    ['Chiedi lo sconto studenti', 'Cinema, trasporti, musei, programmi per il computer: spesso basta chiedere o mostrare il libretto.'],
    ['La spesa con la lista', 'Una lista scritta prima di entrare al supermercato taglia gli acquisti d’impulso. Il numero del giorno ringrazia.'],
  ],
  en: [
    ['One part, one savings pot', 'Create four pots at your bank, one for each part. When money comes in, move the amounts Quadriamo suggests: what you see in the app is what you really have.'],
    ['Log it now, not tonight', 'Five seconds at the till is enough. By evening you have forgotten the coffee and the bus ticket.'],
    ['The number is a ceiling, not a target', 'Spend less today and tomorrow’s number goes up: what you save stays yours and rolls into the next days.'],
    ['Small expenses make the month', 'A €1.20 coffee every class day is over €25 a month. You don’t have to give it up: just see it.'],
    ['Rent comes first', 'Add rent and bills as recurring payments: today’s number already sets them aside, so the 1st of the month holds no surprises.'],
    ['Hands off the safety fund', 'It’s for the dentist, the broken laptop, the last-minute train. Not for the sales.'],
    ['A goal with a date', 'Give your goals a deadline: Quadriamo works out how much to set aside each month to get there.'],
    ['Flatmates: split it right away', 'Log shared shopping when you do it, not at the end of the month: no arguments about who paid what.'],
    ['Forgotten subscriptions', 'Once a month, check your recurring payments: a subscription you no longer use is rent you pay for nothing.'],
    ['Mid-month, check the forecast', 'On the 15th open Insights: if the forecast says you’ll overspend, you still have two weeks to fix it.'],
    ['One bad day can be fixed', 'Spent too much today? The next days’ number recalculates itself. The week counts, not the single day.'],
    ['Your statement once a week', 'Import it on Sunday: you’ll find what you forgot to log, and the rules sort it for you.'],
    ['Ask for the student discount', 'Cinema, transport, museums, software: often you just need to ask or show your student card.'],
    ['Shop with a list', 'A list written before you enter the supermarket cuts impulse buys. Your daily number will thank you.'],
  ],
  fr: [
    ['Une part, une cagnotte', 'Créez quatre cagnottes dans votre banque, une par part. Quand l’argent arrive, déplacez les montants indiqués par Quadriamo : ce que vous voyez dans l’app correspond à ce que vous avez vraiment.'],
    ['Notez tout de suite, pas le soir', 'Cinq secondes à la caisse suffisent. Le soir, on oublie le café et le ticket de bus.'],
    ['Le chiffre est un plafond, pas un objectif', 'Dépensez moins aujourd’hui et le chiffre de demain monte : ce que vous économisez reste à vous.'],
    ['Les petites dépenses font le mois', 'Un café à 1,20 € chaque jour de cours, c’est plus de 25 € par mois. Inutile d’y renoncer : il suffit de le voir.'],
    ['Le loyer d’abord', 'Ajoutez loyer et factures aux paiements récurrents : le chiffre du jour les met déjà de côté.'],
    ['On ne touche pas au fonds de sécurité', 'Il sert pour le dentiste, l’ordinateur cassé, le train de dernière minute. Pas pour les soldes.'],
    ['Un objectif avec une date', 'Donnez une échéance à vos objectifs : Quadriamo calcule combien mettre de côté chaque mois.'],
    ['Colocs : partagez tout de suite', 'Notez les courses communes au moment où vous les faites : plus de disputes sur qui a payé quoi.'],
    ['Abonnements oubliés', 'Une fois par mois, regardez vos paiements récurrents : un abonnement inutilisé, c’est un loyer payé pour rien.'],
    ['À mi-mois, la prévision', 'Le 15, ouvrez Analyse : si la prévision annonce un dépassement, vous avez encore deux semaines.'],
    ['Une mauvaise journée se rattrape', 'Trop dépensé aujourd’hui ? Le chiffre des jours suivants se recalcule. C’est la semaine qui compte.'],
    ['Le relevé une fois par semaine', 'Importez-le le dimanche : vous retrouvez ce que vous avez oublié de noter, et les règles le classent.'],
    ['Demandez la réduction étudiante', 'Cinéma, transports, musées, logiciels : il suffit souvent de demander ou de montrer sa carte.'],
    ['Les courses avec une liste', 'Une liste faite avant d’entrer au supermarché réduit les achats impulsifs.'],
  ],
  es: [
    ['Una parte, una hucha', 'Crea cuatro huchas en tu banco, una por parte. Cuando entra el dinero, mueve las cantidades que te indica Quadriamo: lo que ves en la app es lo que tienes de verdad.'],
    ['Anótalo ya, no por la noche', 'Bastan 5 segundos en la caja. Por la noche ya no recuerdas el café ni el billete de bus.'],
    ['El número es un techo, no un objetivo', 'Si hoy gastas menos, mañana el número sube: lo que ahorras sigue siendo tuyo.'],
    ['Los gastos pequeños hacen el mes', 'Un café de 1,20 € cada día de clase son más de 25 € al mes. No tienes que dejarlo: basta con verlo.'],
    ['El alquiler, lo primero', 'Pon alquiler y facturas como pagos recurrentes: el número del día ya los aparta.'],
    ['El fondo de seguridad no se toca', 'Es para el dentista, el portátil roto, el tren de última hora. No para las rebajas.'],
    ['Un objetivo con fecha', 'Ponle plazo a tus objetivos: Quadriamo calcula cuánto apartar cada mes para llegar.'],
    ['Compañeros de piso: dividid al momento', 'Anotad la compra común cuando la hacéis, no a fin de mes: sin discusiones sobre quién pagó qué.'],
    ['Suscripciones olvidadas', 'Una vez al mes revisa los pagos recurrentes: la suscripción que no usas es un alquiler pagado por nada.'],
    ['A mitad de mes, la previsión', 'El día 15 abre Análisis: si la previsión dice que te pasas, aún tienes dos semanas para corregirlo.'],
    ['Un mal día se recupera', '¿Has gastado de más hoy? El número de los próximos días se recalcula solo. Cuenta la semana, no el día.'],
    ['El extracto una vez por semana', 'Impórtalo el domingo: recuperas lo que olvidaste anotar y las reglas lo clasifican.'],
    ['Pide el descuento de estudiante', 'Cine, transporte, museos, programas: a menudo basta con preguntar o enseñar el carné.'],
    ['La compra con lista', 'Una lista hecha antes de entrar al súper reduce las compras por impulso.'],
  ],
}
const META: [Tip['id'], Tip['icon'], TipAction][] = [
  ['banks', 'home', null], ['now', 'plus', 'add'], ['ceiling', 'chart', null], ['small', 'heart', null], ['rent', 'month', 'recurring'],
  ['fund', 'lock', null], ['goal', 'target', 'goals'], ['flat', 'users', 'shared'], ['subs', 'month', 'recurring'], ['forecast', 'growth', 'analysis'],
  ['badday', 'check', null], ['import', 'upload', 'import'], ['discount', 'heart', null], ['list', 'check', null],
]

export function tips(lang: string): Tip[] {
  const t = T[(lang in T ? lang : 'en') as L]
  return META.map(([id, icon, action], i) => ({ id, icon, action, title: t[i][0], text: t[i][1] }))
}

