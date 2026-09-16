<script setup lang="ts">
import { onMounted, shallowRef, watch } from 'vue'
import { demos, type Demo, type Framework } from '../demos'
import Segmented from './Segmented.vue'

// One Vue island on every page, React ones included, so theme and cursor behave identically on both.
const props = defineProps<{ framework: Framework, demo: Demo }>()

type Theme = 'system' | 'light' | 'dark'
type Cursor = 'default' | 'pointer'

const frameworks = [{ value: 'vue', label: 'vue' }, { value: 'react', label: 'react' }] as const
const themes = [{ value: 'system', label: 'system' }, { value: 'light', label: 'light' }, { value: 'dark', label: 'dark' }] as const
const cursors = [{ value: 'default', label: 'default' }, { value: 'pointer', label: 'pointer' }] as const

const go = (framework: Framework, demo: Demo) => location.assign(`/${framework}/${demo}`)

// Server render uses the defaults; the layout's inline script has already put the stored choice on <html>.
const theme = shallowRef<Theme>('system')
const cursor = shallowRef<Cursor>('default')
onMounted(() => {
  const root = document.documentElement.dataset
  theme.value = root.theme as Theme
  cursor.value = root.cursor as Cursor
  watch([theme, cursor], ([t, c]) => {
    root.theme = t
    root.cursor = c
    try {
      localStorage.setItem('pg-theme', t)
      localStorage.setItem('pg-cursor', c)
    }
    catch { /* storage blocked: the choice lasts for this visit */ }
  })
})
</script>

<template>
  <div class="topbar">
    <div class="topbar-options">
      <Segmented :model-value="framework" :options="frameworks" @update:model-value="f => go(f, props.demo)" />
      <Segmented :model-value="demo" :options="demos" @update:model-value="d => go(props.framework, d)" />
    </div>
    <div class="topbar-options">
      <Segmented v-model="theme" :options="themes" />
      <Segmented v-model="cursor" :options="cursors" />
    </div>
  </div>
</template>
