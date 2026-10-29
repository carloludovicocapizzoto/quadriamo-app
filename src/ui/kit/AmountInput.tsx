import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { useI18n } from '../../i18n/core'
import { parseAmount } from './amount'
import { amountText, editAmount, unreadableAmount, type AmountEdit } from './amount'

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
  const commit = (at: number, next: string) => {
    caret.current = at
    if (value == null) setOwn(next)
    onChange?.(next)
    onValue?.(parseAmount(next, lang))
  }
  // un importo scritto ma non leggibile (troppi decimali, incollato senza una lettura sicura) si vede subito, non viene corretto in silenzio
  const unreadable = unreadableAmount(text, lang)
  return (
    <input ref={ref} inputMode="decimal" autoComplete="off" {...rest} value={text}
      aria-invalid={rest['aria-invalid'] === true || rest['aria-invalid'] === 'true' || unreadable || undefined}
      onPaste={e => {
        // l'incolla si legge per intero, mai carattere per carattere: «2.35» non deve diventare 235
        const el = e.currentTarget, pasted = e.clipboardData.getData('text/plain')
        const from = el.selectionStart ?? text.length, to = el.selectionEnd ?? text.length
        e.preventDefault()
        const raw = text.slice(0, from) + pasted + text.slice(to)
        const whole = !text.slice(0, from).trim() && !text.slice(to).trim()
        // cifre sole in mezzo a un importo: come scriverle; tutto il resto si legge per intero
        const edit: AmountEdit = !whole && /^\d+$/.test(pasted) ? { kind: 'type' } : { kind: 'insert' }
        commit(whole || edit.kind === 'insert' ? -1 : raw.slice(0, from + pasted.length).replace(/\D/g, '').length,
          editAmount(text, whole ? pasted : raw, lang, edit))
      }}
      onChange={e => {
        const raw = e.target.value, at = e.target.selectionStart ?? raw.length
        const input = e.nativeEvent as InputEvent
        // trascinato o completato dal sistema: come l'incolla
        const block = /^insertFrom|^insertReplacementText$/.test(input.inputType ?? '')
        // scrivendo in fondo il cursore resta in fondo; in mezzo, dopo lo stesso numero di cifre
        commit(at >= raw.length || block ? -1 : raw.slice(0, at).replace(/\D/g, '').length,
          editAmount(text, raw, lang, block ? { kind: 'insert' } : { kind: 'type', data: input.data, caret: at }))
      }} />
  )
}
