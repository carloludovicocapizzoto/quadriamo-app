// This helper is copied into the Alpha-only distribution by prepare-guides.mjs.
(() => {
  const language = document.documentElement.lang || 'en'
  const copy = {
    it: {open:'Apri Quadriamo', clipboard:'Link copiato', clipboardError:'Non riesco a copiare il link: selezionalo e copialo manualmente.', qr:'Apri questo link sul telefono per usare Quadriamo:', native:'Questa versione Alpha si usa dal browser. Apri Quadriamo e, dal menu del browser, scegli “Installa app” o “Aggiungi alla schermata Home”.', devices:{android:'Android',mac:'Mac',windows:'Windows'}},
    en: {open:'Open Quadriamo', clipboard:'Link copied', clipboardError:'Could not copy the link. Select and copy it manually.', qr:'Open this link on your phone to use Quadriamo:', native:'This Alpha version runs in your browser. Open Quadriamo, then choose “Install app” or “Add to Home Screen” from the browser menu.', devices:{android:'Android',mac:'Mac',windows:'Windows'}},
    fr: {open:'Ouvrir Quadriamo', clipboard:'Lien copié', clipboardError:'Impossible de copier le lien. Sélectionnez-le et copiez-le manuellement.', qr:'Ouvrez ce lien sur votre téléphone pour utiliser Quadriamo :', native:'Cette version Alpha fonctionne dans votre navigateur. Ouvrez Quadriamo, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil » dans le menu du navigateur.', devices:{android:'Android',mac:'Mac',windows:'Windows'}},
    es: {open:'Abrir Quadriamo', clipboard:'Enlace copiado', clipboardError:'No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.', qr:'Abre este enlace en tu móvil para usar Quadriamo:', native:'Esta versión Alpha funciona en el navegador. Abre Quadriamo y elige «Instalar aplicación» o «Añadir a la pantalla de inicio» en el menú del navegador.', devices:{android:'Android',mac:'Mac',windows:'Windows'}},
  }
  const textFor = element => copy[element?.closest('[data-lang]')?.getAttribute('data-lang')] || copy[language] || copy.en
  const text = textFor(document.querySelector('[data-lang].on'))
  const appUrl = new URL('/app/', location.origin).href
  const addUrl = new URL('/app/?add=1', location.origin).href
  document.documentElement.setAttribute('data-qa2g-alpha-guides', 'true')

  document.querySelectorAll('[data-qa2g-app-open]').forEach(link => {
    link.href = appUrl
    link.textContent = text.open
  })
  document.querySelectorAll('.app-link a[href="/app/"]').forEach(link => {
    link.href = appUrl
    link.textContent = `${location.host}/app/`
  })
  document.querySelectorAll('.copy-link').forEach(button => {
    const raw = button.getAttribute('data-url') || ''
    const url = raw.startsWith('/app/?add=') ? addUrl : raw.startsWith('/app/') ? appUrl : ''
    if (!url) { button.remove(); return }
    button.setAttribute('data-url', url)
    button.setAttribute('aria-live', 'polite')
    button.addEventListener('click', async () => {
      const current = textFor(button)
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(url)
        button.textContent = current.clipboard
      } catch {
        button.textContent = current.clipboardError
      }
      setTimeout(() => { button.textContent = button.getAttribute('data-copy-label') || current.open }, 2500)
    })
    button.setAttribute('data-copy-label', button.textContent)
  })
  document.querySelectorAll('code[data-qa2g-add-url]').forEach(code => { code.textContent = addUrl })

  document.querySelectorAll('.dev-panel[data-qa2g-native-panel], [data-qa2g-install-android]').forEach(panel => {
    const current = textFor(panel)
    const heading = document.createElement('h2')
    heading.textContent = current.devices[panel.getAttribute('data-dev')] || 'Android'
    const paragraph = document.createElement('p')
    paragraph.textContent = current.native
    const link = document.createElement('a')
    link.className = 'btn big'
    link.href = appUrl
    link.textContent = current.open
    panel.append(heading, paragraph, link)
  })
  document.querySelectorAll('.qr-big, .card.qr').forEach(block => {
    const current = textFor(block)
    const paragraph = block.querySelector('p:not(.small)') || block.querySelector('p')
    if (!paragraph) return
    paragraph.replaceChildren(document.createTextNode(`${current.qr} `))
    const link = document.createElement('a')
    link.href = appUrl
    link.textContent = `${location.host}/app/`
    paragraph.append(link)
  })
})()
