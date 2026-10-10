import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Logic only: view-models, services and shared libs. UI components are verified on the TV.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
