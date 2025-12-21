import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/auth': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/api': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
    },
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
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'Feedboard',
      fileName: 'feedboard',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
