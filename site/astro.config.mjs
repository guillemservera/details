import react from '@astrojs/react'
import vue from '@astrojs/vue'
import { defineConfig } from 'astro/config'
import { fileURLToPath, URL } from 'node:url'

const src = (dir, path) => fileURLToPath(new URL(`../packages/${dir}/src/${path}`, import.meta.url))
const packages = { 'vue-details': 'vue', 'react-details': 'react', 'details-core': 'core' }

// @vitejs/plugin-vue compiles <script lang="ts"> with Vite's oxc options, which include React's
// jsx.refresh, so .vue modules got `$RefreshSig$` calls. Vite's own oxc plugin has already copied
// the options by configResolved, so React Fast Refresh keeps working.
const vueWithoutReactRefresh = {
  name: 'vue-without-react-refresh',
  apply: 'serve',
  configResolved(config) {
    if (config.oxc) config.oxc = { ...config.oxc, jsx: { ...config.oxc.jsx, refresh: false } }
  },
}

export default defineConfig({
  integrations: [vue(), react()],
  server: { host: '0.0.0.0', port: 5175 },
  devToolbar: { enabled: false },
  redirects: { '/vue': '/vue/proximity', '/react': '/react/proximity' },
  vite: {
    plugins: [vueWithoutReactRefresh],
    resolve: {
      // Develop and build against the package sources, never dist.
      alias: Object.entries(packages).flatMap(([name, dir]) => [
        { find: new RegExp(`^@guillemservera/${name}$`), replacement: src(dir, 'index.ts') },
        { find: new RegExp(`^@guillemservera/${name}/(.+)$`), replacement: src(dir, '$1/index.ts') },
      ]),
    },
  },
})
