// I payload attuali non identificano il proprietario. Nessun contenuto personale viene mostrato o letto
// dagli archivi globali; la riattivazione richiede un protocollo di binding verificato con il server.
self.addEventListener('push', function (event) {
  event.waitUntil(Promise.resolve())
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  // Anche una notifica rimasta dal vecchio worker apre soltanto l'ingresso generico.
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) { list[i].navigate('./app/'); return list[i].focus() }
    }
    return self.clients.openWindow('./app/')
  }))
})
