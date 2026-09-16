<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef } from 'vue'
import { textExamples as examples } from '../playground'
import { useMorphText } from '@guillemservera/vue-details'

const text = ref('Make every word count.')
const duration = ref(600)
const blur = ref(0.2)
const animated = ref(true)
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useMorphText(source, viewport, { duration, blur, animated })

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
import { useMorphText } from '@guillemservera/vue-details/morph-text'

const text = ref(${JSON.stringify(text.value)})
const duration = ref(${duration.value})
const blur = ref(${blur.value})
const animated = ref(${animated.value})
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useMorphText(source, viewport, { duration, blur, animated })

// Template — put typography on the common parent:
<span style="position: relative; display: inline-block; white-space: pre">
  <span ref="source" style="display: inline-block; min-height: 1lh">{{ text }}</span>
  <span ref="viewport" aria-hidden="true"></span>
</span>`)
</script>

<template>
  <header>
    <h1>useMorphText</h1>
    <p>A blur morph blends whole phrases through a soft crossfade, not literal glyph interpolation. Interrupt or return to a phrase without restarting its visible effect.</p>
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
      <label class="control">
        <span class="label">Blur</span>
        <span class="slider">
          <input v-model.number="blur" :style="{ '--p': blur / 0.6 }" type="range" min="0" max="0.6" step="0.02">
          <output>{{ blur.toFixed(2) }}em</output>
        </span>
      </label>
      <label class="control">
        <span class="label">Animated</span>
        <input v-model="animated" class="switch" type="checkbox">
      </label>
    </div>

    <div class="code"><pre>{{ snippet }}</pre></div>
  </section>
</template>
