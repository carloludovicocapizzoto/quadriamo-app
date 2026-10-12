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
    var today = new Date()
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
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
  var ready = data.kind === 'morning' ? morningNotification(data.lang) : Promise.resolve({ title: data.title, body: data.body })
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
