// Notifiche push di Quadriamo (caricato dal service worker dell'app).
// - richiesta di feedback e messaggi dell'amministratore: titolo e testo arrivano dal server
// - "morning": il server manda solo la sveglia; il numero del giorno si calcola qui, con il riepilogo salvato dall'app
//   sul dispositivo (IndexedDB "keyval-store", chiave "quadriamo.morning"). Gli importi non passano mai dal server.
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
             ['Il tuo slancio ti aspetta', 'Sei a {n} giorni. Basta un movimento, o "Oggi niente spese".']],
    plain: [['Com’è andata oggi?', 'Segna le spese di oggi: bastano pochi secondi.'],
            ['Un attimo per Quadriamo', 'Le spese di oggi sono già dentro? Se non hai speso niente, basta un tocco.'],
            ['Il caffè conta', 'Anche le piccole spese fanno il mese. Segnale adesso, finché te le ricordi.'],
            ['Tutto sotto controllo?', 'Aggiorna Quadriamo e guarda quanto ti resta per oggi.']],
    safe: ['Slancio al sicuro', '{n} giorni di fila. Continua così.'],
  },
  en: {
    streak: [['Keep your streak alive', '{n} days in a row: log today’s spending in 10 seconds.'],
             ['Your streak is waiting', 'You’re on {n} days. One entry, or "No spending today", is enough.']],
    plain: [['How did today go?', 'Log today’s spending: it only takes a few seconds.'],
            ['A moment for Quadriamo', 'Is today’s spending in? If you didn’t spend anything, one tap does it.'],
            ['The coffee counts', 'Small expenses add up. Log them now, while you remember.'],
            ['All under control?', 'Update Quadriamo and see what’s left for today.']],
    safe: ['Streak safe', '{n} days in a row. Keep it up.'],
  },
  fr: {
    streak: [['Ne perdez pas votre série', '{n} jours d’affilée : notez les dépenses du jour en 10 secondes.'],
             ['Votre série vous attend', 'Vous en êtes à {n} jours. Une dépense, ou « Aucune dépense aujourd’hui », suffit.']],
    plain: [['Comment s’est passée la journée ?', 'Notez vos dépenses du jour : quelques secondes suffisent.'],
            ['Un instant pour Quadriamo', 'Les dépenses du jour sont-elles notées ? Sinon, un geste suffit.'],
            ['Le café compte', 'Les petites dépenses font le mois. Notez-les maintenant.'],
            ['Tout est sous contrôle ?', 'Mettez Quadriamo à jour et voyez ce qu’il reste pour aujourd’hui.']],
    safe: ['Série en sécurité', '{n} jours d’affilée. Continuez comme ça.'],
  },
  es: {
    streak: [['No pierdas tu racha', '{n} días seguidos: anota los gastos de hoy en 10 segundos.'],
             ['Tu racha te espera', 'Llevas {n} días. Basta un movimiento, o «Hoy sin gastos».']],
    plain: [['¿Qué tal ha ido hoy?', 'Anota los gastos de hoy: solo unos segundos.'],
            ['Un momento para Quadriamo', '¿Ya están los gastos de hoy? Si no gastaste nada, basta un toque.'],
            ['El café cuenta', 'Los pequeños gastos hacen el mes. Anótalos ahora que te acuerdas.'],
            ['¿Todo bajo control?', 'Actualiza Quadriamo y mira cuánto te queda para hoy.']],
    safe: ['Racha a salvo', '{n} días seguidos. Sigue así.'],
  },
}

function isoToday() {
  var d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function nudgeNotification(lang) {
  return readSnapshot().then(function (s) {
    var w = NUDGE[(s && s.lang) || lang] || NUDGE.en
    var n = (s && s.streak) || 0
    var pick = function (list) { return list[Math.floor(Math.random() * list.length)] }
    // aggiornato oggi ma il server non lo sapeva ancora (es. offline): solo un complimento
    var t = s && s.lastActive === isoToday() ? w.safe : n > 0 ? pick(w.streak) : pick(w.plain)
    return { title: t[0], body: t[1].replace('{n}', String(n)) }
  })
}

function readSnapshot() {
  return new Promise(function (resolve) {
    try {
      var req = indexedDB.open('keyval-store')
      req.onerror = function () { resolve(null) }
      req.onsuccess = function () {
        try {
          var get = req.result.transaction('keyval', 'readonly').objectStore('keyval').get('quadriamo.morning')
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
    : data.kind === 'nudge' ? nudgeNotification(data.lang)
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
