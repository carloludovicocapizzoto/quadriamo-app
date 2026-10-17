// Il catalogo dei widget della Home e quelli scelti dall'utente (Settings.homeWidgets, sincronizzato tra dispositivi).
// Regola: in Home solo ciò che si guarda appena si apre l'app. Notizie, statistiche e grafici di dettaglio vivono nelle loro sezioni.
import type { AppData } from '../../store/state'

export const WIDGETS = ['parts', 'today', 'forecast', 'week', 'upcoming', 'calendar', 'subscriptions', 'documents', 'tips', 'missions', 'capital', 'emergency', 'goals', 'streak', 'markets', 'events'] as const
export type WidgetId = typeof WIDGETS[number]
/** Di partenza: sul telefono pochi e importanti (una mano, niente "dashboard affollata"); sugli schermi larghi qualcuno in più. */
export const DEFAULT_PHONE: WidgetId[] = ['parts', 'today', 'forecast', 'upcoming', 'tips']
export const DEFAULT_WIDE: WidgetId[] = ['parts', 'today', 'forecast', 'week', 'upcoming', 'tips', 'capital', 'goals', 'markets']
export const DEFAULT_WIDGETS = DEFAULT_PHONE
/** I widget della Home in ordine: i preferiti sempre in cima (nel loro ordine), poi gli altri. */
export const shown = (s: AppData['settings'], wide = false): WidgetId[] => {
  const list = s.homeWidgets?.filter((x): x is WidgetId => (WIDGETS as readonly string[]).includes(x)) ?? (wide ? DEFAULT_WIDE : DEFAULT_PHONE)
  const favs = s.homeFavs ?? []
  return [...list.filter(x => favs.includes(x)), ...list.filter(x => !favs.includes(x))]
}
export const isFav = (s: AppData['settings'], id: WidgetId) => (s.homeFavs ?? []).includes(id)

/** Quanto spazio prende un widget nella griglia: piccolo (una colonna), medio (due), grande (tutta la riga). */
export type WidgetSize = 's' | 'm' | 'l'
export const DEFAULT_SIZE: Record<WidgetId, WidgetSize> = {
  parts: 'm', today: 's', forecast: 's', week: 's', upcoming: 's', calendar: 's', subscriptions: 's', documents: 's', tips: 's', missions: 's', capital: 's', emergency: 's', goals: 's', streak: 's', markets: 's', events: 's',
}
export const sizeOf = (s: AppData['settings'], id: WidgetId): WidgetSize => s.homeWidgetSizes?.[id] ?? DEFAULT_SIZE[id]
/** Nel pannello a destra (schermi larghi): le cose "di contorno" alla giornata. */
export const SIDE: WidgetId[] = ['upcoming', 'calendar', 'documents', 'markets', 'events']
