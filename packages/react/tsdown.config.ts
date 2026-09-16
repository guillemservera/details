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
  // Hooks run on the client; the directive lets React Server Component frameworks import them.
  banner: { js: "'use client'" },
})
