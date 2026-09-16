import { cdp } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInputCapabilities } from '../../src/input-capabilities'

const emulateTouch = (enabled: boolean) => cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 5 })

describe('createInputCapabilities in Chrome', () => {
  afterEach(async () => {
    await emulateTouch(false)
  })

  it('reads real media queries and follows touch emulation', async () => {
    const store = createInputCapabilities()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    expect(store.getSnapshot()).toMatchObject({ primaryPointerIsCoarse: false, isTouchFirst: false })

    await emulateTouch(true)
    await expect.poll(() => store.getSnapshot().primaryPointerIsCoarse).toBe(true)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })
})
