<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, shallowRef, useId, useTemplateRef } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useArrowNavigation, useHighlightIndicator, useProximityHover } from '@guillemservera/vue-details'
import { itemLabel as label } from '../playground'

// Composables are set up once: the parent re-keys this component when mode, axis or keyboard change.
const props = defineProps<{
  /** native: no composables, CSS :hover only (the baseline in compare mode). */
  mode: 'proximity' | 'keyboard' | 'native'
  /** Hide the stats column (compare mode). */
  bare?: boolean
  axis: 'x' | 'y'
  renderer: 'plain' | 'virtual'
  count: number
  keyboard: boolean
  resumeDistance: number
  loop: boolean
  whileHovered: boolean
  reducedMotion?: boolean
}>()

const list = useTemplateRef<HTMLElement>('list')
const horizontal = props.axis === 'x'
// With keyboard navigation the list is one focusable menu; without it, items keep their natural tab order.
const navigable = props.mode === 'keyboard' || props.keyboard
const uid = useId()
const SIZE = horizontal ? 120 : 40

// TanStack Virtual is used only by this demo, not by the details packages.
const virtualizer = useVirtualizer(computed(() => ({
  count: props.count,
  horizontal,
  getScrollElement: () => list.value,
  estimateSize: () => SIZE,
  gap: 4,
  overscan: 6,
})))

let highlight
if (props.mode === 'proximity') {
  highlight = useProximityHover(list, {
    axis: props.axis,
    resumeDistance: () => props.resumeDistance,
  })
  useHighlightIndicator(list, useTemplateRef('indicator'), {
    // Off follows the OS setting.
    reducedMotion: () => props.reducedMotion || undefined,
  })
}
if (navigable) {
  highlight = useArrowNavigation(list, {
    axis: props.axis,
    loop: () => props.loop,
    whileHovered: () => props.whileHovered,
    resumeDistance: () => props.resumeDistance,
    count: () => (props.renderer === 'virtual' ? props.count : undefined),
    scrollToIndex: i => virtualizer.value.scrollToIndex(i, { align: 'auto' }),
  })
}
const { highlighted, source } = highlight ?? { highlighted: shallowRef<HTMLElement | null>(null), source: shallowRef(null) }

const offset = (start: number) => (horizontal ? `translateX(${start}px)` : `translateY(${start}px)`)

// Stats: worst frame in the last 500ms, item nodes in the DOM, last click.
const stats = reactive({ worst: 0, nodes: 0, clicked: '—' })
let raf = 0
let prev = performance.now()
let worst = 0
let windowStart = prev
const tick = (now: number) => {
  worst = Math.max(worst, now - prev)
  prev = now
  if (now - windowStart > 500) {
    stats.worst = Math.round(worst)
    stats.nodes = list.value?.querySelectorAll('[data-highlight-item]').length ?? 0
    worst = 0
    windowStart = now
  }
  raf = requestAnimationFrame(tick)
}
onMounted(() => {
  if (!props.bare) raf = requestAnimationFrame(tick) // hidden stats don't need a collector
})
onScopeDispose(() => cancelAnimationFrame(raf))

const highlightedIndex = computed(() => highlighted.value?.dataset.index)
const onItemClick = (e: MouseEvent) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-highlight-item]')?.dataset.index
  if (i) stats.clicked = label(+i)
}
</script>

<template>
  <div class="stage" :class="[axis, { bare }]">
    <div
      ref="list"
      class="list"
      :class="[axis, mode]"
      aria-label="Items"
      :tabindex="navigable ? 0 : undefined"
      :role="navigable ? 'menu' : undefined"
      :aria-orientation="navigable ? (horizontal ? 'horizontal' : 'vertical') : undefined"
      :aria-activedescendant="navigable ? highlighted?.id : undefined"
      @click="onItemClick"
    >
      <div v-if="mode === 'proximity'" ref="indicator" aria-hidden="true" class="indicator" />
      <div
        v-if="renderer === 'virtual'"
        class="virtual-body"
        :style="horizontal ? { width: `${virtualizer.getTotalSize()}px` } : { height: `${virtualizer.getTotalSize()}px` }"
      >
        <button
          v-for="row in virtualizer.getVirtualItems()"
          :key="row.key as number"
          data-highlight-item
          :data-index="row.index"
          :id="`${uid}-${row.index}`"
          :role="navigable ? 'menuitem' : undefined"
          :tabindex="navigable ? -1 : undefined"
          class="item virtual"
          :style="{ transform: offset(row.start) }"
        >
          {{ label(row.index) }}
        </button>
      </div>
      <!-- v-memo: stats/highlight updates re-render this component; don't diff 10k items for them -->
      <div v-else v-memo="[count]" class="plain-body">
        <button
          v-for="i in count"
          :id="`${uid}-${i - 1}`"
          :key="i"
          data-highlight-item
          :data-index="i - 1"
          :role="navigable ? 'menuitem' : undefined"
          :tabindex="navigable ? -1 : undefined"
          class="item"
        >
          {{ label(i - 1) }}
        </button>
      </div>
    </div>

    <dl v-if="!bare" class="stats">
      <div><dt>highlighted</dt><dd>{{ highlightedIndex ? label(+highlightedIndex) : '—' }}</dd></div>
      <div><dt>source</dt><dd>{{ source ?? '—' }}</dd></div>
      <div><dt>clicked</dt><dd>{{ stats.clicked }}</dd></div>
      <div><dt>DOM items</dt><dd>{{ stats.nodes.toLocaleString('en-US') }}</dd></div>
      <div><dt>worst frame</dt><dd :class="{ bad: stats.worst > 34 }">{{ stats.worst }}ms</dd></div>
    </dl>
  </div>
</template>
