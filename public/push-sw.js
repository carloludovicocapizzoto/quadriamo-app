// Notifiche push di Quadriamo (caricato dal service worker dell'app).
// - richiesta di feedback e messaggi dell'amministratore: titolo e testo arrivano dal server
// - "morning": il server manda solo la sveglia; il numero del giorno si calcola qui, con il riepilogo salvato dall'app
//   sul dispositivo (IndexedDB "keyval-store", chiave "quadriamo.morning", con "beta:" davanti nella beta). Gli importi non passano mai dal server.
var MORNING = {
  it: ['Oggi puoi spendere', 'Apri Quadriamo per vedere quanto puoi spendere oggi.'],
  en: ['Today you can spend', 'Open Quadriamo to see how much you can spend today.'],
  fr: ['Aujourd’hui vous pouvez dépenser', 'Ouvrez Quadriamo pour voir combien vous pouvez dépenser aujourd’hui.'],
  es: ['Hoy puedes gastar', 'Abre Quadriamo para ver cuánto puedes gastar hoy.'],
}

// promemoria "a sorpresa": testi a caso; {n} = giorni di slancio
var NUDGE = {
  it: {
    streak: [['Non perdere lo slancio', '{n} giorni di fila: segna le spese di oggi in 10 secondi.'],
             ['Il tuo slancio ti aspetta', 'Sei a {n} giorni. Basta segnare una spesa.']],
    plain: [['Com’è andata oggi?', 'Segna le spese di oggi: bastano pochi secondi.'],
            ['Un attimo per Quadriamo', 'Le spese di oggi sono già dentro?'],
            ['Il caffè conta', 'Anche le piccole spese fanno il mese. Segnale adesso, finché te le ricordi.'],
            ['Tutto sotto controllo?', 'Aggiorna Quadriamo e guarda quanto ti resta per oggi.']],
    late: [['A mezzanotte si chiude la giornata', 'Segna le spese di oggi prima che finisca la giornata.'],
           ['Lo slancio scade a mezzanotte', '{n} giorni di fila: basta una spesa per tenerli.']],
    safe: ['Slancio al sicuro', '{n} giorni di fila. Continua così.'],
  },
  en: {
    streak: [['Keep your streak alive', '{n} days in a row: log today’s spending in 10 seconds.'],
             ['Your streak is waiting', 'You’re on {n} days. One entry is enough.']],
    plain: [['How did today go?', 'Log today’s spending: it only takes a few seconds.'],
            ['A moment for Quadriamo', 'Is today’s spending in?'],
            ['The coffee counts', 'Small expenses add up. Log them now, while you remember.'],
            ['All under control?', 'Update Quadriamo and see what’s left for today.']],
    late: [['The day closes at midnight', 'Log today’s spending before the day ends.'],
           ['Your streak ends at midnight', '{n} days in a row: one entry keeps them.']],
    safe: ['Streak safe', '{n} days in a row. Keep it up.'],
  },
  fr: {
    streak: [['Ne perdez pas votre série', '{n} jours d’affilée : notez les dépenses du jour en 10 secondes.'],
             ['Votre série vous attend', 'Vous en êtes à {n} jours. Une dépense suffit.']],
    plain: [['Comment s’est passée la journée ?', 'Notez vos dépenses du jour : quelques secondes suffisent.'],
            ['Un instant pour Quadriamo', 'Les dépenses du jour sont-elles notées ?'],
            ['Le café compte', 'Les petites dépenses font le mois. Notez-les maintenant.'],
            ['Tout est sous contrôle ?', 'Mettez Quadriamo à jour et voyez ce qu’il reste pour aujourd’hui.']],
    late: [['La journée se termine à minuit', 'Notez les dépenses du jour avant la fin de la journée.'],
           ['Votre série s’arrête à minuit', '{n} jours d’affilée : une dépense suffit pour la garder.']],
    safe: ['Série en sécurité', '{n} jours d’affilée. Continuez comme ça.'],
  },
  es: {
    streak: [['No pierdas tu racha', '{n} días seguidos: anota los gastos de hoy en 10 segundos.'],
             ['Tu racha te espera', 'Llevas {n} días. Basta un movimiento.']],
    plain: [['¿Qué tal ha ido hoy?', 'Anota los gastos de hoy: solo unos segundos.'],
            ['Un momento para Quadriamo', '¿Ya están los gastos de hoy?'],
            ['El café cuenta', 'Los pequeños gastos hacen el mes. Anótalos ahora que te acuerdas.'],
            ['¿Todo bajo control?', 'Actualiza Quadriamo y mira cuánto te queda para hoy.']],
    late: [['El día se cierra a medianoche', 'Anota los gastos de hoy antes de que acabe el día.'],
           ['Tu racha termina a medianoche', '{n} días seguidos: basta un movimiento para mantenerla.']],
    safe: ['Racha a salvo', '{n} días seguidos. Sigue así.'],
  },
}

function isoToday() {
  var d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function nudgeNotification(lang, late) {
  return readSnapshot().then(function (s) {
    var w = NUDGE[(s && s.lang) || lang] || NUDGE.en
    var n = (s && s.streak) || 0
    var pick = function (list) { return list[Math.floor(Math.random() * list.length)] }
    // aggiornato oggi ma il server non lo sapeva ancora (es. offline): solo un complimento.
    // L'ultimo della sera dice che a mezzanotte la giornata (e lo slancio) si chiude
    var t = s && s.lastActive === isoToday() ? w.safe : late ? w.late[n > 0 ? 1 : 0] : n > 0 ? pick(w.streak) : pick(w.plain)
    return { title: t[0], body: t[1].replace('{n}', String(n)) }
  })
}

// la beta vive in /beta/ sullo stesso indirizzo: le sue chiavi hanno il prefisso "beta:" (src/env.ts, storageKey)
var MORNING_KEY = (self.registration.scope.indexOf('/beta/') > -1 ? 'beta:' : '') + 'quadriamo.morning'

function readSnapshot() {
  return new Promise(function (resolve) {
    try {
      var req = indexedDB.open('keyval-store')
      req.onerror = function () { resolve(null) }
      req.onsuccess = function () {
        try {
          var get = req.result.transaction('keyval', 'readonly').objectStore('keyval').get(MORNING_KEY)
          get.onsuccess = function () { resolve(get.result || null) }
          get.onerror = function () { resolve(null) }
        } catch { resolve(null) }
      }
    } catch { resolve(null) }
  })
}

function morningNotification(lang) {
  return readSnapshot().then(function (s) {
    var words = MORNING[(s && s.lang) || lang] || MORNING.en
    var iso = isoToday()
    if (!s || !s.items || !s.items.length || !s.end || iso > s.end) return { title: words[0], body: words[1] }
    var days = Math.round((Date.parse(s.end + 'T00:00:00Z') - Date.parse(iso + 'T00:00:00Z')) / 864e5) + 1
    var fmt = new Intl.NumberFormat(s.lang, { style: 'currency', currency: s.currency })
    var body = s.items.map(function (x) { return x.name + ' ' + fmt.format(Math.max(0, x.free) / Math.max(1, days)) }).join(' · ')
    return { title: words[0], body: body }
  })
}

self.addEventListener('push', function (event) {
  var data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Quadriamo', body: event.data && event.data.text() } }
  var ready = data.kind === 'morning' ? morningNotification(data.lang)
    : data.kind === 'nudge' ? nudgeNotification(data.lang, !!data.late)
    : Promise.resolve({ title: data.title, body: data.body })
  event.waitUntil(ready.then(function (n) {
    return self.registration.showNotification(n.title || 'Quadriamo', {
      body: n.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-64.png', tag: data.kind || 'quadriamo',
      data: { url: data.url || './app/?feedback=1' },
    })
  }))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || './app/?feedback=1'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { list[i].navigate(url); return list[i].focus() } }
    return self.clients.openWindow(url)
  }))
})
