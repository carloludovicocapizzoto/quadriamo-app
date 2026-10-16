import { createContext, useContext } from 'react'
import type { Dict } from './en'
import { local } from '../storage'

export const LANGS = { it: 'Italiano', en: 'English', fr: 'Français', es: 'Español' } as const
export type Lang = keyof typeof LANGS
// ogni lingua è un pezzo a parte: si scarica solo quella in uso (le altre se la si cambia). Tutte hanno tutte le
// chiavi (i18n.test.ts), quindi non serve una lingua di riserva.
const LOADERS: Record<Lang, () => Promise<{ default: Dict }>> = {
  it: () => import('./it'), en: () => import('./en'), fr: () => import('./fr'), es: () => import('./es'),
}
const loaded = new Map<Lang, Dict>()
export async function loadDict(l: Lang): Promise<Dict> {
  const d = loaded.get(l) ?? (await LOADERS[l]()).default
  loaded.set(l, d)
  return d
}

export interface I18nStart { lang: Lang; dict: Dict }

/** La lingua di partenza (scelta prima, altrimenti quella del browser), già scaricata: si chiama prima del primo disegno. */
export async function prepareI18n(): Promise<I18nStart> {
  const saved = local.get(LANG_KEY)
  const lang = saved && saved in LANGS ? saved as Lang : detectLang()
  return { lang, dict: await loadDict(lang) }
}
export const LANG_KEY = 'quadriamo.lang'

/** Lingua del browser se è una delle quattro, altrimenti inglese. */
export function detectLang(preferred: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const l of preferred) {
    const code = l.slice(0, 2).toLowerCase()
    if (code in LANGS) return code as Lang
  }
  return 'en'
}

export interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: keyof Dict, vars?: Record<string, string | number>) => string
  money: (n: number, currency: string) => string
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}

