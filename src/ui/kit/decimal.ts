/** Quantità e prezzi unitari: un singolo punto o virgola è sempre decimale, senza arrotondare ai centesimi. */
export function parseDecimal(raw: string): number | null {
  let s = raw.replace(/\s/g, '')
  if (s.includes(',') && s.includes('.')) {
    const comma = s.lastIndexOf(',') > s.lastIndexOf('.')
    if (!(comma ? /^[+-]?\d{1,3}(\.\d{3})+,\d+$/ : /^[+-]?\d{1,3}(,\d{3})+\.\d+$/).test(s)) return null
    s = s.split(comma ? '.' : ',').join('')
  }
  // Due o più gruppi da tre sono migliaia; un separatore solo resta decimale.
  if (/^[+-]?\d{1,3}(?:\.\d{3}){2,}$/.test(s) || /^[+-]?\d{1,3}(?:,\d{3}){2,}$/.test(s)) s = s.replace(/[.,]/g, '')
  s = s.replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function decimalText(n: number | null | undefined, lang: string): string {
  return n == null ? '' : new Intl.NumberFormat(lang, { useGrouping: false, maximumSignificantDigits: 21 }).format(n)
}
