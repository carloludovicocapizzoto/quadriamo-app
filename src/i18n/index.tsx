import { useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './en'
import { DICTS, I18nContext, LANG_KEY, LANGS, detectLang, type I18n, type Lang } from './core'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && saved in LANGS) return saved as Lang
  } catch { /* storage non disponibile: si usa la lingua del browser */ }
  return detectLang()
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const value = useMemo<I18n>(() => ({
    lang,
    setLang: l => {
      setLangState(l)
      try { localStorage.setItem(LANG_KEY, l) } catch { /* ignora */ }
    },
    t: (key, vars) => {
      let s: string = DICTS[lang][key] ?? en[key] ?? ''
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v))
      return s
    },
    // separatore delle migliaia anche a 4 cifre (1.330,11 €), come nelle app delle banche
    money: (n, currency) => new Intl.NumberFormat(lang, { style: 'currency', currency, useGrouping: 'always' as unknown as boolean }).format(n),
    date: (iso, opts = { day: 'numeric', month: 'short' }) =>
      new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')),
  }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
