<script setup lang="ts" generic="T extends string | number">
import { useTemplateRef } from 'vue'
import { useHighlightIndicator, useProximityHover } from '@guillemservera/vue-details'

defineProps<{ options: readonly { value: T, label: string, disabled?: boolean }[] }>()
const model = defineModel<T>({ required: true })

// Dogfooding: the selected pill glides with v-model; hover only tints the nearest segment's text.
const root = useTemplateRef<HTMLElement>('root')
useProximityHover(root, { axis: 'xy' }) // segments wrap onto a second row on narrow screens
useHighlightIndicator(root, useTemplateRef('selected'), { target: '[aria-pressed="true"]', motion: 'moderate' })
</script>

<template>
  <div ref="root" class="segmented">
    <div ref="selected" aria-hidden="true" class="segmented-selected" />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      data-highlight-item
      :aria-pressed="model === option.value"
      :disabled="option.disabled"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
