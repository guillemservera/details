<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef } from 'vue'
import { DEFAULT_ALPHABET, rouletteBurst, rouletteExamples as examples } from '../playground'
import { useRouletteText } from '@guillemservera/vue-details'
import Segmented from '../../components/Segmented.vue'

const text = ref('PLAY')
const duration = ref(600)
const direction = ref<'up' | 'down'>('up')
const animated = ref(true)
const blur = ref(0)
const fade = ref(0)
const alphabet = ref(DEFAULT_ALPHABET)
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useRouletteText(source, viewport, { duration, direction, animated, blur, fade, alphabet })

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
  let index = 0
  const tick = () => {
    text.value = rouletteBurst[index++]!
    if (index < rouletteBurst.length) timer = window.setTimeout(tick, 140)
  }
  tick()
}

onScopeDispose(stopBurst)

const snippet = computed(() => `import { ref, useTemplateRef } from 'vue'
import { useRouletteText } from '@guillemservera/vue-details/roulette-text'

const text = ref(${JSON.stringify(text.value)})
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useRouletteText(source, viewport, {
  duration: ${duration.value},
  direction: ${JSON.stringify(direction.value)},
  animated: ${animated.value},
  blur: ${blur.value},
  fade: ${fade.value},
  alphabet: ${JSON.stringify(alphabet.value)},
}) // Each option also accepts a ref or getter.

// Template — put typography on the common parent:
<span style="position: relative; display: inline-block; white-space: pre">
  <span ref="source" style="display: inline-block; min-height: 1lh">{{ text }}</span>
  <span ref="viewport" aria-hidden="true"></span>
</span>`)
</script>

<template>
  <header>
    <h1>useRouletteText</h1>
    <p>Each changing character travels through a vertical slot. Unchanged characters stay put, and new updates continue from the visible position.</p>
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
        <input v-model="text" class="text-input" aria-label="Roulette text" @input="stopBurst">
      </label>
      <div class="control">
        <span class="label">Examples</span>
        <div class="text-actions">
          <button v-for="example in examples" :key="example" type="button" @click="select(example)">{{ example || 'Empty' }}</button>
        </div>
      </div>
      <label class="control">
        <span class="label">Alphabet</span>
        <input v-model="alphabet" class="text-input" type="text" placeholder="Empty skips intermediate glyphs">
      </label>
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
        <span class="label">Blur (em)</span>
        <span class="slider">
          <input v-model.number="blur" :style="{ '--p': blur / 0.2 }" type="range" min="0" max="0.2" step="0.01">
          <output>{{ blur.toFixed(2) }}em</output>
        </span>
      </label>
      <label class="control">
        <span class="label">Fade (%)</span>
        <span class="slider">
          <input v-model.number="fade" :style="{ '--p': fade }" type="range" min="0" max="1" step="0.05">
          <output>{{ Math.round(fade * 100) }}%</output>
        </span>
      </label>
      <label class="control">
        <span class="label">Animated</span>
        <input v-model="animated" class="switch" type="checkbox">
      </label>
      <div class="control">
        <span class="label">Interruption</span>
        <div class="text-actions">
          <button type="button" @click="burst">Rapid update / reversal</button>
        </div>
      </div>
    </div>

    <div class="code">
      <pre>{{ snippet }}</pre>
    </div>
  </section>
</template>
