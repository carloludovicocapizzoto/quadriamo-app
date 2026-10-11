// Home del sito: testi nelle 4 lingue (stessa scelta di lingua dell'app: ?lang=, scelta salvata, lingua del browser).
(function () {
  var T = {
    it: {
      'page.title': 'Quadriamo — I tuoi soldi, in quattro',
      'nav.how': 'Come funziona', 'nav.features': 'Funzioni', 'nav.pricing': 'Prezzi', 'nav.faq': 'Domande', 'nav.login': 'Accedi o registrati', 'nav.open': 'Apri l’app',
      'hero.eyebrow': 'Budget personale · Beta gratuita',
      'hero.title': 'I tuoi soldi, <em>in quattro.</em>',
      'hero.lead': 'Dividi lo stipendio in 4 parti con la regola 55-20-15-10. Il resto lo fa l’app.',
      'hero.cta': 'Prova gratis la beta', 'hero.install': 'Installala sul telefono',
      'hero.note': 'Nessun account necessario · Funziona offline · Dati nell’Unione europea',
      'hero.b1': 'Ogni giorno sai quanto puoi ancora spendere', 'hero.b2': 'Registri una spesa in 5 secondi, o importi l’estratto conto', 'hero.b3': 'Risparmi e investimenti crescono da soli, mese dopo mese', 'hero.qrT': 'Inquadra e aprila sul telefono', 'hero.qr': 'Si installa dal browser in 30 secondi, senza App Store.', 'feat.more': 'Scopri cosa fa ogni funzione', 'feat.close': 'Chiudi',
      'mock.safe': 'Oggi puoi spendere', 'mock.perDay1': '24,80 € al giorno', 'mock.perDay2': '13,10 € al giorno',
      'b.essentials': 'Essenziali', 'b.qualityOfLife': 'Qualità della vita', 'b.safetyFund': 'Fondo di sicurezza', 'b.investments': 'Investimenti',
      'rule.title': 'Un metodo semplice: ogni euro ha un compito',
      'rule.text': 'La 55-20-15-10 è la divisione che consigliamo, ma la regola la scegli tu: cambi le percentuali quando vuoi.',
      'rule.e': 'Affitto, spesa, bollette, trasporti', 'rule.q': 'Uscite, hobby, viaggi, regali', 'rule.s': 'Il cuscinetto per gli imprevisti', 'rule.i': 'Il tuo futuro: ETF, PAC',
      'how.title': 'Come funziona',
      'how.1t': 'Scegli la tua regola', 'how.1': 'Parti dalla 55-20-15-10 o imposta le tue quote. Le entrate si dividono da sole.',
      'how.2t': 'Registra o importa', 'how.2': 'Una spesa in 5 secondi dal telefono, oppure importi l’estratto conto: le regole riconoscono i negozi e smistano tutto.',
      'how.3t': 'Sai quanto puoi spendere', 'how.3': 'Ogni giorno vedi quanto puoi ancora spendere per ogni parte. Quello che avanza passa al mese dopo.',
      'feat.title': 'Le funzioni, in breve',
      'feat.safeT': 'Oggi puoi spendere', 'feat.safe': 'Un numero chiaro al giorno per ogni parte, tenendo da parte le bollette in arrivo.',
      'feat.payT': 'Giorno di paga', 'feat.pay': 'Ti dice quanto spostare in ogni pocket (Revolut, Trade Republic…) e lo spunti.',
      'feat.importT': 'Import e regole', 'feat.import': 'Importi l’estratto conto, le parole chiave smistano le spese. Tu confermi o cambi, e l’app impara.',
      'feat.carryT': 'Avanzi che restano', 'feat.carry': 'Quello che non spendi in una parte passa al mese successivo, anno dopo anno.',
      'feat.yearT': 'Anno e negli anni', 'feat.year': 'Grafico mese per mese, tasso di risparmio, confronto tra gli anni.',
      'feat.invT': 'Investimenti e PAC', 'feat.inv': 'Portafoglio, conti deposito e piano di accumulo nello stesso posto del budget.',
      'feat.fxT': 'Più valute', 'feat.fx': 'Spese in dollari o sterline convertite con i cambi della BCE del giorno.',
      'feat.fastT': 'Veloce ovunque', 'feat.fast': 'Si installa sul telefono, funziona offline e si sincronizza con il computer.',
      'priv.title': 'I tuoi soldi sono affari tuoi',
      'priv.text': 'Quadriamo funziona anche senza account: i dati restano sul tuo dispositivo. Se vuoi sincronizzare, la copia sta su server nell’Unione europea.',
      'priv.1': 'Niente pubblicità, niente vendita di dati', 'priv.2': 'Non serve collegare la banca', 'priv.3': 'Esporti o cancelli tutto quando vuoi', 'priv.4': 'Server nell’UE, connessioni cifrate',
      'dl.title': 'Scarica l’app', 'dl.text': 'Quadriamo si installa dal browser in 30 secondi, senza App Store né Play Store.',
      'dl.ios1': 'Apri il link con Safari', 'dl.ios2': 'Tocca Condividi ⬆︎', 'dl.ios3': 'Scegli “Aggiungi alla schermata Home”',
      'dl.and1': 'Apri il link con Chrome', 'dl.and2': 'Tocca Installa, oppure il menu ⋮', 'dl.and3': 'Scegli “Installa app”',
      'dl.qr': 'Sei al computer? Inquadra il codice con il telefono.', 'dl.guide': 'Guida completa',
      'acc.title': 'La tua area personale', 'acc.text': 'Accedi per avere gli stessi dati su telefono e computer, sempre aggiornati.',
      'acc.1': 'Nessuna password: ti arriva un link via email', 'acc.2': 'Sincronizzazione automatica tra dispositivi', 'acc.3': 'Elimini l’account quando vuoi, con un tocco',
      'acc.cardT': 'Accedi o crea un account', 'acc.card': 'Crea un account con nome, cognome, email e password (oppure accedi se ce l’hai già). Poi, se vuoi, completa il profilo: entrate, obiettivi e come dividere i soldi.',
      'acc.noAccount': 'Oppure usala senza account →',
      'price.title': 'Prezzi',
      'price.betaT': 'Beta', 'price.betaP': 'Gratis', 'price.beta': 'Tutte le funzioni durante la beta. In cambio, ci aiuti con il tuo parere.',
      'price.proT': 'Pro', 'price.proP': 'In arrivo', 'price.pro': 'Un piano facoltativo per le funzioni più avanzate, con un prezzo speciale per chi ha provato la beta.',
      'faq.title': 'Domande frequenti',
      'faq.q1': 'È sicuro?', 'faq.a1': 'Senza account i dati restano solo sul tuo dispositivo. Con l’account, ogni utente può vedere solo i propri dati, su server nell’UE e con connessioni cifrate.',
      'faq.q2': 'Devo collegare il conto in banca?', 'faq.a2': 'No. Registri le spese a mano in pochi secondi oppure importi l’estratto conto in CSV.',
      'faq.q3': 'Funziona senza internet?', 'faq.a3': 'Sì. Una volta installata funziona offline; quando torni online si sincronizza.',
      'faq.q4': 'Posso cambiare le percentuali?', 'faq.a4': 'Certo: la 55-20-15-10 è quella consigliata, ma puoi impostare la regola che preferisci, purché faccia 100%.',
      'faq.q5': 'Quanto costa?', 'faq.a5': 'Durante la beta è gratis. Più avanti ci sarà un piano Pro facoltativo; la versione gratuita resterà.',
      'faq.q6': 'È una consulenza finanziaria?', 'faq.a6': 'No: Quadriamo è uno strumento per organizzare il budget. Le decisioni sui tuoi soldi restano tue.',
      'foot.tag': 'I tuoi soldi, in quattro.', 'foot.privacy': 'Privacy', 'foot.terms': 'Termini d’uso',
      'foot.legal': '© 2026 Quadriamo · Strumento per il budget, non consulenza finanziaria.'
    },
    en: {
      'page.title': 'Quadriamo — Your money, in four',
      'nav.how': 'How it works', 'nav.features': 'Features', 'nav.pricing': 'Pricing', 'nav.faq': 'FAQ', 'nav.login': 'Sign in or sign up', 'nav.open': 'Open the app',
      'hero.eyebrow': 'Personal budget · Free beta',
      'hero.title': 'Your money, <em>in four.</em>',
      'hero.lead': 'Split your salary into 4 parts with the 55-20-15-10 rule. The app does the rest.',
      'hero.cta': 'Try the beta for free', 'hero.install': 'Install it on your phone',
      'hero.note': 'No account needed · Works offline · Data in the European Union',
      'hero.b1': 'Every day you know how much you can still spend', 'hero.b2': 'Log an expense in 5 seconds, or import your bank statement', 'hero.b3': 'Savings and investments grow on their own, month after month', 'hero.qrT': 'Scan to open it on your phone', 'hero.qr': 'Installs from the browser in 30 seconds, no App Store.', 'feat.more': 'See what each feature does', 'feat.close': 'Close',
      'mock.safe': 'You can spend today', 'mock.perDay1': '€24.80 a day', 'mock.perDay2': '€13.10 a day',
      'b.essentials': 'Essentials', 'b.qualityOfLife': 'Quality of Life', 'b.safetyFund': 'Safety Fund', 'b.investments': 'Investments',
      'rule.title': 'A simple method: every euro has a job',
      'rule.text': '55-20-15-10 is the split we recommend, but the rule is yours: change the percentages whenever you like.',
      'rule.e': 'Rent, groceries, bills, transport', 'rule.q': 'Going out, hobbies, travel, gifts', 'rule.s': 'Your cushion for the unexpected', 'rule.i': 'Your future: ETFs, monthly plans',
      'how.title': 'How it works',
      'how.1t': 'Choose your rule', 'how.1': 'Start from 55-20-15-10 or set your own shares. Income splits itself.',
      'how.2t': 'Log or import', 'how.2': 'An expense in 5 seconds from your phone, or import your bank statement: rules recognise shops and sort everything.',
      'how.3t': 'Know what you can spend', 'how.3': 'Every day you see how much you can still spend in each part. What is left rolls into next month.',
      'feat.title': 'Features at a glance',
      'feat.safeT': 'You can spend today', 'feat.safe': 'One clear daily number for each part, keeping aside the bills still to come.',
      'feat.payT': 'Payday plan', 'feat.pay': 'Tells you how much to move into each pocket (Revolut, Trade Republic…) and you tick it off.',
      'feat.importT': 'Import and rules', 'feat.import': 'Import your statement, keywords sort the expenses. You confirm or change, and the app learns.',
      'feat.carryT': 'Leftovers that stay', 'feat.carry': 'What you don’t spend in a part rolls into the next month, year after year.',
      'feat.yearT': 'Year and over the years', 'feat.year': 'Month-by-month chart, savings rate, comparison between years.',
      'feat.invT': 'Investments and plans', 'feat.inv': 'Portfolio, deposit accounts and monthly investment plan next to your budget.',
      'feat.fxT': 'Multiple currencies', 'feat.fx': 'Spending in dollars or pounds converted with the day’s ECB rates.',
      'feat.fastT': 'Fast everywhere', 'feat.fast': 'Installs on your phone, works offline and syncs with your computer.',
      'priv.title': 'Your money is your business',
      'priv.text': 'Quadriamo works without an account too: your data stays on your device. If you want to sync, the copy lives on servers in the European Union.',
      'priv.1': 'No ads, no selling of data', 'priv.2': 'No need to connect your bank', 'priv.3': 'Export or delete everything whenever you want', 'priv.4': 'EU servers, encrypted connections',
      'dl.title': 'Get the app', 'dl.text': 'Quadriamo installs from your browser in 30 seconds, no App Store or Play Store.',
      'dl.ios1': 'Open the link in Safari', 'dl.ios2': 'Tap Share ⬆︎', 'dl.ios3': 'Choose “Add to Home Screen”',
      'dl.and1': 'Open the link in Chrome', 'dl.and2': 'Tap Install, or the ⋮ menu', 'dl.and3': 'Choose “Install app”',
      'dl.qr': 'On a computer? Scan the code with your phone.', 'dl.guide': 'Full guide',
      'acc.title': 'Your personal area', 'acc.text': 'Sign in to have the same data on phone and computer, always up to date.',
      'acc.1': 'No password: you get a link by email', 'acc.2': 'Automatic sync between devices', 'acc.3': 'Delete your account whenever you want, in one tap',
      'acc.cardT': 'Sign in or create an account', 'acc.card': 'Create an account with first name, last name, email and password (or sign in if you already have one). Then, if you like, complete your profile: income, goals and how to split your money.',
      'acc.noAccount': 'Or use it without an account →',
      'price.title': 'Pricing',
      'price.betaT': 'Beta', 'price.betaP': 'Free', 'price.beta': 'All features during the beta. In return, you help us with your feedback.',
      'price.proT': 'Pro', 'price.proP': 'Coming soon', 'price.pro': 'An optional plan for advanced features, with a special price for beta testers.',
      'faq.title': 'Frequently asked questions',
      'faq.q1': 'Is it safe?', 'faq.a1': 'Without an account your data only stays on your device. With an account, each user can only see their own data, on EU servers with encrypted connections.',
      'faq.q2': 'Do I need to connect my bank account?', 'faq.a2': 'No. Log expenses by hand in seconds or import your bank statement as CSV.',
      'faq.q3': 'Does it work offline?', 'faq.a3': 'Yes. Once installed it works offline; it syncs when you are back online.',
      'faq.q4': 'Can I change the percentages?', 'faq.a4': 'Of course: 55-20-15-10 is the recommended split, but you can set any rule you like, as long as it adds up to 100%.',
      'faq.q5': 'How much does it cost?', 'faq.a5': 'It is free during the beta. Later there will be an optional Pro plan; the free version will stay.',
      'faq.q6': 'Is it financial advice?', 'faq.a6': 'No: Quadriamo is a tool to organise your budget. Decisions about your money remain yours.',
      'foot.tag': 'Your money, in four.', 'foot.privacy': 'Privacy', 'foot.terms': 'Terms of use',
      'foot.legal': '© 2026 Quadriamo · A budgeting tool, not financial advice.'
    },
    fr: {
      'page.title': 'Quadriamo — Votre argent, en quatre',
      'nav.how': 'Fonctionnement', 'nav.features': 'Fonctions', 'nav.pricing': 'Prix', 'nav.faq': 'Questions', 'nav.login': 'Connexion / inscription', 'nav.open': 'Ouvrir l’app',
      'hero.eyebrow': 'Budget personnel · Bêta gratuite',
      'hero.title': 'Votre argent, <em>en quatre.</em>',
      'hero.lead': 'Divisez votre salaire en 4 parts avec la règle 55-20-15-10. L’app fait le reste.',
      'hero.cta': 'Essayer la bêta gratuitement', 'hero.install': 'L’installer sur le téléphone',
      'hero.note': 'Sans compte · Fonctionne hors ligne · Données dans l’Union européenne',
      'hero.b1': 'Chaque jour, vous savez combien vous pouvez encore dépenser', 'hero.b2': 'Une dépense notée en 5 secondes, ou l’import du relevé bancaire', 'hero.b3': 'Épargne et investissements grandissent tout seuls, mois après mois', 'hero.qrT': 'Scannez pour l’ouvrir sur le téléphone', 'hero.qr': 'S’installe depuis le navigateur en 30 secondes, sans App Store.', 'feat.more': 'Voir ce que fait chaque fonction', 'feat.close': 'Fermer',
      'mock.safe': 'Vous pouvez dépenser aujourd’hui', 'mock.perDay1': '24,80 € par jour', 'mock.perDay2': '13,10 € par jour',
      'b.essentials': 'Essentiels', 'b.qualityOfLife': 'Qualité de vie', 'b.safetyFund': 'Fonds de sécurité', 'b.investments': 'Investissements',
      'rule.title': 'Une méthode simple : chaque euro a une mission',
      'rule.text': 'Le 55-20-15-10 est la répartition que nous conseillons, mais la règle est la vôtre : changez les pourcentages quand vous voulez.',
      'rule.e': 'Loyer, courses, factures, transports', 'rule.q': 'Sorties, loisirs, voyages, cadeaux', 'rule.s': 'Le coussin pour les imprévus', 'rule.i': 'Votre avenir : ETF, plans d’épargne',
      'how.title': 'Comment ça marche',
      'how.1t': 'Choisissez votre règle', 'how.1': 'Partez du 55-20-15-10 ou fixez vos parts. Les revenus se répartissent tout seuls.',
      'how.2t': 'Saisissez ou importez', 'how.2': 'Une dépense en 5 secondes depuis le téléphone, ou importez votre relevé : les règles reconnaissent les magasins et trient tout.',
      'how.3t': 'Sachez ce que vous pouvez dépenser', 'how.3': 'Chaque jour, vous voyez ce qu’il reste à dépenser dans chaque part. Le reste passe au mois suivant.',
      'feat.title': 'Les fonctions en bref',
      'feat.safeT': 'Dépensable aujourd’hui', 'feat.safe': 'Un chiffre clair par jour pour chaque part, en gardant de côté les factures à venir.',
      'feat.payT': 'Jour de paie', 'feat.pay': 'Indique combien placer dans chaque espace (Revolut, Trade Republic…) et vous cochez.',
      'feat.importT': 'Import et règles', 'feat.import': 'Importez votre relevé, les mots-clés trient les dépenses. Vous confirmez ou modifiez, l’app apprend.',
      'feat.carryT': 'Les restes restent', 'feat.carry': 'Ce que vous ne dépensez pas dans une part passe au mois suivant, année après année.',
      'feat.yearT': 'L’année et les années', 'feat.year': 'Graphique mois par mois, taux d’épargne, comparaison entre années.',
      'feat.invT': 'Investissements', 'feat.inv': 'Portefeuille, comptes d’épargne et plan d’investissement à côté du budget.',
      'feat.fxT': 'Plusieurs devises', 'feat.fx': 'Dépenses en dollars ou en livres converties au taux BCE du jour.',
      'feat.fastT': 'Rapide partout', 'feat.fast': 'S’installe sur le téléphone, fonctionne hors ligne et se synchronise avec l’ordinateur.',
      'priv.title': 'Votre argent ne regarde que vous',
      'priv.text': 'Quadriamo fonctionne aussi sans compte : vos données restent sur votre appareil. Pour synchroniser, la copie est sur des serveurs dans l’Union européenne.',
      'priv.1': 'Pas de publicité, pas de revente de données', 'priv.2': 'Pas besoin de connecter la banque', 'priv.3': 'Exportez ou supprimez tout quand vous voulez', 'priv.4': 'Serveurs dans l’UE, connexions chiffrées',
      'dl.title': 'Télécharger l’app', 'dl.text': 'Quadriamo s’installe depuis le navigateur en 30 secondes, sans App Store ni Play Store.',
      'dl.ios1': 'Ouvrez le lien avec Safari', 'dl.ios2': 'Touchez Partager ⬆︎', 'dl.ios3': 'Choisissez « Sur l’écran d’accueil »',
      'dl.and1': 'Ouvrez le lien avec Chrome', 'dl.and2': 'Touchez Installer, ou le menu ⋮', 'dl.and3': 'Choisissez « Installer l’application »',
      'dl.qr': 'Sur ordinateur ? Scannez le code avec le téléphone.', 'dl.guide': 'Guide complet',
      'acc.title': 'Votre espace personnel', 'acc.text': 'Connectez-vous pour retrouver les mêmes données sur téléphone et ordinateur.',
      'acc.1': 'Pas de mot de passe : un lien par e-mail', 'acc.2': 'Synchronisation automatique', 'acc.3': 'Supprimez votre compte quand vous voulez',
      'acc.cardT': 'Se connecter ou créer un compte', 'acc.card': 'Créez un compte avec prénom, nom, e-mail et mot de passe (ou connectez-vous si vous en avez déjà un). Ensuite, si vous voulez, complétez votre profil : revenus, objectifs et répartition de votre argent.',
      'acc.noAccount': 'Ou utilisez-la sans compte →',
      'price.title': 'Prix',
      'price.betaT': 'Bêta', 'price.betaP': 'Gratuit', 'price.beta': 'Toutes les fonctions pendant la bêta. En échange, aidez-nous avec votre avis.',
      'price.proT': 'Pro', 'price.proP': 'Bientôt', 'price.pro': 'Une offre facultative pour les fonctions avancées, à prix spécial pour les testeurs de la bêta.',
      'faq.title': 'Questions fréquentes',
      'faq.q1': 'Est-ce sûr ?', 'faq.a1': 'Sans compte, vos données restent sur votre appareil. Avec un compte, chacun ne voit que ses données, sur des serveurs dans l’UE avec connexions chiffrées.',
      'faq.q2': 'Dois-je connecter mon compte bancaire ?', 'faq.a2': 'Non. Saisissez vos dépenses en quelques secondes ou importez votre relevé CSV.',
      'faq.q3': 'Fonctionne-t-elle hors ligne ?', 'faq.a3': 'Oui. Une fois installée, elle fonctionne hors ligne et se synchronise au retour de la connexion.',
      'faq.q4': 'Puis-je changer les pourcentages ?', 'faq.a4': 'Bien sûr : le 55-20-15-10 est conseillé, mais vous pouvez choisir votre règle, tant qu’elle fait 100 %.',
      'faq.q5': 'Combien ça coûte ?', 'faq.a5': 'C’est gratuit pendant la bêta. Plus tard, une offre Pro facultative ; la version gratuite restera.',
      'faq.q6': 'Est-ce un conseil financier ?', 'faq.a6': 'Non : Quadriamo est un outil pour organiser votre budget. Les décisions restent les vôtres.',
      'foot.tag': 'Votre argent, en quatre.', 'foot.privacy': 'Confidentialité', 'foot.terms': 'Conditions',
      'foot.legal': '© 2026 Quadriamo · Outil de budget, pas un conseil financier.'
    },
    es: {
      'page.title': 'Quadriamo — Tu dinero, en cuatro',
      'nav.how': 'Cómo funciona', 'nav.features': 'Funciones', 'nav.pricing': 'Precios', 'nav.faq': 'Preguntas', 'nav.login': 'Entrar o registrarse', 'nav.open': 'Abrir la app',
      'hero.eyebrow': 'Presupuesto personal · Beta gratuita',
      'hero.title': 'Tu dinero, <em>en cuatro.</em>',
      'hero.lead': 'Divide tu sueldo en 4 partes con la regla 55-20-15-10. La app hace el resto.',
      'hero.cta': 'Prueba la beta gratis', 'hero.install': 'Instálala en el móvil',
      'hero.note': 'Sin cuenta · Funciona sin conexión · Datos en la Unión Europea',
      'hero.b1': 'Cada día sabes cuánto puedes gastar todavía', 'hero.b2': 'Apuntas un gasto en 5 segundos, o importas el extracto del banco', 'hero.b3': 'Ahorros e inversiones crecen solos, mes a mes', 'hero.qrT': 'Escanea y ábrela en el móvil', 'hero.qr': 'Se instala desde el navegador en 30 segundos, sin App Store.', 'feat.more': 'Descubre qué hace cada función', 'feat.close': 'Cerrar',
      'mock.safe': 'Hoy puedes gastar', 'mock.perDay1': '24,80 € al día', 'mock.perDay2': '13,10 € al día',
      'b.essentials': 'Esenciales', 'b.qualityOfLife': 'Calidad de vida', 'b.safetyFund': 'Fondo de seguridad', 'b.investments': 'Inversiones',
      'rule.title': 'Un método sencillo: cada euro tiene un trabajo',
      'rule.text': 'El 55-20-15-10 es el reparto que recomendamos, pero la regla es tuya: cambia los porcentajes cuando quieras.',
      'rule.e': 'Alquiler, compra, facturas, transporte', 'rule.q': 'Salidas, aficiones, viajes, regalos', 'rule.s': 'El colchón para imprevistos', 'rule.i': 'Tu futuro: ETF, planes de inversión',
      'how.title': 'Cómo funciona',
      'how.1t': 'Elige tu regla', 'how.1': 'Empieza con el 55-20-15-10 o pon tus partes. Los ingresos se reparten solos.',
      'how.2t': 'Apunta o importa', 'how.2': 'Un gasto en 5 segundos desde el móvil, o importa tu extracto: las reglas reconocen las tiendas y lo ordenan todo.',
      'how.3t': 'Sabe cuánto puedes gastar', 'how.3': 'Cada día ves cuánto puedes gastar en cada parte. Lo que sobra pasa al mes siguiente.',
      'feat.title': 'Las funciones, en breve',
      'feat.safeT': 'Hoy puedes gastar', 'feat.safe': 'Una cifra clara al día para cada parte, apartando las facturas que vienen.',
      'feat.payT': 'Día de cobro', 'feat.pay': 'Te dice cuánto pasar a cada hucha (Revolut, Trade Republic…) y lo marcas.',
      'feat.importT': 'Importación y reglas', 'feat.import': 'Importa tu extracto, las palabras clave ordenan los gastos. Tú confirmas o cambias y la app aprende.',
      'feat.carryT': 'Lo que sobra se queda', 'feat.carry': 'Lo que no gastas en una parte pasa al mes siguiente, año tras año.',
      'feat.yearT': 'El año y los años', 'feat.year': 'Gráfico mes a mes, tasa de ahorro, comparación entre años.',
      'feat.invT': 'Inversiones', 'feat.inv': 'Cartera, depósitos y plan de inversión junto a tu presupuesto.',
      'feat.fxT': 'Varias monedas', 'feat.fx': 'Gastos en dólares o libras convertidos con el tipo del BCE del día.',
      'feat.fastT': 'Rápida en todas partes', 'feat.fast': 'Se instala en el móvil, funciona sin conexión y se sincroniza con el ordenador.',
      'priv.title': 'Tu dinero es cosa tuya',
      'priv.text': 'Quadriamo funciona también sin cuenta: tus datos se quedan en tu dispositivo. Si quieres sincronizar, la copia está en servidores de la Unión Europea.',
      'priv.1': 'Sin publicidad, sin venta de datos', 'priv.2': 'No hace falta conectar el banco', 'priv.3': 'Exporta o borra todo cuando quieras', 'priv.4': 'Servidores en la UE, conexiones cifradas',
      'dl.title': 'Descarga la app', 'dl.text': 'Quadriamo se instala desde el navegador en 30 segundos, sin App Store ni Play Store.',
      'dl.ios1': 'Abre el enlace con Safari', 'dl.ios2': 'Toca Compartir ⬆︎', 'dl.ios3': 'Elige «Añadir a pantalla de inicio»',
      'dl.and1': 'Abre el enlace con Chrome', 'dl.and2': 'Toca Instalar, o el menú ⋮', 'dl.and3': 'Elige «Instalar aplicación»',
      'dl.qr': '¿En el ordenador? Escanea el código con el móvil.', 'dl.guide': 'Guía completa',
      'acc.title': 'Tu área personal', 'acc.text': 'Inicia sesión para tener los mismos datos en el móvil y el ordenador.',
      'acc.1': 'Sin contraseña: te llega un enlace por correo', 'acc.2': 'Sincronización automática', 'acc.3': 'Borra tu cuenta cuando quieras',
      'acc.cardT': 'Inicia sesión o crea una cuenta', 'acc.card': 'Crea una cuenta con nombre, apellidos, correo y contraseña (o entra si ya la tienes). Después, si quieres, completa tu perfil: ingresos, objetivos y cómo repartir tu dinero.',
      'acc.noAccount': 'O úsala sin cuenta →',
      'price.title': 'Precios',
      'price.betaT': 'Beta', 'price.betaP': 'Gratis', 'price.beta': 'Todas las funciones durante la beta. A cambio, nos ayudas con tu opinión.',
      'price.proT': 'Pro', 'price.proP': 'Próximamente', 'price.pro': 'Un plan opcional con funciones avanzadas, con precio especial para quien probó la beta.',
      'faq.title': 'Preguntas frecuentes',
      'faq.q1': '¿Es seguro?', 'faq.a1': 'Sin cuenta, los datos solo están en tu dispositivo. Con cuenta, cada usuario solo ve sus datos, en servidores de la UE y con conexiones cifradas.',
      'faq.q2': '¿Tengo que conectar mi banco?', 'faq.a2': 'No. Apunta los gastos a mano en segundos o importa tu extracto en CSV.',
      'faq.q3': '¿Funciona sin internet?', 'faq.a3': 'Sí. Una vez instalada funciona sin conexión y se sincroniza al volver a estar en línea.',
      'faq.q4': '¿Puedo cambiar los porcentajes?', 'faq.a4': 'Claro: el 55-20-15-10 es el recomendado, pero puedes poner la regla que quieras, siempre que sume 100 %.',
      'faq.q5': '¿Cuánto cuesta?', 'faq.a5': 'Es gratis durante la beta. Más adelante habrá un plan Pro opcional; la versión gratuita seguirá.',
      'faq.q6': '¿Es asesoramiento financiero?', 'faq.a6': 'No: Quadriamo es una herramienta para organizar tu presupuesto. Las decisiones son tuyas.',
      'foot.tag': 'Tu dinero, en cuatro.', 'foot.privacy': 'Privacidad', 'foot.terms': 'Términos',
      'foot.legal': '© 2026 Quadriamo · Herramienta de presupuesto, no asesoramiento financiero.'
    }
  }
  function pick(l) { return T[l] ? l : 'en' }
  function apply(l) {
    l = pick(l)
    var d = T[l]
    document.documentElement.lang = l
    document.title = d['page.title']
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var k = el.getAttribute('data-i18n'); if (d[k] != null) el.textContent = d[k] })
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { var k = el.getAttribute('data-i18n-html'); if (d[k] != null) el.innerHTML = d[k] })
    var sel = document.querySelector('.lang-select'); if (sel) sel.value = l
    // i link verso l'app e le pagine portano la lingua scelta
    document.querySelectorAll('a[href^="install.html"], a[href^="inizia.html"], a[href^="privacy.html"], a[href^="terms.html"]').forEach(function (a) {
      a.href = a.getAttribute('href').split('?')[0] + '?lang=' + l
    })
  }
  var q = new URLSearchParams(location.search).get('lang'), saved = null
  try { saved = localStorage.getItem('quadriamo.lang') } catch { /* storage non disponibile */ }
  apply(q || saved || (navigator.language || 'en').slice(0, 2))
  // funzioni: dettagli nel pop-up, aperto sulla funzione toccata
  var dlg = document.getElementById('feat-dialog')
  if (dlg && dlg.showModal) {
    document.querySelectorAll('[data-feat]').forEach(function (b) {
      b.addEventListener('click', function () {
        dlg.showModal()
        var el = document.getElementById('feat-' + b.getAttribute('data-feat'))
        if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl') }, 1200) }
      })
    })
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close() })   // tocco fuori: chiude
  }
  var sel = document.querySelector('.lang-select')
  if (sel) sel.addEventListener('change', function () {
    try { localStorage.setItem('quadriamo.lang', sel.value) } catch { /* ignora */ }
    apply(sel.value)
  })
})()
