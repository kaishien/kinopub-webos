import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// webOS loads the app from file://, where Chrome won't run <script type="module">:
// build a single classic IIFE bundle and strip module/crossorigin from index.html.
function classicScript(): Plugin {
  return {
    name: 'classic-script',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/ crossorigin/g, '')
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
    },
  }
}

const appinfo = JSON.parse(readFileSync(new URL('./webos/appinfo.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appinfo.version) },
  plugins: [react(), classicScript()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  build: {
    target: 'chrome120',
    modulePreload: false,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: { host: true, port: 5173 },
})
