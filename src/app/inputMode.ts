// Tastiera o tocco: l'ultimo modo usato, su <html data-input>. Serve al contorno del fuoco (P2-004): :focus-visible decide
// quando il fuoco va mostrato, questo toglie solo il contorno rimasto appeso dopo un tocco o un clic (per esempio sul
// pulsante a cui torna il fuoco quando si chiude un pannello). Su un iPad o un computer con la tastiera, al primo Tab il
// contorno torna. Niente dati: solo un attributo della pagina.

/** Il modo d'uso dall'ultimo evento: la tastiera (anche Esc, Invio, frecce) o il puntatore (dito, penna, mouse). */
export function inputModeFrom(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'> | { pointerType: string }): 'keyboard' | 'pointer' | null {
  if ('pointerType' in e) return 'pointer'
  // le scorciatoie con Cmd/Ctrl/Alt e i tasti modificatori da soli non sono navigazione da tastiera
  if (e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].includes(e.key)) return null
  return 'keyboard'
}

export function watchInputMode(root: HTMLElement = document.documentElement) {
  const set = (e: KeyboardEvent | PointerEvent) => {
    const mode = inputModeFrom(e)
    if (mode && root.dataset.input !== mode) root.dataset.input = mode
  }
  window.addEventListener('keydown', set, true)
  window.addEventListener('pointerdown', set, true)
}
