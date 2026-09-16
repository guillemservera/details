import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createArrowNavigation, revealItem, type ArrowNavigationOptions } from '../../src/arrow-navigation/createArrowNavigation'
import { createHighlightStore } from '../../src/shared/highlight'
import { append, cleanup, frames, h, highlighted, item, track } from './helpers'

afterEach(cleanup)

function list(children: Node[], options: ArrowNavigationOptions = {}) {
  const el = append(h('div', { tabindex: '0' }, children))
  const navigation = track(createArrowNavigation(el, options))
  return { el, navigation }
}

describe('keys', () => {
  it('activates the highlighted item, not a previously focused one', async () => {
    const clicks: string[] = []
    const items = ['A', 'B', 'C'].map((label) => {
      const button = item(label)
      button.addEventListener('click', () => clicks.push(label))
      return button
    })
    const { el } = list(items)
    items[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(highlighted(el)).toBe('B')
    expect(clicks).toEqual(['B'])
  })

  it('activates the focused item after tabbing away from a keyboard highlight', async () => {
    const clicks: string[] = []
    const items = ['A', 'B'].map((label) => {
      const button = item(label, { tabindex: '0' })
      button.addEventListener('click', () => clicks.push(label))
      return button
    })
    const control = h('button')
    control.addEventListener('click', () => clicks.push('control'))
    const { el } = list([...items, control])
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Tab}')
    expect(document.activeElement).toBe(items[0])
    await userEvent.keyboard('{Enter}')
    expect(clicks).toEqual(['A'])
    expect(highlighted(el)).toBe('A')
    await userEvent.keyboard('{ArrowDown}{Tab}{Tab}{Tab}{Enter}')
    expect(document.activeElement).toBe(control)
    expect(clicks).toEqual(['A', 'control'])
    expect(highlighted(el)).toBeNull()
  })

  it('ignores editable targets and modified keys', async () => {
    const input = h('input')
    const { el } = list([input, item('A'), item('B')])
    const outside = append(h('button'))
    input.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(el)).toBeNull()
    expect(document.activeElement).toBe(input)

    outside.focus()
    await userEvent.hover(el.querySelectorAll('button')[0]!)
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}')
    expect(document.activeElement).toBe(outside)
    expect(highlighted(el)).toBe('A')
  })

  it('works while hovered, without focusing first', async () => {
    const { el } = list([item('A'), item('B'), item('C')])
    await userEvent.hover(el.querySelectorAll('button')[0]!)
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(el)).toBe('B')
    expect(document.activeElement).toBe(el)
  })

  it('reads getter options on every key', async () => {
    let loop = false
    const { el } = list([item('A'), item('B')], { loop: () => loop })
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(highlighted(el)).toBe('B')
    loop = true
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(el)).toBe('A')
  })
})

describe('disabled and removed items', () => {
  it('skips disabled items', async () => {
    const { el } = list([item('A'), item('B', { 'aria-disabled': 'true' }), item('C')])
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(highlighted(el)).toBe('C')
  })

  it('skips rendered disabled items of a virtualized list', async () => {
    const items = [0, 1, 2].map(index => item(String(index), { 'data-index': String(index), 'aria-disabled': index === 1 ? 'true' : undefined }))
    const { el } = list(items, { count: 3 })
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(highlighted(el)).toBe('2')
  })

  it('drops the highlight when its item becomes disabled', async () => {
    const { el } = list([item('A'), item('B')])
    el.focus()
    await userEvent.keyboard('{ArrowDown}')
    el.querySelector('[data-highlighted]')!.setAttribute('aria-disabled', 'true')
    await frames(1)
    expect(highlighted(el)).toBeNull()
  })

  it('drops the highlight when its item is removed', async () => {
    const clicks: string[] = []
    const items = ['A', 'B', 'C'].map((label) => {
      const button = item(label)
      button.addEventListener('click', () => clicks.push(label))
      return button
    })
    const { el } = list(items)
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    items[1]!.remove()
    await frames(1)
    expect(highlighted(el)).toBeNull()
    await userEvent.keyboard('{Enter}')
    expect(clicks).toEqual([])
  })

  it('does not activate a highlighted item moved outside its container', async () => {
    let clicks = 0
    const button = item('A')
    button.addEventListener('click', () => clicks++)
    const { el, navigation } = list([button])
    el.focus()
    await userEvent.keyboard('{ArrowDown}')
    append(h('div', {}, [button]))
    await frames(1)
    expect(navigation.store.highlighted).toBeNull()
    expect(button.hasAttribute('data-highlighted')).toBe(false)
    await userEvent.keyboard('{Enter}')
    expect(clicks).toBe(0)
  })

  it('does not follow a row recycled to another index', async () => {
    const { el } = list([0, 1].map(index => item(String(index), { 'data-index': String(index) })), { count: 2 })
    el.focus()
    await userEvent.keyboard('{ArrowDown}')
    const row = el.querySelector('[data-highlighted]')!
    row.setAttribute('data-index', '10')
    await frames(1)
    expect(row.hasAttribute('data-highlighted')).toBe(false)
  })
})

describe('store', () => {
  it('notifies subscribers, and destroy stops listening and clears the highlight', async () => {
    const { el, navigation } = list([item('A'), item('B')])
    const seen: (string | null)[] = []
    const unsubscribe = navigation.store.subscribe(() => seen.push(`${navigation.store.highlighted?.textContent}:${navigation.store.source}`))
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(seen).toEqual(['A:keyboard', 'B:keyboard'])
    expect(el.hasAttribute('data-keyboard-navigation')).toBe(true)
    unsubscribe()
    navigation.destroy()
    expect(highlighted(el)).toBeNull()
    expect(el.hasAttribute('data-keyboard-navigation')).toBe(false)
    expect(seen).toHaveLength(2)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(highlighted(el)).toBeNull()
  })

  it('reconciles a replacement container and clears state after its last detach', async () => {
    const store = createHighlightStore()
    const oldItem = item('old', { 'data-index': '0' })
    const old = list([oldItem], { store })
    old.el.focus()
    await userEvent.keyboard('{ArrowDown}')
    const newItem = item('new', { 'data-index': '0' })
    const replacement = list([newItem], { store })
    old.navigation.destroy()
    expect(store.highlighted).toBe(newItem)
    expect(oldItem.hasAttribute('data-highlighted')).toBe(false)
    replacement.navigation.destroy()
    expect(store.highlighted).toBeNull()
    expect(store.source).toBeNull()
    const next = list([item('next')], { store })
    expect(store.highlighted).toBeNull()
    next.el.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(next.el)).toBe('next')
  })
})

describe('revealItem', () => {
  it('resolves percentage scroll-padding against the scrollport', () => {
    const scroller = append(h('div', { style: 'height: 200px; overflow: auto; scroll-padding-top: 25%' }))
    for (let i = 0; i < 20; i++) scroller.append(h('div', { style: 'height: 40px' }))
    scroller.scrollTop = 400
    const target = scroller.children[9]!
    revealItem(scroller, target, 'y')
    expect(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top).toBeCloseTo(50, 0)
  })
})
