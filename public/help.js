// Centro assistenza del sito: disegna domande e risposte da help.json (lo stesso file che usa l'app) in ogni lingua.
// "Contattaci" mostra l'email di help.json; finché è vuota, dice dove scrivere dall'app.
;(function () {
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
  fetch('help.json').then(function (r) { return r.json() }).then(function (help) {
    document.querySelectorAll('section.help[data-lang]').forEach(function (sec) {
      var h = help[sec.getAttribute('data-lang')]
      if (!h) return
      sec.appendChild(el('h1', null, h.title))
      sec.appendChild(el('p', 'muted', h.intro))
      h.sections.forEach(function (s) {
        sec.appendChild(el('h2', null, s.title))
        var list = el('div', 'faq')
        s.items.forEach(function (i) {
          var d = el('details'), sum = el('summary', null, i.q)
          d.appendChild(sum); d.appendChild(el('p', null, i.a)); list.appendChild(d)
        })
        sec.appendChild(list)
      })
      var c = el('div', 'contact'); c.id = 'contatti'
      c.appendChild(el('h2', null, h.contactTitle))
      if (help.contact) {
        var p = el('p'), a = el('a', 'contact-mail', help.contact); a.href = 'mailto:' + help.contact + '?subject=Quadriamo'
        p.appendChild(a); c.appendChild(p); c.appendChild(el('p', 'muted', h.contactText))
      } else c.appendChild(el('p', 'muted', h.contactSoon))
      sec.appendChild(c)
    })
    if (location.hash) { var t = document.querySelector('[data-lang].on ' + location.hash); if (t) t.scrollIntoView() }
  })
})()
