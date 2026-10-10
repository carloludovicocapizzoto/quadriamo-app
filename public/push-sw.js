// Notifiche push di Quadriamo (caricato dal service worker dell'app).
self.addEventListener('push', function (event) {
  var data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Quadriamo', body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(data.title || 'Quadriamo', {
    body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-64.png', data: { url: data.url || './app/?feedback=1' },
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
