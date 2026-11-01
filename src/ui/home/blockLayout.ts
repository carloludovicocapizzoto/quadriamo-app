// I quattro blocchi della Home: quante colonne e quanto grandi gli importi. Mai numeri microscopici (QA 1/11: a 320 px gli
// importi scendevano a 7-9 px): quattro colonne solo se l'importo più lungo ci sta ad almeno 14 px, altrimenti due per riga;
// se nemmeno così, la valuta va sulla riga sotto, per tutti e quattro i blocchi insieme. Mai troncati, mai fuori dalla colonna.

export const BLOCK_FONT = 15, BLOCK_MIN = 14
// larghezza media di un carattere in em, con margine: misurata nel browser fino a .604 su «−247.361,500 KWD» (a .6 usciva di 1 px)
export const CHAR = .64

export interface BlockLayout { cols: 1 | 2 | 4; split: boolean; font: number }

/**
 * `width`: la larghezza della fila dei blocchi; `full`: i caratteri dell'importo più lungo con la valuta; `digits`: senza la
 * valuta (segno e decimali compresi); `gap`: lo spazio fra le colonne. Tutto in px CSS.
 */
export function blockLayout(width: number, full: number, digits: number, gap = 8): BlockLayout {
  const fit = (cols: number, chars: number) => (width - gap * (cols - 1)) / cols / (Math.max(1, chars) * CHAR)
  for (const cols of [4, 2] as const) {
    const font = fit(cols, full)
    if (font >= BLOCK_MIN) return { cols, split: false, font: Math.min(BLOCK_FONT, font) }
  }
  // importi enormi: la valuta a capo; se nemmeno le sole cifre ci stanno a 14 px, un blocco per riga
  const split = fit(2, digits)
  if (split >= BLOCK_MIN) return { cols: 2, split: true, font: Math.min(BLOCK_FONT, split) }
  return { cols: 1, split: false, font: Math.min(BLOCK_FONT, fit(1, full)) }
}

/** I caratteri di un importo come lo mostra l'app, con e senza la valuta. */
export function amountChars(value: number, currency: string, lang: string): { full: number; digits: number } {
  const parts = new Intl.NumberFormat(lang, { style: 'currency', currency, useGrouping: 'always' as unknown as boolean }).formatToParts(value)
  const full = parts.map(p => p.value).join('').length
  const digits = parts.filter(p => p.type !== 'currency').map(p => p.value).join('').trim().length
  return { full, digits }
}
