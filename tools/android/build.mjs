// L'app per Android (APK) da installare direttamente sui telefoni dei tester, senza Play Store.
// È una Trusted Web Activity, il modo ufficiale di Google per pubblicare una PWA come app: dentro gira la stessa app
// del sito, quindi notifiche, dati e aggiornamenti funzionano come nella PWA e una versione nuova arriva senza
// reinstallare. Va ricostruita solo se cambiano nome, icona o indirizzo. Lo stesso progetto andrà sul Play Store.
//
// Uso (lo fa la GitHub Action "Android"): node tools/android/build.mjs
// Servono: JAVA_HOME (JDK 17), ANDROID_HOME, ANDROID_KEYSTORE (file .p12), ANDROID_KEYSTORE_PASSWORD, VERSION_CODE.
import { AndroidSdkTools, Config, ConsoleLog, GradleWrapper, JdkHelper, TwaGenerator, TwaManifest } from '@bubblewrap/core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SITE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'
// identificativo per sempre: non si cambia dopo la prima installazione (è anche quello del Play Store)
const PACKAGE = 'com.quadriamo.app'
const OUT = resolve('dist-android'), DIR = join(OUT, 'project')
const need = name => process.env[name] || (console.error(`Manca ${name}`), process.exit(1))
const keystore = resolve(need('ANDROID_KEYSTORE')), password = need('ANDROID_KEYSTORE_PASSWORD')
const version = JSON.parse(readFileSync('package.json', 'utf8')).version

const log = new ConsoleLog('android')
const manifestUrl = new URL('manifest.webmanifest', SITE)
const res = await fetch(manifestUrl)
if (!res.ok) { console.error(`Il manifest non è online (${manifestUrl}): pubblica prima il sito.`); process.exit(1) }
const twa = TwaManifest.fromWebManifestJson(manifestUrl, await res.json())
Object.assign(twa, {
  packageId: PACKAGE, appVersionName: version, appVersionCode: Number(need('VERSION_CODE')),
  enableNotifications: true,            // le notifiche della PWA arrivano come notifiche dell'app
  minSdkVersion: 24,                    // Android 7 o più recente: lo richiede androidbrowserhelper
  fallbackType: 'customtabs', signingKey: { path: keystore, alias: 'quadriamo' },
  // barra di navigazione di Android dello stesso colore dello sfondo dell'app: niente fascia nera o chiara in basso
  navigationColor: twa.backgroundColor, navigationColorDark: twa.backgroundColor,
  navigationDividerColor: twa.backgroundColor, navigationDividerColorDark: twa.backgroundColor, themeColorDark: twa.themeColor,
})

rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true })
await new TwaGenerator().createTwaProject(DIR, twa, log)
const config = new Config(need('JAVA_HOME'), need('ANDROID_HOME'))
const sdk = await AndroidSdkTools.create(process, config, new JdkHelper(process, config), log)
await new GradleWrapper(process, sdk, DIR).assembleRelease()

const unsigned = join(DIR, 'app/build/outputs/apk/release/app-release-unsigned.apk')
const aligned = join(OUT, 'aligned.apk')
const apk = join(OUT, 'Quadriamo.apk')
await sdk.zipalign(unsigned, aligned)
await sdk.apksigner(keystore, password, 'quadriamo', password, aligned, apk)
rmSync(aligned)

// l'impronta della firma: va nel file assetlinks.json del sito, così Android sa che app e sito sono della stessa persona
// e l'app si apre a tutto schermo, senza la barra dell'indirizzo
const certs = execFileSync(join(process.env.JAVA_HOME, 'bin/keytool'), ['-list', '-v', '-keystore', keystore, '-storepass', password, '-alias', 'quadriamo']).toString()
const sha256 = /SHA256:\s*([0-9A-F:]+)/.exec(certs)?.[1]
writeFileSync(join(OUT, 'assetlinks.json'), JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: PACKAGE, sha256_cert_fingerprints: [sha256] } }], null, 2) + '\n')
console.log(`\n${apk}\nversione ${version} (${twa.appVersionCode}) · ${PACKAGE} · firma ${sha256}`)
