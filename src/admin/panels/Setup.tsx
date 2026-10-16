// Configurazione: i passi per collegare Supabase, con gli script da copiare e i controlli automatici.
import { useState } from 'react'
import { projectRef, type Setup } from '../data'
import sql0002 from '../../../supabase/migrations/0002_beta_feedback_stats_push.sql?raw'
import sql0004 from '../../../supabase/migrations/0004_profiles.sql?raw'
import sql0005 from '../../../supabase/migrations/0005_site_feedback.sql?raw'
import tplConfirm from '../../../supabase/templates/confirmation.html?raw'
import tplMagic from '../../../supabase/templates/magic_link.html?raw'
import tplRecovery from '../../../supabase/templates/recovery.html?raw'
import sql0006 from '../../../supabase/migrations/0006_admin_key.sql?raw'
import sql0007 from '../../../supabase/migrations/0007_private_profile_anonymous_research.sql?raw'
import sql0008 from '../../../supabase/migrations/0008_morning_push_alternatives_cohorts.sql?raw'
import sql0010 from '../../../supabase/migrations/0010_shared_budgets.sql?raw'
import sql0011 from '../../../supabase/migrations/0011_nudge_streak.sql?raw'
import sql0012 from '../../../supabase/migrations/0012_nudge_cron.sql?raw'
import sql0013 from '../../../supabase/migrations/0013_billing.sql?raw'
import sql0014 from '../../../supabase/migrations/0014_news_push.sql?raw'
import sql0015 from '../../../supabase/migrations/0015_news_cron.sql?raw'
import sql0016 from '../../../supabase/migrations/0016_nudge_until_midnight.sql?raw'
import sql0017 from '../../../supabase/migrations/0017_avatars.sql?raw'
import billingCode from '../../../supabase/functions/billing/index.ts?raw'
import newsCode from '../../../supabase/functions/news/index.ts?raw'
import ingestCode from '../../../supabase/functions/news-ingest/index.ts?raw'
import feedCode from '../../../supabase/functions/_shared/news-feed.ts?raw'
import rulesCode from '../../../supabase/functions/_shared/news-rules.ts?raw'
import itemCode from '../../../supabase/functions/_shared/news-item.ts?raw'
import sql0020 from '../../../supabase/migrations/0020_news_podcasts_images.sql?raw'
import sql0021 from '../../../supabase/migrations/0021_feedback_cron_fix.sql?raw'
import sql0022 from '../../../supabase/migrations/0022_client_errors.sql?raw'
import sql0023 from '../../../supabase/migrations/0023_econ_events.sql?raw'
import sql0024 from '../../../supabase/migrations/0024_error_diagnostics.sql?raw'
import sql0025 from '../../../supabase/migrations/0025_usage_sessions.sql?raw'
import sql0026 from '../../../supabase/migrations/0026_tester_reports.sql?raw'
import sql0018 from '../../../supabase/migrations/0018_news_hub.sql?raw'
import sql0019 from '../../../supabase/migrations/0019_news_hub_cron.sql?raw'
import sql0009 from '../../../supabase/migrations/0009_morning_push_cron.sql?raw'
import sql0003 from '../../../supabase/migrations/0003_feedback_push_every_10_days.sql?raw'
import fnCode from '../../../supabase/functions/send-push/index.ts?raw'
import { local } from '../../storage'

const SITE = 'https://carloludovicocapizzoto.github.io/quadriamo-app/'

// l'editor delle funzioni di Supabase accetta un file solo: regole e lettura dei feed (condivise con i test) nello stesso file
const ingestBundle = [ingestCode.replace(/^import .*_shared\/.*\n/gm, ''), '// ---------- lettura dei feed (_shared/news-feed.ts) ----------', feedCode,
  '// ---------- regole (_shared/news-rules.ts) ----------', rulesCode,
  '// ---------- da contenuto a riga (_shared/news-item.ts) ----------', itemCode.replace(/^import .*'\.\/news-.*\n/gm, '')].join('\n')

function Copy({ text, label: l = 'Copia' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return <button className="az-btn" onClick={() => void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000) })}>{done ? '✓ Copiato' : `📋 ${l}`}</button>
}
// passi che Supabase non lascia controllare da fuori (impostazioni di accesso, modelli email): li segni tu come fatti
const MANUAL_KEY = 'q.setupManual'
const readManual = () => local.json<number[]>(MANUAL_KEY, [])

function Step({ n, ok, title, children, manual }: { n: number; ok: boolean | null; title: string; children?: React.ReactNode; manual?: { done: boolean; toggle: () => void } }) {
  const done = ok ?? manual?.done ?? null
  return (
    <div className={`az-step${done ? ' done' : ''}`}>
      <span className="num">{done ? '✓' : n}</span>
      <div><h4>{title} {done === false && <span className="az-pill warn">da fare</span>}{done && <span className="az-pill ok">fatto</span>}</h4>
        {!done && children}
        {manual && ok == null && (done
          ? <button className="az-link" onClick={manual.toggle}>Riapri le istruzioni</button>
          : <div className="az-u-row"><button className="az-btn primary" onClick={manual.toggle}>✓ Segna come fatto</button>
              <span className="az-hint">Supabase non lascia controllare queste impostazioni da qui: segnalo tu quando hai finito.</span></div>)}
      </div>
    </div>
  )
}

export function SetupPanel({ setup, email, adminKey, onRecheck }: { setup: Setup; email: string; adminKey?: { name: string; hash: string }; onRecheck: () => void }) {
  const ref = projectRef()
  const [manual, setManual] = useState<number[]>(readManual)
  const toggle = (n: number) => () => setManual(m => {
    const next = m.includes(n) ? m.filter(x => x !== n) : [...m, n]
    local.setJson(MANUAL_KEY, next)
    return next
  })
  const dash = `https://supabase.com/dashboard/project/${ref}`
  // con nome + codice: si registra solo l'impronta del codice; con l'account: l'utente con questa email
  const adminSql = adminKey
    ? `insert into public.admin_keys (name, key_hash)\nvalues ('${adminKey.name.replace(/'/g, "''")}', decode('${adminKey.hash}', 'hex'))\non conflict (key_hash) do update set name = excluded.name;`
    : `insert into public.admins (user_id)\nselect id from auth.users where email = '${email}'\non conflict do nothing;`
  const fullSql = `${sql0002}\n${sql0004}\n${sql0005}\n${sql0006}\n${sql0007}\n${sql0008}\n${sql0010}\n${sql0011}\n${sql0013}\n${sql0014}\n-- tu sei l'amministratore\n${adminSql}\n`
  const step1 = !!setup.tables && setup.admin && !!setup.profiles && setup.research !== false && setup.v8 !== false && setup.v10 !== false && setup.v11 !== false && setup.v13 !== false && setup.v14 !== false && setup.siteFeedback !== false && setup.adminKeys !== false
  // tabelle già create ma manca qualcosa: solo i pezzi mancanti
  const partialSql = [setup.profiles === false ? sql0004 : '', setup.siteFeedback === false ? sql0005 : '', setup.adminKeys === false ? sql0006 : '', setup.research === false ? sql0007 : '', setup.v8 === false ? sql0008 : '', setup.v10 === false ? sql0010 : '', setup.v11 === false ? sql0011 : '', setup.v13 === false ? sql0013 : '', setup.v14 === false ? sql0014 : '', setup.admin ? '' : adminSql].filter(Boolean).join('\n')
  const cronSql = sql0003.replace('<PROJECT_REF>', ref)
  const morningSql = sql0009.replace('<PROJECT_REF>', ref)
  return (
    <>
      <p className="az-lead">Questa pagina controlla dal vivo cosa è già attivo sul tuo progetto Supabase. Ogni passo ha il codice già pronto:
        lo copi, lo incolli nel punto indicato e premi <b>Ricontrolla</b>.</p>
      <div className="az-steps">
        <Step n={1} ok={setup.tables == null ? null : step1} title="Tabelle (statistiche, feedback, notifiche, profili, ricerca, budget comune) e il tuo accesso da amministratore">
          {setup.tables
            ? <p>Manca ancora un pezzo. Copia, incolla in <a href={`${dash}/sql/new`} target="_blank" rel="noreferrer">SQL Editor</a> → <b>Run</b>.</p>
            : <p>Copia lo script (crea tutto e ti rende amministratore {adminKey ? <>con il nome <b>{adminKey.name}</b> e il tuo codice</> : <>con <b>{email}</b></>}), poi apri <a href={`${dash}/sql/new`} target="_blank" rel="noreferrer">SQL Editor</a>, incolla e premi <b>Run</b>. Deve comparire "Success".</p>}
          <div className="az-u-row"><Copy text={setup.tables ? partialSql : fullSql} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
        </Step>
        <Step n={2} ok={null} manual={{ done: manual.includes(2), toggle: toggle(2) }} title="Registrazione con email e password">
          <p>In <a href={`${dash}/auth/providers`} target="_blank" rel="noreferrer">Authentication → Sign In / Providers → Email</a> lascia attivi
            <b>Email</b> e <b>Confirm email</b>, con <b>Email OTP Length = 6</b>: l'email contiene un codice di 6 cifre che si scrive direttamente
            nell'app installata, senza passare dal browser.</p>
          <p><b>Importante:</b> il servizio email gratuito di Supabase consegna solo agli indirizzi del tuo team (per questo a te arriva) e poche
            email all'ora. Perché arrivino anche agli amici, collega un servizio SMTP in
            <a href={`${dash}/auth/smtp`} target="_blank" rel="noreferrer">Authentication → SMTP Settings</a>. Senza dominio va bene una <b>casella Gmail
            dedicata</b> (es. quadriamo.app@gmail.com) con una "password per le app": host <code>smtp.gmail.com</code>, porta <code>587</code>,
            utente l'indirizzo Gmail, password quella per le app, nome del mittente <b>Quadriamo</b> (così non compare più "Supabase Auth").
            Con il dominio passerai a Resend (<code>smtp.resend.com</code>, porta 465, utente <code>resend</code>, password la chiave API). Finché non lo fai, puoi disattivare "Confirm email" per far entrare
            gli amici senza conferma.</p>
          <p>In <a href={`${dash}/auth/url-configuration`} target="_blank" rel="noreferrer">URL Configuration</a>: Site URL
            <code>{SITE}app/</code> e tra i Redirect URLs <code>{SITE}**</code>.</p>
          <div className="az-u-row"><Copy text={`${SITE}app/`} label="Copia Site URL" /><Copy text={`${SITE}**`} label="Copia Redirect URL" />
            <a className="az-btn" href={`${dash}/auth/providers`} target="_blank" rel="noreferrer">↗ Apri Providers</a></div>
        </Step>
        <Step n={3} ok={null} manual={{ done: manual.includes(3), toggle: toggle(3) }} title="Email con lo stile di Quadriamo">
          <p>In <a href={`${dash}/auth/templates`} target="_blank" rel="noreferrer">Authentication → Email Templates</a>, per ognuna delle tre email
            incolla l'oggetto e il testo (scheda <b>Source</b>) e salva. Il testo esce nella lingua scelta dall'utente (IT, EN, FR, ES).</p>
          <ul className="az-tpl">
            {([['Confirm signup', 'Conferma il tuo account Quadriamo', tplConfirm], ['Magic Link', 'Il tuo accesso a Quadriamo', tplMagic],
               ['Reset Password', 'Nuova password per Quadriamo', tplRecovery]] as const).map(([name, subject, body]) => (
              <li key={name}><b>{name}</b><span className="az-u-row"><Copy text={subject} label="Copia oggetto" /><Copy text={body} label="Copia testo" /></span></li>
            ))}
          </ul>
          <div className="az-u-row"><a className="az-btn" href={`${dash}/auth/templates`} target="_blank" rel="noreferrer">↗ Apri Email Templates</a></div>
        </Step>
        <Step n={4} ok={setup.admin ? setup.fn !== 'missing' : null} title="Funzione che invia le notifiche (send-push)">
          <ol>
            <li>Apri <a href={`${dash}/functions`} target="_blank" rel="noreferrer">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>.</li>
            <li>Nome: <code>send-push</code>. Cancella il codice di esempio, incolla quello copiato da qui → <b>Deploy</b>.</li>
            <li>Nei dettagli della funzione disattiva <b>Verify JWT</b> (serve al promemoria automatico; la funzione controlla da sola chi la chiama).</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions`} target="_blank" rel="noreferrer">↗ Apri Edge Functions</a></div>
        </Step>
        <Step n={5} ok={setup.admin && setup.fn !== 'missing' ? setup.fn === 'ok' && setup.cronSecret : null} title="Chiavi delle notifiche (segreti)">
          <p>In <a href={`${dash}/functions/secrets`} target="_blank" rel="noreferrer">Edge Functions → Secrets</a> aggiungi tre segreti, con nomi e valori
            presi dal file <code>.vapid.local</code> nella cartella <code>quadriamo-app</code> sul tuo Mac: <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>, <code>CRON_SECRET</code>.
            Per sicurezza non sono in questa pagina.</p>
          <div className="az-u-row"><a className="az-btn" href={`${dash}/functions/secrets`} target="_blank" rel="noreferrer">↗ Apri Secrets</a></div>
        </Step>
        <Step n={6} ok={setup.admin ? setup.reminder : null} title="Promemoria automatico ogni 10 giorni (facoltativo)">
          <ol>
            <li>In <a href={`${dash}/database/extensions`} target="_blank" rel="noreferrer">Database → Extensions</a> attiva <code>pg_cron</code> e <code>pg_net</code>.</li>
            <li>Copia lo script, sostituisci <code>&lt;CRON_SECRET&gt;</code> con il valore del file <code>.vapid.local</code>, poi eseguilo in SQL Editor.</li>
          </ol>
          <div className="az-u-row"><Copy text={cronSql} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/database/extensions`} target="_blank" rel="noreferrer">↗ Apri Extensions</a></div>
        </Step>
        <Step n={7} ok={null} manual={{ done: manual.includes(7), toggle: toggle(7) }} title="Notifica del mattino &quot;Oggi puoi spendere&quot; (facoltativo)">
          <ol>
            <li>Aggiorna la funzione: premi <b>Copia il codice della funzione</b>, apri <b>send-push → Code</b>, clicca nel codice,
              <b>Cmd+A</b> poi <b>Cmd+V</b> → <b>Deploy</b>.</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions/send-push/code`} target="_blank" rel="noreferrer">↗ Apri send-push → Code</a></div>
          <ol start={2}>
            <li>Premi <b>Copia lo script</b>, apri SQL Editor e incolla. Sostituisci <code>&lt;CRON_SECRET&gt;</code> (anche i simboli &lt; &gt;) con il valore
              del file <code>.vapid.local</code> → <b>Run</b>. Poi cancella la query, perché contiene il segreto.</li>
          </ol>
          <div className="az-u-row"><Copy text={morningSql} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">Ogni mattina alle 7:30 arriva a chi ha le notifiche attive. Il server manda solo la sveglia: il numero lo calcola il telefono.</p>
        </Step>
        <Step n={8} ok={null} manual={{ done: manual.includes(8), toggle: toggle(8) }} title="Promemoria a sorpresa per chi non ha aggiornato (facoltativo)">
          <ol>
            <li>Serve la funzione <code>send-push</code> aggiornata (pulsante qui sotto → send-push → Code → <b>Cmd+A</b>, <b>Cmd+V</b> → <b>Deploy</b>).</li>
            <li>Poi copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Non c'è niente da sostituire: riusa il segreto della notifica del mattino (passo 7).</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions/send-push/code`} target="_blank" rel="noreferrer">↗ Apri send-push → Code</a></div>
          <div className="az-u-row"><Copy text={sql0012} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">A un'ora a caso tra le 9 e le 20, al massimo una volta al giorno, solo a chi oggi non ha ancora segnato niente.
            L'app comunica solo la data dell'ultimo aggiornamento; il testo (con i giorni di slancio) lo scrive il telefono.</p>
        </Step>
        <Step n={9} ok={setup.billing ? setup.billing.fn && setup.billing.configured && setup.billing.webhook : null} title="Abbonamento Pro con Stripe (modalità di prova)">
          {setup.billing && <ul className="az-checks">
            <li className={setup.billing.fn ? 'ok' : 'bad'}>Funzione <code>billing</code> pubblicata</li>
            <li className={setup.billing.configured ? 'ok' : 'bad'}>Chiave segreta e i due prezzi (mensile, annuale)</li>
            <li className={setup.billing.webhook ? 'ok' : 'bad'}>Segreto del webhook</li>
            {setup.billing.configured && <li className={setup.billing.test ? 'ok' : 'bad'}>{setup.billing.test ? 'Modalità di prova (nessun addebito reale)' : 'ATTENZIONE: chiave reale, i pagamenti sono veri'}</li>}
          </ul>}
          <ol>
            <li>Crea un account su <a href="https://dashboard.stripe.com/register" target="_blank" rel="noreferrer">Stripe</a> e lascia attiva la <b>modalità di prova</b> (interruttore "Test mode" in alto).</li>
            <li>In <a href="https://dashboard.stripe.com/test/products" target="_blank" rel="noreferrer">Prodotti</a> crea <b>Quadriamo Pro</b> con due prezzi ricorrenti: mensile e annuale.
              Copia i due ID che iniziano con <code>price_</code>.</li>
            <li>In <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noreferrer">Sviluppatori → Chiavi API</a> copia la <b>chiave segreta</b> (inizia con <code>sk_test_</code>).</li>
            <li>Pubblica la funzione: <a href={`${dash}/functions`} target="_blank" rel="noreferrer">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>,
              nome <code>billing</code>, incolla il codice (pulsante qui sotto) → <b>Deploy</b>. Poi nei dettagli spegni <b>Verify JWT</b>.</li>
            <li>In <a href="https://dashboard.stripe.com/test/webhooks" target="_blank" rel="noreferrer">Sviluppatori → Webhook</a> aggiungi l'indirizzo
              <code>{`https://${ref}.supabase.co/functions/v1/billing`}</code> con gli eventi <code>checkout.session.completed</code>,
              <code>customer.subscription.created</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>.
              Copia il <b>segreto di firma</b> (inizia con <code>whsec_</code>).</li>
            <li>In <a href={`${dash}/functions/secrets`} target="_blank" rel="noreferrer">Edge Functions → Secrets</a> aggiungi <code>STRIPE_SECRET_KEY</code>,
              <code>STRIPE_WEBHOOK_SECRET</code>, <code>STRIPE_PRICE_MONTHLY</code>, <code>STRIPE_PRICE_YEARLY</code>.</li>
            <li>In <a href="https://dashboard.stripe.com/test/settings/billing/portal" target="_blank" rel="noreferrer">Impostazioni → Portale clienti</a> premi <b>Attiva</b>
              (serve per "Gestisci abbonamento").</li>
          </ol>
          <div className="az-u-row"><Copy text={billingCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions`} target="_blank" rel="noreferrer">↗ Apri Edge Functions</a></div>
          <p className="az-hint">Durante la beta Pro resta gratis per tutti: il pagamento si prova da Opzioni → Il tuo piano, con la carta di prova 4242 4242 4242 4242.
            Prima di passare ai pagamenti veri: hosting adatto a un servizio commerciale, dominio, privacy e termini con i dati dell'attività.</p>
        </Step>
        <Step n={10} ok={setup.news} title="Notizie di finanza nella Home">
          <ol>
            <li>Apri <a href={`${dash}/functions`} target="_blank" rel="noreferrer">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>.</li>
            <li>Nome: <code>news</code>. Cancella il codice di esempio, incolla quello copiato da qui → <b>Deploy</b>.</li>
            <li>Nei dettagli della funzione spegni <b>Verify JWT</b> (le notizie le vede anche chi usa l'app senza account).</li>
          </ol>
          <div className="az-u-row"><Copy text={newsCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions`} target="_blank" rel="noreferrer">↗ Apri Edge Functions</a></div>
          <p className="az-hint">Prende solo titolo, testata, data e link dalle notizie di economia (ANSA, Il Sole 24 Ore, Corriere, Repubblica, Money.it; BBC, Le Monde, Expansión nelle altre lingue).
            Nessun segreto da impostare. Finché non c'è, l'app mostra solo il consiglio del giorno.</p>
        </Step>
        <Step n={11} ok={null} manual={{ done: manual.includes(11), toggle: toggle(11) }} title="Notifiche delle notizie principali (facoltativo)">
          <ol>
            <li>Aggiorna la funzione <code>send-push</code>: pulsante qui sotto → send-push → Code → <b>Cmd+A</b>, <b>Cmd+V</b> → <b>Deploy</b>.</li>
            <li>Poi copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Non c'è niente da sostituire: riusa il segreto della notifica del mattino (passo 7).</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions/send-push/code`} target="_blank" rel="noreferrer">↗ Apri send-push → Code</a></div>
          <div className="az-u-row"><Copy text={sql0015} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">Ogni 2 ore tra le 9 e le 21 la funzione guarda le notizie delle ultime 3 ore e manda solo quella più importante per il budget
            (tassi, inflazione, affitti, bollette, carburante, bonus, manovra), al massimo 2 al giorno e mai la stessa due volte. Ognuno può spegnerle da Profilo → Notifiche.</p>
        </Step>
        <Step n={12} ok={null} manual={{ done: manual.includes(12), toggle: toggle(12) }} title="Promemoria fino a mezzanotte">
          <ol>
            <li>Aggiorna la funzione <code>send-push</code>: pulsante qui sotto → send-push → Code → <b>Cmd+A</b>, <b>Cmd+V</b> → <b>Deploy</b>.</li>
            <li>Poi copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Non c'è niente da sostituire.</li>
          </ol>
          <div className="az-u-row"><Copy text={fnCode} label="Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions/send-push/code`} target="_blank" rel="noreferrer">↗ Apri send-push → Code</a></div>
          <div className="az-u-row"><Copy text={sql0016} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">Chi oggi non ha ancora segnato niente riceve il primo promemoria nel pomeriggio, poi, finché non lo fa, uno alle 21 e l'ultimo alle 23
            ("a mezzanotte la giornata si chiude"). Al massimo 3 al giorno; chi non apre l'app da più di una settimana ne riceve al massimo uno ogni 3 giorni.
            Un promemoria non consegnato entro mezzanotte non arriva più.</p>
        </Step>
        <Step n={13} ok={null} manual={{ done: manual.includes(13), toggle: toggle(13) }} title="Foto profilo (spazio privato)">
          <ol>
            <li>Copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Non c'è niente da sostituire.</li>
          </ol>
          <div className="az-u-row"><Copy text={sql0017} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">Crea lo spazio privato <code>avatars</code>: ognuno vede e cambia solo la propria foto (256×256, ridotta sul telefono).
            Finché non c'è, la foto resta solo sul dispositivo di chi la sceglie.</p>
        </Step>
        <Step n={14} ok={null} manual={{ done: manual.includes(14), toggle: toggle(14) }} title="Notizie: il Knowledge Hub (raccolta ogni 2 ore)">
          <ol>
            <li>Copia il primo script, incollalo in SQL Editor e premi <b>Run</b>: crea l'elenco delle fonti approvate (44) e l'archivio dei contenuti.
              Poi fai lo stesso con lo script <b>1b</b>: aggiunge i podcast (13) e le immagini dei feed. Se l'hai già fatto, rieseguirli non cambia niente.</li>
            <li>Apri <a href={`${dash}/functions`} target="_blank" rel="noreferrer">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>.
              Nome: <code>news-ingest</code>. Cancella il codice di esempio, incolla quello copiato da qui → <b>Deploy</b>. Nei dettagli spegni <b>Verify JWT</b>.</li>
            <li>Copia il secondo script, incollalo in SQL Editor e premi <b>Run</b>: la raccolta parte subito e poi ogni 2 ore.</li>
          </ol>
          <div className="az-u-row"><Copy text={sql0018} label="1 · Copia lo script delle fonti" /><Copy text={sql0020} label="1b · Copia lo script di podcast e immagini" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <div className="az-u-row"><Copy text={ingestBundle} label="2 · Copia il codice della funzione" />
            <a className="az-btn" href={`${dash}/functions`} target="_blank" rel="noreferrer">↗ Apri Edge Functions</a></div>
          <div className="az-u-row"><Copy text={sql0019} label="3 · Copia lo script della raccolta" /></div>
          <p className="az-hint">Usa lo stesso segreto delle notifiche (passo 5), niente da sostituire. Si salvano solo titolo, estratto del feed, link e
            l'indirizzo dell'immagine che la fonte mette nel feed, mai il testo degli articoli. Per spegnere le immagini di una fonte:
            <code>update news_sources set images = false where id = '…';</code> Finché non è attivo, l'app mostra i titoli delle testate come prima.
            Per controllare: in SQL Editor <code>select id, last_ok, last_count, last_error from news_sources order by last_error nulls last;</code></p>
        </Step>
        <Step n={15} ok={null} manual={{ done: manual.includes(15), toggle: toggle(15) }} title="Promemoria di feedback: sistemare il programma">
          <p>Il promemoria «dacci un parere» ogni 10 giorni non partiva. Copia lo script, incollalo in SQL Editor e premi <b>Run</b>:
            lo ricrea con lo stesso indirizzo e segreto del promemoria del mattino.</p>
          <div className="az-u-row"><Copy text={sql0021} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
        </Step>
        <Step n={16} ok={null} manual={{ done: manual.includes(16), toggle: toggle(16) }} title="Errori dell'app: attivare la raccolta">
          <p>Crea la tabella dove arrivano gli errori dai telefoni degli utenti (solo dati tecnici) e la pulizia dopo 30 giorni.
            Copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Poi li trovi nel pannello <b>Errori</b>.</p>
          <div className="az-u-row"><Copy text={sql0022} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
        </Step>
        <Step n={17} ok={null} manual={{ done: manual.includes(17), toggle: toggle(17) }} title="Eventi economici per il widget della Home">
          <p>Crea il calendario degli eventi (riunioni BCE e Fed, dati ISTAT…) che il widget «Eventi economici» mostra agli utenti.
            Copia lo script, incollalo in SQL Editor e premi <b>Run</b>. Poi aggiungi le date dalle fonti ufficiali con una riga come:</p>
          <p><code>insert into econ_events (day, title_it, title_en, url) values ('2026-10-29', 'BCE: decisione sui tassi', 'ECB: interest rate decision', 'https://www.ecb.europa.eu');</code></p>
          <div className="az-u-row"><Copy text={sql0023} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
          <p className="az-hint">Finché non ci sono date future, il widget non compare.</p>
        </Step>
        <Step n={18} ok={setup.betaTools} title="Beta: diagnostica, uso dell'app e segnalazioni dei tester">
          <p>Errori con gli ultimi passi, statistiche d'uso per sessione (solo con il consenso) e segnalazioni con screenshot e video
            in un archivio privato. Copia lo script, incollalo in SQL Editor e premi <b>Run</b>; va eseguito sia nel progetto di
            produzione sia in quello della beta. Poi trovi tutto nei pannelli <b>Uso dell'app</b>, <b>Segnalazioni</b> ed <b>Errori</b>.</p>
          <div className="az-u-row"><Copy text={[sql0024, sql0025, sql0026].join('\n')} label="Copia lo script" />
            <a className="az-btn" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">↗ Apri SQL Editor</a></div>
        </Step>
      </div>
      <div className="az-card">
        <h3>Altri controlli</h3>
        <ul className="az-checks">
          <li className={setup.connected ? 'ok' : 'bad'}>App collegata a Supabase</li>
          <li className={setup.vapidInApp ? 'ok' : 'bad'}>Chiave pubblica delle notifiche presente nell'app</li>
          <li className="ok">Privacy policy aggiornata con statistiche, feedback e notifiche</li>
        </ul>
      </div>
      <button className="az-btn primary" onClick={onRecheck}>↻ Ricontrolla</button>
    </>
  )
}
