// Il nome di una schermata dell'app a partire dal suo indirizzo (#/analysis/month → "Analisi · Mese"),
// con le stesse etichette italiane dell'app: per leggere percorsi e tempi nel pannello Uso.
import { ANALYSIS_LABEL, parse } from '../../app/router'
import it from '../../i18n/it'
import type { Action } from '../../store/state'
import { pageLabel } from '../../ui/profile/sections'

export function screenName(hash: string): string {
  const r = parse(hash)
  if (r.tab === 'home') return it['nav.home']
  if (r.tab === 'news') return it['nav.news']
  if (r.tab === 'analysis') return `${it['nav.analysis']} · ${it[ANALYSIS_LABEL[r.view]]}`
  return r.page ? `${it['nav.profile']} · ${it[pageLabel(r.page, true)]}` : it['nav.profile']
}

/** Il nome di ogni tipo di azione dell'app (store/types.ts): un'azione nuova senza nome non compila. */
export const ACTION_NAMES: Record<Exclude<Action['type'], 'load'>, string> = {
  addTx: 'Aggiunge un movimento', updateTx: 'Modifica un movimento', deleteTx: 'Elimina un movimento',
  setSettings: 'Cambia le impostazioni', setFx: 'Aggiorna i cambi automatici', deleteCategory: 'Elimina una categoria', setInvestments: 'Aggiorna gli investimenti',
  addInbox: 'Importa un estratto conto', updateInbox: 'Rivede un movimento importato', confirmInbox: 'Conferma movimenti importati', ignoreInbox: 'Scarta movimenti importati',
  togglePayday: 'Segna un pagamento', setProfile: 'Aggiorna il profilo', saveGoal: 'Salva un obiettivo', deleteGoal: 'Elimina un obiettivo',
  goalMoney: 'Versa su un obiettivo', replace: 'Ripristina o azzera i dati',
}
