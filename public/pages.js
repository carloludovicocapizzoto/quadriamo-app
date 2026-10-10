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
