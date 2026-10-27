// URL distinto dal vecchio script: una risposta legacy nella cache HTTP non deve essere importata.
// I push restano sospesi finché non esiste un binding proprietario verificato.
self.addEventListener('push', function (event) {
  event.waitUntil(Promise.resolve())
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) {
        list[i].navigate('./app/')
        return list[i].focus()
      }
    }
    return self.clients.openWindow('./app/')
  }))
})
