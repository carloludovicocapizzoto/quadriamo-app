import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { useI18n } from '../../i18n/core'
import { parseAmount } from './amount'
import { amountText, groupTyping } from './amount'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> & {
  value?: string                          // testo controllato dal genitore…
  defaultValue?: number | null            // …oppure valore di partenza, e il campo tiene il suo testo
  onChange?: (text: string) => void
  onValue?: (n: number | null) => void
}

/** Il campo per tutti gli importi: separatore delle migliaia mentre scrivi, cursore che resta dove stava. */
export function AmountInput({ value, defaultValue, onChange, onValue, ...rest }: Props) {
  const { lang } = useI18n()
  const [own, setOwn] = useState(() => amountText(defaultValue, lang))
  const text = value ?? own
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  // dopo il nuovo testo, il cursore torna dopo lo stesso numero di cifre di prima
  useLayoutEffect(() => {
    const el = ref.current, want = caret.current
    if (!el || want == null || document.activeElement !== el) return
    caret.current = null
    let pos = 0, digits = 0
    if (want < 0) pos = text.length
    else while (pos < text.length && digits < want) { if (/\d/.test(text[pos])) digits++; pos++ }
    el.setSelectionRange(pos, pos)
  }, [text])
  return (
    <input ref={ref} inputMode="decimal" autoComplete="off" {...rest} value={text}
      onChange={e => {
        const raw = e.target.value, at = e.target.selectionStart ?? raw.length
        // scrivendo in fondo il cursore resta in fondo; in mezzo, dopo lo stesso numero di cifre
        caret.current = at >= raw.length ? -1 : raw.slice(0, at).replace(/\D/g, '').length
        const next = groupTyping(raw, lang)
        if (value == null) setOwn(next)
        onChange?.(next)
        onValue?.(parseAmount(next, lang))
      }} />
  )
}
