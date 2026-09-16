// One page per demo and framework: /vue/<value> and /react/<value>.
export const demos = [
  { value: 'proximity', label: 'proximity' },
  { value: 'keyboard', label: 'keyboard' },
  { value: 'compare', label: 'compare' },
  { value: 'rolling', label: 'rolling text' },
  { value: 'morph', label: 'morph text' },
  { value: 'roulette', label: 'roulette text' },
] as const

export type Demo = (typeof demos)[number]['value']
export type Framework = 'vue' | 'react'
