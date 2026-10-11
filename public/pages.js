// Pagine statiche: mostra la lingua scelta (?lang=, poi lingua del browser) e permette di cambiarla.
(function () {
  var langs = Array.prototype.map.call(document.querySelectorAll('[data-lang]'), function (el) { return el.getAttribute('data-lang') })
  var available = langs.filter(function (l, i) { return langs.indexOf(l) === i })
  var fallback = available.indexOf('en') >= 0 ? 'en' : available[0]
  function pick(l) { return available.indexOf(l) >= 0 ? l : fallback }
  function show(l) {
    l = pick(l)
    document.documentElement.lang = l
    document.querySelectorAll('[data-lang]').forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-lang') === l) })
    document.querySelectorAll('[data-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set') === l)) })
  }
  var q = new URLSearchParams(location.search).get('lang')
  var saved = null
  try { saved = localStorage.getItem('quadriamo.lang') } catch { /* storage non disponibile */ }
  show(q || saved || (navigator.language || 'en').slice(0, 2))
  var owner = window.QUADRIAMO_OWNER || {}
  document.querySelectorAll('[data-owner]').forEach(function (el) {
    var v = owner[el.getAttribute('data-owner')]
    if (!v) return
    if (el.getAttribute('data-owner') === 'email') { el.innerHTML = ''; var a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; el.appendChild(a) }
    else el.textContent = v
  })
  document.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-set')) })
  })
})()

// Interfaccia ferma: niente zoom con due dita (iOS ignora user-scalable=no); il doppio tocco lo blocca il CSS
;(function () {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault() }, { passive: false }) })
})()

// Pagina "Scarica": un pannello per dispositivo (iPhone, Android, Mac, Windows), scelto da solo e cambiabile a mano
;(function () {
  if (!document.querySelector('.dev-switch')) return
  var ua = navigator.userAgent
  var ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  var androidTablet = /Android/.test(ua) && !/Mobile/.test(ua)
  var guess = ipad || androidTablet ? 'tablet' : /iPhone|iPod/.test(ua) ? 'iphone'
    : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : 'mac'
  var fromHash = (location.hash || '').slice(1)
  function pick(dev) {
    document.querySelectorAll('.dev-switch button').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-dev') === dev)) })
    document.querySelectorAll('.dev-panel').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-dev') === dev) })
  }
  pick(['iphone', 'tablet', 'android', 'mac', 'windows'].indexOf(fromHash) >= 0 ? fromHash : guess)
  document.querySelectorAll('.dev-switch button').forEach(function (b) {
    b.addEventListener('click', function () { var d = b.getAttribute('data-dev'); pick(d); history.replaceState(null, '', '#' + d) })
  })
})()

// "Copia link" nella pagina Scarica
;(function () {
  document.querySelectorAll('.copy-link').forEach(function (b) {
    var label = b.textContent
    b.addEventListener('click', function () {
      var done = function () { b.textContent = b.getAttribute('data-done'); setTimeout(function () { b.textContent = label }, 2000) }
      if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute('data-url')).then(done, done); else done()
    })
  })
})()
