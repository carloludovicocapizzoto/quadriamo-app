// Il catalogo dei widget della Home e quelli scelti dall'utente (Settings.homeWidgets, sincronizzato tra dispositivi).
import type { AppData } from '../../store/state'

export const WIDGETS = ['parts', 'today', 'forecast', 'tips', 'missions', 'upcoming', 'capital', 'wealth', 'emergency', 'daily', 'week', 'stats', 'recent',
  'categories', 'changes', 'invest', 'news', 'markets', 'events', 'goals', 'monthGoals', 'badges', 'streak'] as const
export type WidgetId = typeof WIDGETS[number]
/** Quelli di partenza: il necessario per la giornata e per il mese. Gli altri si aggiungono da "Personalizza". */
export const DEFAULT_WIDGETS: WidgetId[] = ['parts', 'today', 'forecast', 'tips', 'missions', 'upcoming', 'capital', 'daily', 'week', 'news', 'markets', 'goals']
export const shown = (s: AppData['settings']): WidgetId[] =>
  (s.homeWidgets?.filter((x): x is WidgetId => (WIDGETS as readonly string[]).includes(x)) ?? DEFAULT_WIDGETS)


/** Quanto spazio prende un widget nella griglia: piccolo (una colonna), medio (due), grande (tutta la riga). */
export type WidgetSize = 's' | 'm' | 'l'
export const DEFAULT_SIZE: Record<WidgetId, WidgetSize> = {
  parts: 'm', today: 's', forecast: 's', tips: 's', missions: 's', upcoming: 's', capital: 's', wealth: 's', emergency: 's', daily: 'm', week: 's',
  stats: 's', recent: 's', categories: 's', changes: 's', invest: 's', news: 'm', markets: 's', events: 's', goals: 's', monthGoals: 's', badges: 's', streak: 's',
}
export const sizeOf = (s: AppData['settings'], id: WidgetId): WidgetSize => s.homeWidgetSizes?.[id] ?? DEFAULT_SIZE[id]
/** Nel pannello a destra (schermi larghi): le cose "di contorno" alla giornata. */
export const SIDE: WidgetId[] = ['news', 'upcoming', 'markets', 'events']
