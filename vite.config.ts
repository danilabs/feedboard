import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const isLibrary = mode === 'library'

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      allowedHosts: true,
    },
    plugins: [
      {
        name: 'serve-feedboard-js',
        configureServer(server) {
          // In dev, serve requests for feedboard.js from source
          server.middlewares.use((req, res, next) => {
            if (req.url === '/feedboard.js' || req.url?.match(/\/feedboard\.js(\?|$)/)) {
              req.url = '/src/index.ts'
            }
            next()
          })
        },
      },
    ],
    build: isLibrary
      ? {
          // Library mode: single feedboard.js bundle for standalone examples
          lib: {
            entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
            name: 'Feedboard',
            fileName: 'feedboard',
            formats: ['es'],
          },
          rollupOptions: {
            // Bundle all dependencies for standalone use
            external: [],
            output: {
              inlineDynamicImports: true,
            },
          },
          outDir: 'dist',
          emptyOutDir: false, // Don't clear dist, we build SPA first
        }
      : {
          // App mode: SPA with code splitting
          outDir: 'dist',
          emptyOutDir: true,
          rollupOptions: {
            input: {
              main: resolve(__dirname, 'index.html'),
            },
          },
        },
  }
})
