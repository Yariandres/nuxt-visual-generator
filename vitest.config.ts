import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))

// Plain-node Vitest for framework-agnostic server/shared logic. Nuxt aliases are
// mapped so the modules under test resolve the same specifiers they use at
// runtime (`#shared/...`, `~~/server/...`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '#shared': resolve(root, 'shared'),
      '~~': root,
      '~': resolve(root, 'app'),
    },
  },
})
