import { fileURLToPath, URL } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const core = (path: string) => fileURLToPath(new URL(`../core/src/${path}`, import.meta.url))

export default defineConfig({
  // Tests run against the core source, so it does not need to be built first.
  resolve: {
    alias: [
      { find: /^@guillemservera\/details-core$/, replacement: core('index.ts') },
      { find: /^@guillemservera\/details-core\/(.+)$/, replacement: core('$1/index.ts') },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            // System Chrome locally; CI installs Playwright's Chromium.
            provider: playwright({ launchOptions: process.env.CI ? {} : { channel: 'chrome' } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
