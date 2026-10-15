// Il catalogo dei widget della Home e quelli scelti dall'utente (Settings.homeWidgets, sincronizzato tra dispositivi).
import type { AppData } from '../../store/state'

export const WIDGETS = ['parts', 'today', 'forecast', 'capital', 'daily', 'categories', 'changes', 'goals', 'streak'] as const
export type WidgetId = typeof WIDGETS[number]
/** Quelli di partenza: il necessario per la giornata e per il mese. Gli altri si aggiungono da "Personalizza". */
export const DEFAULT_WIDGETS: WidgetId[] = ['parts', 'today', 'forecast', 'capital', 'daily', 'goals']
export const shown = (s: AppData['settings']): WidgetId[] =>
  (s.homeWidgets?.filter((x): x is WidgetId => (WIDGETS as readonly string[]).includes(x)) ?? DEFAULT_WIDGETS)

