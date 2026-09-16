import { describe, expect, it, vi } from 'vitest'

import { detectPlatform, isApplePlatform } from '../../src/platform'

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  chromeos: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
}

describe('detectPlatform', () => {
  it('parses user agent strings', () => {
    expect(detectPlatform({ userAgent: UA.mac, maxTouchPoints: 0 })).toBe('mac')
    expect(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 })).toBe('ios')
    expect(detectPlatform({ userAgent: UA.windows })).toBe('windows')
    expect(detectPlatform({ userAgent: UA.linux })).toBe('linux')
    expect(detectPlatform({ userAgent: UA.android })).toBe('android')
    expect(detectPlatform({ userAgent: UA.chromeos })).toBe('chromeos')
    expect(detectPlatform({ userAgent: 'Mozilla/5.0' })).toBe('unknown')
  })

  it('detects iPadOS reporting a desktop Mac user agent', () => {
    expect(detectPlatform({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios')
  })

  it('falls back to navigator.platform', () => {
    expect(detectPlatform({ userAgent: '', platform: 'Win32' })).toBe('windows')
    expect(detectPlatform({ userAgent: '', platform: 'MacIntel' })).toBe('mac')
  })

  it('prefers User-Agent Client Hints', () => {
    expect(detectPlatform({ userAgent: UA.linux, userAgentData: { platform: 'Windows' } })).toBe('windows')
    expect(detectPlatform({ userAgent: UA.linux, userAgentData: { platform: 'macOS' } })).toBe('mac')
    expect(detectPlatform({ userAgent: UA.linux, userAgentData: { platform: 'Chrome OS' } })).toBe('chromeos')
    expect(detectPlatform({ userAgent: UA.linux, userAgentData: { platform: 'Android' } })).toBe('android')
    expect(detectPlatform({ userAgent: UA.windows, userAgentData: { platform: '' } })).toBe('windows')
  })

  it('returns unknown without a navigator', () => {
    vi.stubGlobal('navigator', undefined)
    expect(detectPlatform()).toBe('unknown')
    vi.unstubAllGlobals()
  })

  it('groups Apple platforms', () => {
    expect(isApplePlatform('mac')).toBe(true)
    expect(isApplePlatform('ios')).toBe(true)
    expect(isApplePlatform('windows')).toBe(false)
  })
})
