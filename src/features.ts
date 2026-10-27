// Funzioni che usano servizi del server non presenti in ogni ambiente. Nell'Alpha il gateway accetta solo
// sincronizzazione, profili e abbonamenti (functions/api/rest): le altre funzioni si nascondono, o dicono che
// arriveranno, invece di mostrare un'interfaccia che poi fallisce. Un solo elenco, controllato dai test.
import { ENV, type EnvName } from './env'

export type CloudFeature =
  | 'shared'        // Budget comune (tabelle shared_*)
  | 'news'          // notizie dal web (funzione news, news_items)
  | 'feedback'      // «Come ti trovi?» e segnalazioni dall'app (feedback, reports)
  | 'telemetry'     // statistiche d'uso anonime (usage_events)
  | 'research'      // ricerca anonima del profilo (submit_research)
  | 'errorReports'  // errori dell'app inviati all'amministratore (client_errors)
  | 'econEvents'    // widget degli eventi economici (econ_events)
  | 'invite'        // «Invita un amico»: nell'Alpha si entra solo su invito dell'amministratore

const MISSING: Record<EnvName, readonly CloudFeature[]> = {
  development: [],
  production: [],
  alpha: ['shared', 'news', 'feedback', 'telemetry', 'research', 'errorReports', 'econEvents', 'invite'],
}

export const cloudFeature = (feature: CloudFeature, env: EnvName = ENV.name) => !MISSING[env].includes(feature)
