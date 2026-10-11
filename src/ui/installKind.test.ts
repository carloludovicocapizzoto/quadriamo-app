import { describe, expect, it } from 'vitest'
import { detectKind } from './installKind'

describe('detectKind', () => {
  it('riconosce i dispositivi', () => {
    expect(detectKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1', 5)).toBe('ios')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605.1.15', 5)).toBe('ios')   // iPad
    expect(detectKind('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Chrome/129 Mobile Safari/537.36', 5)).toBe('android')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605.1.15', 0)).toBe('safari-mac')
    expect(detectKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/129 Safari/537.36', 0)).toBe('chromium')
    expect(detectKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/129 Safari/537.36 Edg/129', 0)).toBe('chromium')
    expect(detectKind('Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0', 0)).toBe('firefox')
  })
})
