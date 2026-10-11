// Che dispositivo/browser è, per mostrare i passaggi giusti per aggiungere l'app alla Home o installarla.
export type Kind = 'ios' | 'android' | 'chromium' | 'safari-mac' | 'firefox'

export function detectKind(ua = navigator.userAgent, touch = navigator.maxTouchPoints): Kind {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'safari-mac'
  return 'chromium'
}
