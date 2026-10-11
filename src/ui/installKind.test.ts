import { describe, expect, it } from 'vitest'
import { detectKind } from './installKind'

describe('detectKind', () => {
  it('riconosce dispositivi e browser', () => {
    expect(detectKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit Version/26.0 Mobile Safari/604.1', 5)).toBe('ios')
    expect(detectKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit CriOS/140.0 Mobile Safari/604.1', 5)).toBe('ios-other')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605.1.15', 5)).toBe('ios')   // iPad
    expect(detectKind('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Chrome/129 Mobile Safari/537.36', 5)).toBe('android')
    expect(detectKind('Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit SamsungBrowser/27.0 Chrome/125 Mobile Safari/537.36', 5)).toBe('android-samsung')
    expect(detectKind('Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 5)).toBe('android-firefox')
    expect(detectKind('Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/129 Mobile Safari/537.36 EdgA/129', 5)).toBe('android-other')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605.1.15', 0)).toBe('safari-mac')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/129 Safari/537.36', 0)).toBe('chromium')
    expect(detectKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/129 Safari/537.36 Edg/129', 0)).toBe('chromium')
    expect(detectKind('Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0', 0)).toBe('firefox')
  })
})
