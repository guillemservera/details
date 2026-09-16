import { defineConfig } from 'tsdown'

// One module per source file (unbundle), so every subpath only loads what it imports.
export default defineConfig({
  entry: ['src/index.ts', 'src/*/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  unbundle: true,
  tsconfig: 'tsconfig.build.json',
  exports: true,
})
