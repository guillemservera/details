export type Platform = 'mac' | 'ios' | 'windows' | 'linux' | 'android' | 'chromeos' | 'unknown'

/** The subset of `Navigator` that platform detection reads. */
export interface NavigatorLike {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  userAgentData?: { platform?: string }
}

/**
 * Detects the operating system from User-Agent Client Hints, falling back to the
 * user agent string. Returns `'unknown'` without a navigator (SSR).
 */
export function detectPlatform(
  nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Platform {
  if (!nav) return 'unknown'
  const source = nav.userAgentData?.platform || `${nav.userAgent ?? ''} ${nav.platform ?? ''}`

  if (/iPhone|iPad|iPod|iOS/i.test(source)) return 'ios'
  // iPadOS reports a desktop Mac user agent; only the touch points give it away.
  if (/Mac/i.test(source)) return (nav.maxTouchPoints ?? 0) > 1 ? 'ios' : 'mac'
  if (/Win/i.test(source)) return 'windows'
  // Android and ChromeOS user agents also mention Linux.
  if (/Android/i.test(source)) return 'android'
  if (/CrOS|Chrome ?OS/i.test(source)) return 'chromeos'
  if (/Linux|X11/i.test(source)) return 'linux'
  return 'unknown'
}

export function isApplePlatform(platform: Platform): boolean {
  return platform === 'mac' || platform === 'ios'
}
