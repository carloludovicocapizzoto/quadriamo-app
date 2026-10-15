# Genera public/inizia.html: pagina "Scarica" con scelta del dispositivo (iPhone, Android, Mac, Windows) in 4 lingue.
import sys
out = sys.argv[1] if len(sys.argv) > 1 else "public/inizia.html"
T = {
'it': dict(title='Scarica Quadriamo', back='← Torna al sito', h1='Scarica Quadriamo',
  intro='Scegli il dispositivo: ognuno ha i suoi passaggi. Quadriamo si installa dal browser, senza App Store: in un minuto hai l’icona e l’app a schermo intero.',
  pick='Su che dispositivo la vuoi?', open='Apri Quadriamo', guide='Guida completa',
  orLink='Oppure apri questo link sul telefono (o mandatelo):', copy='Copia link', copied='Copiato ✓', phoneQr='Inquadra il codice con la fotocamera del telefono: si apre Quadriamo.', phoneHere='Sei già sul telefono: tocca il pulsante.',
  deskBtnHint='Si apre nel browser con le istruzioni per installarla.', deskOnPhone='Questi passaggi sono per il computer: apri questa pagina dal tuo {os}.',
  acct='Crea il tuo account', acctT='Apri Quadriamo dalla sua icona e tocca <b>Crea account</b>: nome e cognome, email, password. Ti arriva un <b>codice di 6 cifre</b> via email: scrivilo nell’app e l’account è attivo. Puoi anche usarla senza account: i dati restano solo su quel dispositivo.',
  setup='Imposta il budget', setupT='L’app ti guida passo passo: valuta, giorno dello stipendio, la tua regola (consigliata 55-20-15-10), categorie e pagamenti ricorrenti. Poi registri la prima spesa con <b>+</b>.',
  dev={
   'iphone': ('iPhone e iPad', 'Aprila sul telefono', 'Mettila nella schermata Home',
     '<p>Con <b>Safari</b>:</p><ol><li>tocca <b>Condividi</b> <kbd>⬆︎</kbd> (se non lo vedi, prima <kbd>⋯</kbd> in basso a destra);</li><li>scorri e tocca <b>Aggiungi alla schermata Home</b>;</li><li>tocca <b>Aggiungi</b>.</li></ol><p class="small muted">Con Chrome su iPhone: <kbd>⬆︎</kbd> in alto a destra → <b>Aggiungi alla schermata Home</b>.</p>'),
   'android': ('Android', 'Aprila sul telefono', 'Installala',
     '<p>Con <b>Chrome</b>: tocca <kbd>⋮</kbd> in alto a destra → <b>Installa app</b> → <b>Installa</b>.</p><p>Con <b>Samsung Internet</b>: tocca <kbd>≡</kbd> in basso a destra → <b>Aggiungi pagina a</b> → <b>Installa come applicazione Web</b>.</p><p class="small muted">Con altri browser cerca nel menu “Installa” o “Aggiungi a schermata Home”.</p>'),
   'mac': ('Mac', 'Aprila sul Mac', 'Installala come app',
     '<p>Con <b>Safari</b>: menu <b>File</b> → <b>Aggiungi al Dock…</b> → <b>Aggiungi</b>.</p><p>Con <b>Chrome</b>: clicca l’icona di installazione a destra nella barra degli indirizzi → <b>Installa</b>.</p><p class="small muted">Quadriamo si apre nella sua finestra: la trovi nel Dock e nel Launchpad, come le altre app.</p>'),
   'windows': ('Windows', 'Aprila sul PC', 'Installala come app',
     '<p>Con <b>Edge</b>: menu <kbd>⋯</kbd> → <b>App</b> → <b>Installa questo sito come app</b> → <b>Installa</b>.</p><p>Con <b>Chrome</b>: clicca l’icona di installazione a destra nella barra degli indirizzi → <b>Installa</b>.</p><p class="small muted">Quadriamo si apre nella sua finestra e compare nel menu Start: puoi fissarla sulla barra delle applicazioni.</p>'),
  }),
'en': dict(title='Download Quadriamo', back='← Back to the site', h1='Download Quadriamo',
  intro='Pick your device: each has its own steps. Quadriamo installs from the browser, no App Store: in a minute you have the icon and the full-screen app.',
  pick='Which device do you want it on?', open='Open Quadriamo', guide='Full guide',
  orLink='Or open this link on your phone (or send it to yourself):', copy='Copy link', copied='Copied ✓', phoneQr='Scan the code with your phone camera: Quadriamo opens.', phoneHere='You’re already on your phone: tap the button.',
  deskBtnHint='It opens in the browser with the steps to install it.', deskOnPhone='These steps are for a computer: open this page on your {os}.',
  acct='Create your account', acctT='Open Quadriamo from its icon and tap <b>Create account</b>: name, email, password. You get a <b>6-digit code</b> by email: type it in the app and your account is active. You can also use it without an account: your data stays on that device.',
  setup='Set up your budget', setupT='The app guides you step by step: currency, payday, your rule (suggested 55-20-15-10), categories and recurring payments. Then log your first expense with <b>+</b>.',
  dev={
   'iphone': ('iPhone and iPad', 'Open it on your phone', 'Add it to the Home Screen',
     '<p>In <b>Safari</b>:</p><ol><li>tap <b>Share</b> <kbd>⬆︎</kbd> (if you can’t see it, first <kbd>⋯</kbd> at the bottom right);</li><li>scroll and tap <b>Add to Home Screen</b>;</li><li>tap <b>Add</b>.</li></ol><p class="small muted">In Chrome on iPhone: <kbd>⬆︎</kbd> at the top right → <b>Add to Home Screen</b>.</p>'),
   'android': ('Android', 'Open it on your phone', 'Install it',
     '<p>In <b>Chrome</b>: tap <kbd>⋮</kbd> at the top right → <b>Install app</b> → <b>Install</b>.</p><p>In <b>Samsung Internet</b>: tap <kbd>≡</kbd> at the bottom right → <b>Add page to</b> → <b>Install as web app</b>.</p><p class="small muted">In other browsers look in the menu for “Install” or “Add to Home screen”.</p>'),
   'mac': ('Mac', 'Open it on your Mac', 'Install it as an app',
     '<p>In <b>Safari</b>: <b>File</b> menu → <b>Add to Dock…</b> → <b>Add</b>.</p><p>In <b>Chrome</b>: click the install icon on the right of the address bar → <b>Install</b>.</p><p class="small muted">Quadriamo opens in its own window: you’ll find it in the Dock and Launchpad, like other apps.</p>'),
   'windows': ('Windows', 'Open it on your PC', 'Install it as an app',
     '<p>In <b>Edge</b>: <kbd>⋯</kbd> menu → <b>Apps</b> → <b>Install this site as an app</b> → <b>Install</b>.</p><p>In <b>Chrome</b>: click the install icon on the right of the address bar → <b>Install</b>.</p><p class="small muted">Quadriamo opens in its own window and appears in the Start menu: you can pin it to the taskbar.</p>'),
  }),
'fr': dict(title='Télécharger Quadriamo', back='← Retour au site', h1='Télécharger Quadriamo',
  intro='Choisissez l’appareil : chacun a ses étapes. Quadriamo s’installe depuis le navigateur, sans App Store : en une minute vous avez l’icône et l’app en plein écran.',
  pick='Sur quel appareil la voulez-vous ?', open='Ouvrir Quadriamo', guide='Guide complet',
  orLink='Ou ouvrez ce lien sur le téléphone (ou envoyez-le-vous) :', copy='Copier le lien', copied='Copié ✓', phoneQr='Scannez le code avec l’appareil photo du téléphone : Quadriamo s’ouvre.', phoneHere='Vous êtes déjà sur le téléphone : touchez le bouton.',
  deskBtnHint='Elle s’ouvre dans le navigateur avec les étapes pour l’installer.', deskOnPhone='Ces étapes sont pour l’ordinateur : ouvrez cette page sur votre {os}.',
  acct='Créez votre compte', acctT='Ouvrez Quadriamo depuis son icône et touchez <b>Créer un compte</b> : nom, e-mail, mot de passe. Vous recevez un <b>code à 6 chiffres</b> par e-mail : saisissez-le dans l’app et le compte est actif. Vous pouvez aussi l’utiliser sans compte : les données restent sur cet appareil.',
  setup='Configurez votre budget', setupT='L’app vous guide pas à pas : devise, jour de paie, votre règle (conseillée 55-20-15-10), catégories et paiements récurrents. Puis notez votre première dépense avec <b>+</b>.',
  dev={
   'iphone': ('iPhone et iPad', 'Ouvrez-la sur le téléphone', 'Ajoutez-la à l’écran d’accueil',
     '<p>Avec <b>Safari</b> :</p><ol><li>touchez <b>Partager</b> <kbd>⬆︎</kbd> (sinon d’abord <kbd>⋯</kbd> en bas à droite) ;</li><li>faites défiler et touchez <b>Sur l’écran d’accueil</b> ;</li><li>touchez <b>Ajouter</b>.</li></ol><p class="small muted">Avec Chrome sur iPhone : <kbd>⬆︎</kbd> en haut à droite → <b>Sur l’écran d’accueil</b>.</p>'),
   'android': ('Android', 'Ouvrez-la sur le téléphone', 'Installez-la',
     '<p>Avec <b>Chrome</b> : touchez <kbd>⋮</kbd> en haut à droite → <b>Installer l’application</b> → <b>Installer</b>.</p><p>Avec <b>Samsung Internet</b> : touchez <kbd>≡</kbd> en bas à droite → <b>Ajouter la page à</b> → <b>Installer comme application Web</b>.</p><p class="small muted">Avec d’autres navigateurs, cherchez « Installer » ou « Ajouter à l’écran d’accueil » dans le menu.</p>'),
   'mac': ('Mac', 'Ouvrez-la sur le Mac', 'Installez-la comme une app',
     '<p>Avec <b>Safari</b> : menu <b>Fichier</b> → <b>Ajouter au Dock…</b> → <b>Ajouter</b>.</p><p>Avec <b>Chrome</b> : cliquez sur l’icône d’installation à droite de la barre d’adresse → <b>Installer</b>.</p><p class="small muted">Quadriamo s’ouvre dans sa fenêtre : vous la retrouvez dans le Dock et le Launchpad.</p>'),
   'windows': ('Windows', 'Ouvrez-la sur le PC', 'Installez-la comme une app',
     '<p>Avec <b>Edge</b> : menu <kbd>⋯</kbd> → <b>Applications</b> → <b>Installer ce site en tant qu’application</b> → <b>Installer</b>.</p><p>Avec <b>Chrome</b> : cliquez sur l’icône d’installation à droite de la barre d’adresse → <b>Installer</b>.</p><p class="small muted">Quadriamo s’ouvre dans sa fenêtre et apparaît dans le menu Démarrer : vous pouvez l’épingler à la barre des tâches.</p>'),
  }),
'es': dict(title='Descargar Quadriamo', back='← Volver a la web', h1='Descarga Quadriamo',
  intro='Elige el dispositivo: cada uno tiene sus pasos. Quadriamo se instala desde el navegador, sin App Store: en un minuto tienes el icono y la app a pantalla completa.',
  pick='¿En qué dispositivo la quieres?', open='Abrir Quadriamo', guide='Guía completa',
  orLink='O abre este enlace en el móvil (o envíatelo):', copy='Copiar enlace', copied='Copiado ✓', phoneQr='Escanea el código con la cámara del móvil: se abre Quadriamo.', phoneHere='Ya estás en el móvil: toca el botón.',
  deskBtnHint='Se abre en el navegador con los pasos para instalarla.', deskOnPhone='Estos pasos son para el ordenador: abre esta página desde tu {os}.',
  acct='Crea tu cuenta', acctT='Abre Quadriamo desde su icono y toca <b>Crear cuenta</b>: nombre, correo, contraseña. Te llega un <b>código de 6 cifras</b> por correo: escríbelo en la app y la cuenta queda activa. También puedes usarla sin cuenta: los datos se quedan en ese dispositivo.',
  setup='Configura tu presupuesto', setupT='La app te guía paso a paso: moneda, día de cobro, tu regla (recomendada 55-20-15-10), categorías y pagos recurrentes. Luego apuntas tu primer gasto con <b>+</b>.',
  dev={
   'iphone': ('iPhone y iPad', 'Ábrela en el móvil', 'Añádela a la pantalla de inicio',
     '<p>Con <b>Safari</b>:</p><ol><li>toca <b>Compartir</b> <kbd>⬆︎</kbd> (si no lo ves, primero <kbd>⋯</kbd> abajo a la derecha);</li><li>desliza y toca <b>Añadir a pantalla de inicio</b>;</li><li>toca <b>Añadir</b>.</li></ol><p class="small muted">Con Chrome en iPhone: <kbd>⬆︎</kbd> arriba a la derecha → <b>Añadir a pantalla de inicio</b>.</p>'),
   'android': ('Android', 'Ábrela en el móvil', 'Instálala',
     '<p>Con <b>Chrome</b>: toca <kbd>⋮</kbd> arriba a la derecha → <b>Instalar aplicación</b> → <b>Instalar</b>.</p><p>Con <b>Samsung Internet</b>: toca <kbd>≡</kbd> abajo a la derecha → <b>Añadir página a</b> → <b>Instalar como aplicación web</b>.</p><p class="small muted">Con otros navegadores busca en el menú “Instalar” o “Añadir a pantalla de inicio”.</p>'),
   'mac': ('Mac', 'Ábrela en el Mac', 'Instálala como app',
     '<p>Con <b>Safari</b>: menú <b>Archivo</b> → <b>Añadir al Dock…</b> → <b>Añadir</b>.</p><p>Con <b>Chrome</b>: haz clic en el icono de instalación a la derecha de la barra de direcciones → <b>Instalar</b>.</p><p class="small muted">Quadriamo se abre en su ventana: la encuentras en el Dock y en el Launchpad.</p>'),
   'windows': ('Windows', 'Ábrela en el PC', 'Instálala como app',
     '<p>Con <b>Edge</b>: menú <kbd>⋯</kbd> → <b>Aplicaciones</b> → <b>Instalar este sitio como una aplicación</b> → <b>Instalar</b>.</p><p>Con <b>Chrome</b>: haz clic en el icono de instalación a la derecha de la barra de direcciones → <b>Instalar</b>.</p><p class="small muted">Quadriamo se abre en su ventana y aparece en el menú Inicio: puedes anclarla a la barra de tareas.</p>'),
  }),
}
APP = 'https://carloludovicocapizzoto.github.io/quadriamo-app/app/'
DL = 'https://github.com/carloludovicocapizzoto/quadriamo-app/releases/latest/download/'
X = {'en': {'deskS3': 'Find it with your apps',
        'deskS3T': 'Quadriamo appears {where}, with its icon. It updates itself: new features arrive every time you open it and, when needed, the '
                   'app offers the new version.',
        'macBtnArm': 'Mac with Apple chip (M1, M2, M3, M4…)',
        'macBtnIntel': 'Mac with Intel processor',
        'macS1': 'Download the Mac app',
        'macS2': 'Drag it to Applications',
        'macS2T': 'Open the downloaded file: a window shows the Quadriamo icon and the Applications folder. Drag the icon onto the folder.',
        'macS3': 'Allow it the first time',
        'macS3T': 'Open Quadriamo from Applications. The first time macOS shows “Apple could not verify…”: press <b>Done</b>. Then open <b>System '
                  'Settings → Privacy &amp; Security</b> and scroll to <b>Security</b>: under “Allow applications from” you’ll see <b>“Quadriamo was '
                  'blocked…”</b> with an <b>Open Anyway</b> button. Press it, confirm with Touch ID or your password, and in the last prompt press '
                  '<b>Open Anyway</b> again. Only the first time. (On macOS 14 or earlier: right-click the app → <b>Open</b> → <b>Open</b>.)',
        'macWhich': 'Not sure? Menu  → <b>About This Mac</b>: if it says “Chip Apple”, pick the first.',
        'orBrowser': 'Rather not download anything? <a href="app/">Open it in the browser</a> and install it from there.',
        'size': 'about 130 MB',
        'tabletHow': '<p><b>iPad</b>, in Safari: tap <b>Share</b> <kbd>⬆︎</kbd> at the top right, next to the address → <b>Add to Home Screen</b> → '
                     '<b>Add</b>.</p><p><b>Android tablet</b>, in Chrome: <kbd>⋮</kbd> at the top right → <b>Install app</b> → <b>Install</b>.</p><p '
                     'class="small muted">On a tablet Quadriamo uses the whole screen, in landscape too.</p>',
        'tabletName': 'iPad and tablets',
        'tabletS1': 'Open it on your tablet',
        'tabletS2': 'Add it to the Home Screen',
        'whereMac': 'in Launchpad and the Applications folder (drag it to the Dock to keep it handy)',
        'whereWin': 'on the desktop and in the Start menu (you can pin it to the taskbar)',
        'winBtn': 'Download for Windows (64-bit)',
        'winS1': 'Download the Windows app',
        'winS2': 'Install it',
        'winS2T': 'Open the downloaded file. If “Windows protected your PC” appears, click <b>More info</b> and then <b>Run anyway</b>. Follow the '
                  'setup: you can choose the folder.'},
 'es': {'deskS3': 'La encuentras entre tus apps',
        'deskS3T': 'Quadriamo aparece {where}, con su icono. Se actualiza sola: las novedades llegan cada vez que la abres y, si hace falta, la app '
                   'te ofrece la nueva versión.',
        'macBtnArm': 'Mac con chip Apple (M1, M2, M3, M4…)',
        'macBtnIntel': 'Mac con procesador Intel',
        'macS1': 'Descarga la app para Mac',
        'macS2': 'Arrástrala a Aplicaciones',
        'macS2T': 'Abre el archivo descargado: aparece una ventana con el icono de Quadriamo y la carpeta Aplicaciones. Arrastra el icono a la '
                  'carpeta.',
        'macS3': 'Autorízala la primera vez',
        'macS3T': 'Abre Quadriamo desde Aplicaciones. La primera vez macOS muestra “Apple no ha podido verificar…”: pulsa <b>OK</b>. Luego '
                  '<b>Ajustes del Sistema → Privacidad y seguridad</b> y baja hasta <b>Seguridad</b>: bajo “Permitir aplicaciones de” aparece '
                  '<b>“Quadriamo ha sido bloqueada…”</b> con el botón <b>Abrir igualmente</b>. Púlsalo, confirma con Touch ID o contraseña y en el '
                  'último aviso pulsa otra vez <b>Abrir igualmente</b>. Solo la primera vez. (En macOS 14 o anterior: clic derecho en la app → '
                  '<b>Abrir</b> → <b>Abrir</b>.)',
        'macWhich': '¿No sabes cuál? Menú  → <b>Acerca de este Mac</b>: si pone “Chip Apple”, elige el primero.',
        'orBrowser': '¿Prefieres no descargar nada? <a href="app/">Ábrela en el navegador</a> e instálala desde ahí.',
        'size': 'unos 130 MB',
        'tabletHow': '<p><b>iPad</b>, con Safari: toca <b>Compartir</b> <kbd>⬆︎</kbd> arriba a la derecha, junto a la dirección → <b>Añadir a '
                     'pantalla de inicio</b> → <b>Añadir</b>.</p><p><b>Tablet Android</b>, con Chrome: <kbd>⋮</kbd> arriba a la derecha → '
                     '<b>Instalar aplicación</b> → <b>Instalar</b>.</p><p class="small muted">En la tablet Quadriamo usa toda la pantalla, también '
                     'en horizontal.</p>',
        'tabletName': 'iPad y tablets',
        'tabletS1': 'Ábrela en la tablet',
        'tabletS2': 'Añádela a la pantalla de inicio',
        'whereMac': 'en el Launchpad y en la carpeta Aplicaciones (arrástrala al Dock)',
        'whereWin': 'en el escritorio y en el menú Inicio (puedes anclarla a la barra de tareas)',
        'winBtn': 'Descargar para Windows (64 bits)',
        'winS1': 'Descarga la app para Windows',
        'winS2': 'Instálala',
        'winS2T': 'Abre el archivo descargado. Si aparece “Windows protegió su PC”, haz clic en <b>Más información</b> y luego en <b>Ejecutar de '
                  'todas formas</b>. Sigue la instalación.'},
 'fr': {'deskS3': 'Retrouvez-la avec vos apps',
        'deskS3T': 'Quadriamo apparaît {where}, avec son icône. Elle se met à jour toute seule : les nouveautés arrivent à chaque ouverture et, si '
                   'besoin, l’app propose la nouvelle version.',
        'macBtnArm': 'Mac avec puce Apple (M1, M2, M3, M4…)',
        'macBtnIntel': 'Mac avec processeur Intel',
        'macS1': 'Téléchargez l’app pour Mac',
        'macS2': 'Glissez-la dans Applications',
        'macS2T': 'Ouvrez le fichier téléchargé : une fenêtre montre l’icône de Quadriamo et le dossier Applications. Glissez l’icône sur le '
                  'dossier.',
        'macS3': 'Autorisez-la la première fois',
        'macS3T': 'Ouvrez Quadriamo depuis Applications. La première fois, macOS affiche « Apple n’a pas pu vérifier… » : touchez <b>Terminé</b>. '
                  'Puis <b>Réglages Système → Confidentialité et sécurité</b>, descendez jusqu’à <b>Sécurité</b> : sous « Autoriser les applications '
                  'de » apparaît <b>« Quadriamo a été bloquée… »</b> avec le bouton <b>Ouvrir quand même</b>. Cliquez, confirmez avec Touch ID ou le '
                  'mot de passe, puis encore <b>Ouvrir quand même</b>. Une seule fois. (Sur macOS 14 ou antérieur : clic droit sur l’app → '
                  '<b>Ouvrir</b> → <b>Ouvrir</b>.)',
        'macWhich': 'Vous ne savez pas ? Menu  → <b>À propos de ce Mac</b> : s’il est écrit « Puce Apple », choisissez le premier.',
        'orBrowser': 'Vous préférez ne rien télécharger ? <a href="app/">Ouvrez-la dans le navigateur</a> et installez-la de là.',
        'size': 'environ 130 Mo',
        'tabletHow': '<p><b>iPad</b>, avec Safari : touchez <b>Partager</b> <kbd>⬆︎</kbd> en haut à droite, près de l’adresse → <b>Sur l’écran '
                     'd’accueil</b> → <b>Ajouter</b>.</p><p><b>Tablette Android</b>, avec Chrome : <kbd>⋮</kbd> en haut à droite → <b>Installer '
                     'l’application</b> → <b>Installer</b>.</p><p class="small muted">Sur tablette, Quadriamo utilise tout l’écran, même à '
                     'l’horizontale.</p>',
        'tabletName': 'iPad et tablettes',
        'tabletS1': 'Ouvrez-la sur la tablette',
        'tabletS2': 'Ajoutez-la à l’écran d’accueil',
        'whereMac': 'dans le Launchpad et le dossier Applications (glissez-la dans le Dock)',
        'whereWin': 'sur le bureau et dans le menu Démarrer (épinglez-la à la barre des tâches)',
        'winBtn': 'Télécharger pour Windows (64 bits)',
        'winS1': 'Téléchargez l’app pour Windows',
        'winS2': 'Installez-la',
        'winS2T': 'Ouvrez le fichier téléchargé. Si « Windows a protégé votre ordinateur » apparaît, cliquez sur <b>Informations complémentaires</b> '
                  'puis <b>Exécuter quand même</b>. Suivez l’installation.'},
 'it': {'deskS3': 'La trovi tra le tue app',
        'deskS3T': 'Quadriamo compare {where}, con la sua icona. Si aggiorna da sola: le novità arrivano a ogni apertura e, quando serve, l’app ti '
                   'propone la nuova versione.',
        'macBtnArm': 'Mac con chip Apple (M1, M2, M3, M4…)',
        'macBtnIntel': 'Mac con processore Intel',
        'macS1': 'Scarica l’app per Mac',
        'macS2': 'Trascinala in Applicazioni',
        'macS2T': 'Apri il file scaricato: si apre una finestra con l’icona di Quadriamo e la cartella Applicazioni. Trascina l’icona sulla '
                  'cartella.',
        'macS3': 'Autorizzala la prima volta',
        'macS3T': 'Apri Quadriamo da Applicazioni. La prima volta macOS mostra “Apple non può verificare…”: premi <b>Fine</b>. Poi apri '
                  '<b>Impostazioni di Sistema → Privacy e sicurezza</b> e scorri fino a <b>Sicurezza</b>: sotto “Consenti applicazioni da” compare '
                  '<b>“Quadriamo è stata bloccata…”</b> con il pulsante <b>Apri comunque</b>. Premilo, conferma con Touch ID o password e '
                  'nell’ultimo avviso premi ancora <b>Apri comunque</b>. Serve solo la prima volta. (Su macOS 14 o precedenti basta: tasto destro '
                  'sull’app → <b>Apri</b> → <b>Apri</b>.)',
        'macWhich': 'Non sai quale? Menu  → <b>Informazioni su questo Mac</b>: se c’è scritto “Chip Apple” scegli il primo.',
        'orBrowser': 'Preferisci senza scaricare niente? <a href="app/">Aprila nel browser</a> e installala da lì.',
        'size': 'circa 130 MB',
        'tabletHow': '<p><b>iPad</b>, con Safari: tocca <b>Condividi</b> <kbd>⬆︎</kbd> in alto a destra, accanto all’indirizzo → <b>Aggiungi alla '
                     'schermata Home</b> → <b>Aggiungi</b>.</p><p><b>Tablet Android</b>, con Chrome: <kbd>⋮</kbd> in alto a destra → <b>Installa '
                     'app</b> → <b>Installa</b>.</p><p class="small muted">Sul tablet Quadriamo usa tutto lo schermo, anche in orizzontale.</p>',
        'tabletName': 'iPad e tablet',
        'tabletS1': 'Aprila sul tablet',
        'tabletS2': 'Mettila nella schermata Home',
        'whereMac': 'nel Launchpad e nella cartella Applicazioni (trascinala nel Dock per averla sempre a portata)',
        'whereWin': 'sul desktop e nel menu Start (puoi fissarla sulla barra delle applicazioni)',
        'winBtn': 'Scarica per Windows (64 bit)',
        'winS1': 'Scarica l’app per Windows',
        'winS2': 'Installala',
        'winS2T': 'Apri il file scaricato. Se compare “Windows ha protetto il PC”, clicca <b>Ulteriori informazioni</b> e poi <b>Esegui '
                  'comunque</b>. Segui l’installazione: puoi scegliere la cartella.'}}
ICON = {'iphone': '📱', 'tablet': '📲', 'android': '🤖', 'mac': '💻', 'windows': '🪟'}
LABEL = {'iphone': 'iPhone', 'tablet': 'Tablet', 'android': 'Android', 'mac': 'Mac', 'windows': 'Windows'}
OSNAME = {'mac': 'Mac', 'windows': 'PC'}

def panel(l, d, dev):
    x = X[l]
    if dev == 'tablet':
        name, s1, s2, howto = x['tabletName'], x['tabletS1'], x['tabletS2'], x['tabletHow']
    else:
        name, s1, s2, howto = d['dev'][dev]
    phone = dev in ('iphone', 'android', 'tablet')
    if dev in ('mac', 'windows'):
        if dev == 'mac':
            dl = f'''<p class="dl-btns"><a class="btn big" href="{DL}Quadriamo-Mac-arm64.dmg">⤓ {x['macBtnArm']}</a>
            <a class="btn big btn-alt" href="{DL}Quadriamo-Mac-x64.dmg">⤓ {x['macBtnIntel']}</a></p><p class="small muted">{x['macWhich']} · {x['size']}</p>'''
            steps = [(x['macS1'], dl), (x['macS2'], f"<p>{x['macS2T']}</p>"), (x['macS3'], f"<p>{x['macS3T']}</p>"),
                     (x['deskS3'], f"<p>{x['deskS3T'].format(where=x['whereMac'])}</p>")]
        else:
            dl = f'''<p class="dl-btns"><a class="btn big" href="{DL}Quadriamo-Windows-Setup.exe">⤓ {x['winBtn']}</a></p><p class="small muted">{x['size']}</p>'''
            steps = [(x['winS1'], dl), (x['winS2'], f"<p>{x['winS2T']}</p>"), (x['deskS3'], f"<p>{x['deskS3T'].format(where=x['whereWin'])}</p>")]
        steps += [(d['acct'], f"<p>{d['acctT']}</p>"), (d['setup'], f"<p>{d['setupT']}</p>")]
        lis = ''.join(f'''
        <li class="step"><span class="n">{i}</span><div><h3>{t}</h3>{body}</div></li>''' for i, (t, body) in enumerate(steps, 1))
        return f'''
    <div class="dev-panel" data-dev="{dev}" role="tabpanel">
      <h2>{name}</h2>
      <p class="phone-only muted">{d['deskOnPhone'].format(os=OSNAME[dev])}</p>
      <ol class="journey">{lis}
      </ol>
      <p class="small muted">{x['orBrowser']}</p>
    </div>'''
    if phone:
        first = f'''<div class="desk-only qr-big"><img src="qr.svg" alt="QR" width="220" height="220"><div><p>{d['phoneQr']}</p>
            <p class="small muted">{d['orLink']}</p>
            <p class="app-link"><a href="{APP}">{APP.replace('https://', '')}</a> <button type="button" class="copy-link" data-url="{APP}" data-done="{d['copied']}">{d['copy']}</button></p></div></div>
          <div class="phone-only"><p>{d['phoneHere']}</p><p><a class="btn big" href="app/">{d['open']} →</a></p></div>'''
    else:
        first = f'''<div class="desk-only"><p><a class="btn big" href="app/">{d['open']} →</a></p><p class="small muted">{d['deskBtnHint']}</p></div>
          <p class="phone-only muted">{d['deskOnPhone'].format(os=OSNAME[dev])}</p>'''
    steps = [(s1, first), (s2, howto), (d['acct'], f"<p>{d['acctT']}</p>"), (d['setup'], f"<p>{d['setupT']}</p>")]
    lis = ''.join(f'''
        <li class="step"><span class="n">{i}</span><div><h3>{t}</h3>{body}</div></li>''' for i, (t, body) in enumerate(steps, 1))
    return f'''
    <div class="dev-panel" data-dev="{dev}" role="tabpanel">
      <h2>{name}</h2>
      <ol class="journey">{lis}
      </ol>
    </div>'''

sections = []
for l, d in T.items():
    switch = ''.join(f'<button type="button" role="tab" data-dev="{k}"><span aria-hidden="true">{ICON[k]}</span>{LABEL[k]}</button>' for k in ICON)
    sections.append(f'''  <section data-lang="{l}">
    <p class="small"><a href="./?lang={l}">{d['back']}</a></p>
    <h1>{d['h1']}</h1>
    <p class="muted">{d['intro']}</p>
    <p class="pick">{d['pick']}</p>
    <div class="dev-switch" role="tablist">{switch}</div>
    {''.join(panel(l, d, k) for k in ICON)}
    <p class="small muted guide-link"><a href="install.html?lang={l}">{d['guide']}</a></p>
  </section>''')

html = '''<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>Scarica Quadriamo</title>
  <meta name="description" content="Scarica Quadriamo su iPhone, Android, Mac o Windows: i passaggi per ogni dispositivo.">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="stylesheet" href="pages.css">
  <style>
    .pick { font-weight: 600; margin: 22px 0 8px; }
    .dev-switch { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 6px; }
    .dev-switch button { font: inherit; font-weight: 600; color: var(--text); background: none; border: 0; border-radius: 12px; min-height: 52px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px; transition: background .2s, color .2s; }
    .dev-switch button span { font-size: 20px; }
    .dev-switch button[aria-selected="true"] { background: var(--accent); color: #fff; }
    @media (max-width: 700px) { .dev-switch { grid-template-columns: repeat(3, 1fr); } .dev-switch button { font-size: 15px; } }
    .dl-btns { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn-alt { background: var(--surface); color: var(--text); border: 1.5px solid var(--line); }
    .dev-panel { display: none; animation: fade .35s ease both; }
    .dev-panel.on { display: block; }
    @keyframes fade { from { opacity: 0; transform: translateY(8px); } }
    .dev-panel h2 { margin: 26px 0 0; }
    .journey { list-style: none; padding: 0; margin: 14px 0 0; display: grid; gap: 14px; }
    .step { display: grid; grid-template-columns: 48px 1fr; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 20px; margin: 0; }
    .step .n { width: 48px; height: 48px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center;
      font-family: "DM Serif Display", Georgia, serif; font-size: 24px; }
    .step h3 { margin: 8px 0 6px; font-size: 20px; }
    .step p { margin: 6px 0; }
    .step ol { margin: 4px 0; }
    .step > div { min-width: 0; }
    .qr-big { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .qr-big img { width: 220px; height: 220px; background: #fff; border-radius: 16px; padding: 10px; border: 1px solid var(--line); }
    .qr-big > div { flex: 1; min-width: 220px; }
    .qr-big p { font-size: 18px; margin: 6px 0; }
    .qr-big p.small { font-size: 15px; }
    .app-link { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 16px !important; }
    .app-link a { font-weight: 600; word-break: break-all; }
    .copy-link { font: inherit; font-size: 14px; font-weight: 600; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 99px; padding: 6px 14px; cursor: pointer; }
    .phone-only { display: none; }
    @media (max-width: 760px), (hover: none) and (pointer: coarse) { .desk-only { display: none; } .phone-only { display: block; } }
    @media (max-width: 600px) { .step { grid-template-columns: 1fr; gap: 6px; padding: 16px; } .step .n { width: 40px; height: 40px; font-size: 20px; } }
    .btn.big { min-height: 56px; font-size: 18px; padding: 0 28px; }
    .guide-link { margin-top: 24px; }
    @media (prefers-reduced-motion: reduce) { .dev-panel { animation: none; } }
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="logo" href="./">Quadriamo<span>.</span></a>
    <nav class="langs" aria-label="Lingua / Language">
      <button data-set="it">Italiano</button><button data-set="en">English</button><button data-set="fr">Français</button><button data-set="es">Español</button>
    </nav>
  </header>

''' + '\n\n'.join(sections) + '''

  <footer><a href="privacy.html">Privacy</a> · <a href="terms.html">Termini / Terms</a> · <a href="notizie/">Notizie / News</a> · <a href="blog.html">Blog</a> · <a href="roadmap.html">Roadmap</a></footer>
</div>
<script src="pages.js"></script>
</body>
</html>
'''
open(out, 'w').write(html)
print('ok')
