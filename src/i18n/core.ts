import { createContext, useContext } from 'react'
import en, { type Dict } from './en'
import es from './es'
import fr from './fr'
import it from './it'

export const LANGS = { it: 'Italiano', en: 'English', fr: 'Français', es: 'Español' } as const
export type Lang = keyof typeof LANGS
export const DICTS: Record<Lang, Dict> = { it, en, fr, es }
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

/** Nomi tradotti di bucket e categorie predefiniti, per id. */
export function defaultNames(lang: Lang): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(DICTS[lang])) {
    if (k.startsWith('b.') || k.startsWith('c.')) out[k.slice(2)] = v
  }
  return out
}
