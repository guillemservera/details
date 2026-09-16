import { defineConfig } from 'tsdown'

// One module per source file (unbundle), so `@guillemservera/vue-details/proximity-hover`
// never loads the other composables, and the root barrel tree-shakes the same way.
export default defineConfig({
  entry: ['src/index.ts', 'src/*/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  unbundle: true,
  tsconfig: 'tsconfig.build.json',
  exports: true,
})
