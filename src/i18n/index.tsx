import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, LANG_KEY, loadDict, type I18n, type I18nStart } from './core'
import { local } from '../storage'

export function I18nProvider({ start, children }: { start: I18nStart; children: ReactNode }) {
  const [{ lang, dict }, setCurrent] = useState(start)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const value = useMemo<I18n>(() => ({
    lang,
    setLang: l => {
      local.set(LANG_KEY, l)
      void loadDict(l).then(d => setCurrent({ lang: l, dict: d }))
    },
    t: (key, vars) => {
      let s: string = dict[key] ?? ''
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v))
      return s
    },
    // separatore delle migliaia anche a 4 cifre (1.330,11 €), come nelle app delle banche
    // il meno è quello tipografico (−), come nei movimenti e nei testi, non il trattino di Intl
    money: (n, currency) => new Intl.NumberFormat(lang, { style: 'currency', currency, useGrouping: 'always' as unknown as boolean })
      .formatToParts(n).map(p => p.type === 'minusSign' ? '−' : p.value).join(''),
    date: (iso, opts = { day: 'numeric', month: 'short' }) =>
      new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')),
  }), [lang, dict])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
