// Nome visibile di bucket e categorie: se l'utente non l'ha cambiato (nome = id) si usa la traduzione.
import type { Bucket, Category } from '../engine'
import type { Dict } from '../i18n/en'

type T = (key: keyof Dict) => string

export function bucketName(b: Bucket, t: T): string {
  const key = `b.${b.id}` as keyof Dict
  return b.name && b.name !== b.id ? b.name : (t(key) || b.id)
}

export function categoryName(c: Category | undefined, t: T): string {
  if (!c) return '?'
  const key = `c.${c.id}` as keyof Dict
  return c.name && c.name !== c.id ? c.name : (t(key) || c.id)
}

export const BUCKET_COLORS = ['var(--b1)', 'var(--b2)', 'var(--b3)', 'var(--b4)']

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BRL', 'MXN']

/** Valuta suggerita dalla lingua/regione del browser. */
export function guessCurrency(langs: readonly string[] = navigator.languages ?? [navigator.language]): string {
  const map: Record<string, string> = { US: 'USD', GB: 'GBP', CH: 'CHF', CA: 'CAD', AU: 'AUD', JP: 'JPY', SE: 'SEK',
    NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BR: 'BRL', MX: 'MXN' }
  for (const l of langs) {
    const region = l.split('-')[1]?.toUpperCase()
    if (region && map[region]) return map[region]
  }
  return 'EUR'
}
