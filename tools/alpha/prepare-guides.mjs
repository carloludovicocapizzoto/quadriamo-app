import {readFile, writeFile, unlink, access} from 'node:fs/promises'
import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = resolve(process.argv[2] || 'dist-alpha')
const source = dirname(fileURLToPath(import.meta.url))
const alphaHost = 'carloludovicocapizzoto.github.io/quadriamo-app/app/'
const alphaUrl = `https://${alphaHost}`

function findDivEnd(html, start) {
  const tags = /<\/?div\b[^>]*>/gi
  tags.lastIndex = start
  let depth = 0
  let match
  while ((match = tags.exec(html))) {
    if (/^<\//.test(match[0])) depth--
    else if (!/\/\s*>$/.test(match[0])) depth++
    if (depth === 0) return tags.lastIndex
  }
  throw new Error(`Unclosed guide panel at offset ${start}`)
}

function emptyPanel(html, marker, replacement) {
  const start = html.indexOf(marker)
  if (start < 0) throw new Error(`Alpha guide marker missing: ${marker}`)
  const open = html.lastIndexOf('<div', start)
  if (open < 0) throw new Error(`Guide panel container missing: ${marker}`)
  return html.slice(0, open) + replacement + html.slice(findDivEnd(html, open))
}

function addScript(html) {
  return html.replace(/<\/body>/i, '<script src="/alpha-guides.js"></script>\n</body>')
}

async function transform(file, fn) {
  const path = resolve(root, file)
  const before = await readFile(path, 'utf8')
  let after = fn(before)
  after = after.replaceAll(alphaUrl, '/app/')
  after = after.replaceAll(alphaHost, '/app/')
  if (/carloludovicocapizzoto\.github\.io|quadriamo-app\.github\.io|github\.com\/carloludovicocapizzoto\/quadriamo-app\/releases/.test(after)) {
    throw new Error(`Alpha guide still contains a historical production URL: ${file}`)
  }
  await writeFile(path, after)
}

await transform('inizia.html', html => {
  html = html.replace('<html lang="it">', '<html lang="it" data-qa2g-alpha-guides>')
  for (const device of ['android', 'mac', 'windows']) {
    const marker = `<div class="dev-panel" data-dev="${device}" role="tabpanel">`
    while (html.includes(marker)) {
      html = emptyPanel(html, marker, `<div class="dev-panel" data-dev="${device}" role="tabpanel" data-qa2g-native-panel></div>`)
    }
  }
  html = html.replace(/<img src="qr\.svg"[^>]*>/g, '<a class="btn big" href="/app/" data-qa2g-app-open>Open Quadriamo</a>')
  return addScript(html)
})

await transform('install.html', html => {
  html = html.replace('<html lang="it">', '<html lang="it" data-qa2g-alpha-guides>')
  for (const lang of ['it', 'en', 'fr', 'es']) {
    const sectionStart = html.indexOf(`<section data-lang="${lang}">`)
    if (sectionStart < 0) throw new Error(`Install guide language missing: ${lang}`)
    const androidHeading = html.indexOf('<h2>Android</h2>', sectionStart)
    const sectionEnd = html.indexOf('</section>', sectionStart)
    if (androidHeading < 0 || androidHeading > sectionEnd) throw new Error(`Android install section missing: ${lang}`)
    html = emptyPanel(html, '<h2>Android</h2>', '<div class="card" data-qa2g-install-android></div>')
  }
  html = html.replace(/<img src="qr\.svg"[^>]*>/g, '<a class="btn" href="/app/" data-qa2g-app-open>Open Quadriamo</a>')
  return addScript(html)
})

await transform('index.html', html => {
  html = html.replace('<html lang="it">', '<html lang="it" data-qa2g-alpha-guides>')
  html = html.replace(/<img src="\/qr\.svg"[^>]*>/, '<a class="btn btn-small" href="/app/" data-qa2g-app-open>Apri Quadriamo</a>')
  return addScript(html)
})

// The shortcut URL in the four translations is displayed text, so replace its old origin too.
const installPath = resolve(root, 'install.html')
let install = await readFile(installPath, 'utf8')
install = install.replace(/(<code>)\/app\/\?add=1<\/code>/g, '<code data-qa2g-add-url></code>')
await writeFile(installPath, install)

const homePath = resolve(root, 'home.js')
let home = await readFile(homePath, 'utf8')
const copy = [
  ["'hero.qrT': 'Inquadra e aprila sul telefono'", "'hero.qrT': 'Apri Quadriamo sul telefono'"],
  ["'hero.qr': 'Si installa dal browser in 30 secondi, senza App Store.'", "'hero.qr': 'Apri il link e installala dal menu del browser.'"],
  ["'hero.qrT': 'Scan to open it on your phone'", "'hero.qrT': 'Open Quadriamo on your phone'"],
  ["'hero.qr': 'Installs from the browser in 30 seconds, no App Store.'", "'hero.qr': 'Open the link and install it from your browser menu.'"],
  ["'hero.qrT': 'Scannez pour l’ouvrir sur le téléphone'", "'hero.qrT': 'Ouvrez Quadriamo sur votre téléphone'"],
  ["'hero.qr': 'S’installe depuis le navigateur en 30 secondes, sans App Store.'", "'hero.qr': 'Ouvrez le lien et installez-la depuis le menu du navigateur.'"],
  ["'hero.qrT': 'Escanea y ábrela en el móvil'", "'hero.qrT': 'Abre Quadriamo en el móvil'"],
  ["'hero.qr': 'Se instala desde el navegador en 30 segundos, sin App Store.'", "'hero.qr': 'Abre el enlace e instálala desde el menú del navegador.'"],
]
for (const [from, to] of copy) {
  if (!home.includes(from)) throw new Error(`Landing translation missing: ${from}`)
  home = home.replace(from, to)
}
home = home.replaceAll('carloludovicocapizzoto.github.io/quadriamo-app/app/', '/app/')
await writeFile(homePath, home)

await writeFile(resolve(root, 'alpha-guides.js'), await readFile(resolve(source, 'alpha-guides.js')))
try { await access(resolve(root, 'qr.svg')); await unlink(resolve(root, 'qr.svg')) } catch {}

const outputs = ['index.html', 'inizia.html', 'install.html', 'home.js', 'pages.js', 'alpha-guides.js']
const scan = await Promise.all(outputs.map(file => readFile(resolve(root, file), 'utf8')))
const text = scan.join('\n')
if (/carloludovicocapizzoto\.github\.io|quadriamo-app\.github\.io|github\.com\/carloludovicocapizzoto\/quadriamo-app\/releases/.test(text)) {
  throw new Error('Unexpected historical production link remains in Alpha guide assets')
}
if (!text.includes("location.origin") || !text.includes("new URL('/app/', location.origin)")) {
  throw new Error('Alpha guide links are not based on their current origin')
}
console.log(`ALPHA_GUIDES_PREPARED files=${outputs.length} historicalLinks=0 origin=runtime`)
