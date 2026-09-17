<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import DemoList from './DemoList.vue'
import Segmented from '../../components/Segmented.vue'
import { axes, copy, counts, initialState, PLAIN_MAX, playgroundSnippet, renderers, type PlaygroundMode } from '../playground'

const props = defineProps<{ mode: PlaygroundMode }>()

const s = reactive({ ...initialState })
watch(() => s.count, (v) => {
  if (v > PLAIN_MAX) s.renderer = 'virtual'
})

const snippet = computed(() => playgroundSnippet(props.mode, s))
</script>

<template>
  <header>
    <h1>{{ copy[mode].title }}</h1>
    <p>{{ copy[mode].text }}</p>
  </header>

  <section class="card">
    <div v-if="mode === 'compare'" class="compare" :class="s.axis">
      <figure>
        <figcaption>:hover</figcaption>
        <DemoList :key="`native-${s.axis}`" v-bind="s" mode="native" :keyboard="false" bare />
      </figure>
      <figure>
        <figcaption>useProximityHover</figcaption>
        <DemoList :key="`proximity-${s.axis}`" v-bind="s" mode="proximity" :keyboard="false" bare />
      </figure>
    </div>
    <DemoList v-else :key="`${mode}-${s.axis}-${s.keyboard}`" :mode="mode" v-bind="s" />

    <div class="controls">
      <div class="control">
        <span class="label">axis</span>
        <Segmented v-model="s.axis" :options="axes" />
      </div>
      <div class="control">
        <span class="label">renderer</span>
        <Segmented v-model="s.renderer" :options="renderers(s.count)" />
      </div>
      <div class="control">
        <span class="label">items</span>
        <Segmented v-model="s.count" :options="counts" />
      </div>
      <template v-if="mode !== 'compare'">
        <template v-if="mode === 'proximity'">
          <label class="control">
            <span class="label">keyboard</span>
            <input v-model="s.keyboard" class="switch" type="checkbox">
          </label>
          <label class="control">
            <span class="label">reducedMotion</span>
            <input v-model="s.reducedMotion" class="switch" type="checkbox">
          </label>
        </template>
        <label class="control">
          <span class="label">resumeDistance</span>
          <span class="slider">
            <input v-model.number="s.resumeDistance" :style="{ '--p': s.resumeDistance / 40 }" type="range" min="0" max="40" step="1">
            <output>{{ s.resumeDistance }}px</output>
          </span>
        </label>
        <template v-if="mode === 'keyboard' || s.keyboard">
          <label class="control">
            <span class="label">loop</span>
            <input v-model="s.loop" class="switch" type="checkbox">
          </label>
          <label class="control">
            <span class="label">whileHovered</span>
            <input v-model="s.whileHovered" class="switch" type="checkbox">
          </label>
        </template>
      </template>
    </div>

    <div class="code">
      <pre>{{ snippet }}</pre>
    </div>
  </section>
</template>
