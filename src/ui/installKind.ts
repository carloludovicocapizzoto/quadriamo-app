// Che dispositivo e browser è, per mostrare i passaggi giusti per aggiungere l'app alla Home o installarla.
export type Kind =
  | 'ios' | 'ios-other'                                                        // iPhone/iPad: Safari, oppure Chrome e altri
  | 'android' | 'android-samsung' | 'android-firefox' | 'android-other'        // Android: Chrome, Samsung Internet, Firefox, altri
  | 'chromium' | 'safari-mac' | 'firefox'                                       // computer

export function detectKind(ua = navigator.userAgent, touch = navigator.maxTouchPoints): Kind {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios'
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return 'android-samsung'
    if (/Firefox\//.test(ua)) return 'android-firefox'
    if (/EdgA|OPR\/|YaBrowser|MiuiBrowser|HuaweiBrowser|UCBrowser|DuckDuckGo|Brave/.test(ua)) return 'android-other'
    return 'android'
  }
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'safari-mac'
  return 'chromium'
}

/** I browser che si possono scegliere a mano ("Usi un altro browser?"), per tipo di dispositivo. */
export const CHOICES: Record<'ios' | 'android' | 'desktop', [Kind, string][]> = {
  ios: [['ios', 'Safari'], ['ios-other', 'Chrome / Edge / Firefox']],
  android: [['android', 'Chrome'], ['android-samsung', 'Samsung Internet'], ['android-firefox', 'Firefox'], ['android-other', '…']],
  desktop: [['chromium', 'Chrome / Edge'], ['safari-mac', 'Safari (Mac)'], ['firefox', 'Firefox']],
}
export const familyOf = (k: Kind): keyof typeof CHOICES => (k.startsWith('ios') ? 'ios' : k.startsWith('android') ? 'android' : 'desktop')
