<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef } from 'vue'
import { textExamples as examples } from '../playground'
import { useRollingText } from '@guillemservera/vue-details'
import Segmented from '../../components/Segmented.vue'

const text = ref('Make every word count.')
const duration = ref(600)
const direction = ref<'up' | 'down'>('up')
const animated = ref(true)
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useRollingText(source, viewport, { duration, direction, animated })

const directions = [{ value: 'up', label: 'up' }, { value: 'down', label: 'down' }] as const
let timer: number | undefined
function stopBurst() {
  clearTimeout(timer)
}
function select(value: string) {
  stopBurst()
  text.value = value
}
function burst() {
  stopBurst()
  const original = text.value
  text.value = 'A new perspective.'
  timer = window.setTimeout(() => {
    text.value = 'Then something different.'
    timer = window.setTimeout(() => { text.value = original }, 120)
  }, 120)
}
onScopeDispose(stopBurst)

const snippet = computed(() => `import { ref, useTemplateRef } from 'vue'
import { useRollingText } from '@guillemservera/vue-details/rolling-text'

const text = ref(${JSON.stringify(text.value)})
const duration = ref(${duration.value})
const direction = ref(${JSON.stringify(direction.value)})
const animated = ref(${animated.value})
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useRollingText(source, viewport, { duration, direction, animated })

// Template — put typography on the common parent:
<span style="position: relative; display: inline-block; white-space: pre">
  <span ref="source" style="display: inline-block; min-height: 1lh">{{ text }}</span>
  <span ref="viewport" aria-hidden="true"></span>
</span>`)
</script>

<template>
  <header>
    <h1>useRollingText</h1>
    <p>Complete words or phrases slide together as one row. Interrupt or return to a phrase and it continues from where it is.</p>
  </header>

  <section class="card">
    <div class="text-stage">
      <span class="text-frame">
        <span ref="source" style="display: inline-block; min-height: 1lh">{{ text }}</span>
        <span ref="viewport" aria-hidden="true"></span>
      </span>
    </div>

    <div class="controls">
      <label class="control">
        <span class="label">Text</span>
        <input v-model="text" class="text-input" type="text" @input="stopBurst">
      </label>
      <div class="text-actions">
        <button v-for="example in examples" :key="example" type="button" @click="select(example)">{{ example }}</button>
        <button type="button" @click="select('')">Empty</button>
        <button type="button" @click="burst">Burst &amp; return</button>
      </div>
      <label class="control">
        <span class="label">Duration</span>
        <span class="slider">
          <input v-model.number="duration" :style="{ '--p': duration / 2000 }" type="range" min="0" max="2000" step="50">
          <output>{{ duration }}ms</output>
        </span>
      </label>
      <div class="control">
        <span class="label">Direction</span>
        <Segmented v-model="direction" :options="directions" />
      </div>
      <label class="control">
        <span class="label">Animated</span>
        <input v-model="animated" class="switch" type="checkbox">
      </label>
    </div>

    <div class="code"><pre>{{ snippet }}</pre></div>
  </section>
</template>
