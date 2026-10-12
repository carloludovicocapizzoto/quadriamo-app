// Sito: calcolatore del numero del giorno e demo che si anima scorrendo la pagina.
(function () {
  var RULES = { student: [0.6, 0.25, 0.15, 0], worker: [0.55, 0.2, 0.15, 0.1] }
  var who = 'student'
  var $ = function (id) { return document.getElementById(id) }
  var lang = function () { return document.documentElement.lang || 'it' }
  var money = function (n, digits) {
    return new Intl.NumberFormat(lang(), { style: 'currency', currency: 'EUR', maximumFractionDigits: digits == null ? 2 : digits, minimumFractionDigits: digits == null ? 2 : digits }).format(n)
  }
  var shown = { day: 0, week: 0 }
  var raf = 0
  function countTo(day, week) {
    cancelAnimationFrame(raf)
    var a = { day: shown.day, week: shown.week }, t0 = performance.now()
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function step(t) {
      var k = reduce ? 1 : Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3)
      shown.day = a.day + (day - a.day) * e; shown.week = a.week + (week - a.week) * e
      $('calc-day').textContent = money(shown.day); $('calc-week').textContent = money(shown.week, 0)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }
  function calc() {
    if (!$('calc-income')) return
    var income = +$('calc-income').value, rent = +$('calc-rent').value, bills = +$('calc-bills').value
    $('calc-income-v').textContent = money(income, 0); $('calc-rent-v').textContent = money(rent, 0); $('calc-bills-v').textContent = money(bills, 0)
    var r = RULES[who], parts = r.map(function (s) { return income * s })
    // affitto e bollette escono dagli Essenziali; quello che resta, più le uscite, si divide per i giorni del mese
    var freeEss = parts[0] - rent - bills
    var day = (Math.max(0, freeEss) + parts[1]) / 30.4
    countTo(day, day * 7)
    var max = Math.max.apply(null, parts) || 1
    for (var i = 0; i < 4; i++) {
      $('calc-p' + (i + 1)).textContent = money(parts[i], 0)
      $('calc-b' + (i + 1)).style.width = (parts[i] / max * 100) + '%'
    }
    $('calc-warn').hidden = freeEss >= 0
    $('calc-p4').parentElement.classList.toggle('off', r[3] === 0)
  }
  document.querySelectorAll('.calc-who button').forEach(function (b) {
    b.addEventListener('click', function () {
      who = b.getAttribute('data-who')
      document.querySelectorAll('.calc-who button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)) })
      if (who === 'worker' && +$('calc-income').value < 1200) $('calc-income').value = 1600
      if (who === 'student' && +$('calc-income').value > 1500) $('calc-income').value = 950
      calc()
    })
  })
  ;['calc-income', 'calc-rent', 'calc-bills'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', calc) })
  var sel = document.querySelector('.lang-select')
  if (sel) sel.addEventListener('change', function () { setTimeout(calc, 0) })
  calc()

  // demo: il passo più visibile decide lo stato del telefono
  var phone = document.querySelector('.story-phone')
  var steps = document.querySelectorAll('.story-steps li')
  if (phone && steps.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return
        var n = e.target.getAttribute('data-step')
        phone.setAttribute('data-step', n)
        steps.forEach(function (s) { s.classList.toggle('on', s === e.target) })
      })
    // sul telefono il disegno occupa la metà alta dello schermo: conta il passo che si legge sotto
    }, { rootMargin: window.matchMedia('(max-width: 860px)').matches ? '-55% 0px -25% 0px' : '-45% 0px -45% 0px' })
    steps.forEach(function (s) { io.observe(s) })
  } else if (phone) { phone.setAttribute('data-step', '6') }
})()
