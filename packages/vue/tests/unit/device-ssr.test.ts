import { expect, it } from 'vitest'
import { createSSRApp, effectScope, h, nextTick, shallowRef } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useInputCapabilities } from '../../src/input-capabilities/useInputCapabilities'
import { usePlatform } from '../../src/platform/usePlatform'
import { useShortcuts } from '../../src/shortcuts/useShortcuts'

it('renders platform and input defaults and attaches no shortcut listeners on the server', async () => {
  // Node has a `navigator` but no DOM: detection must wait for mount, and listeners must never attach.
  const html = await renderToString(createSSRApp({
    setup() {
      const platform = usePlatform()
      const capabilities = useInputCapabilities()
      const target = shallowRef<HTMLElement | null>(null)
      useShortcuts([{ keys: 'mod_k', handler: () => {} }])
      useShortcuts(() => [], { target })
      return () => h('div', { ref: target }, `${platform.value} ${JSON.stringify(capabilities.value)}`)
    },
  }))
  expect(html).toBe('<div>unknown {&quot;canHover&quot;:false,&quot;hasFinePointer&quot;:false,&quot;primaryPointerIsCoarse&quot;:false,&quot;hasTouch&quot;:false,&quot;isTouchFirst&quot;:false}</div>')
  expect(typeof window).toBe('undefined')
})

it('does not handle shortcuts in a server-side effect scope', async () => {
  const scope = effectScope()
  const target = new EventTarget()
  let handled = false
  try {
    scope.run(() => useShortcuts([{ keys: 'k', handler: () => { handled = true } }], { target, platform: 'linux' }))
    await nextTick()
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }))
    expect(handled).toBe(false)
  }
  finally {
    scope.stop()
  }
})
