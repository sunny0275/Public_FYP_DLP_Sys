import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

const isBuild = process.env.NODE_ENV === 'production' || process.argv.includes('build')
const DEV_PORT = parseInt(process.env.VITE_DEV_PORT || '5173', 10)

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.tsx',
        onstart(options) {
          if (isBuild) {
            return
          }
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            watch: isBuild ? undefined : { clearScreen: false },
            rollupOptions: {
              external: ['electron'],
              output: {
                entryFileNames: '[name].mjs'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.tsx',
        onstart(options) {
          if (isBuild) {
            return
          }
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            watch: isBuild ? undefined : undefined,
            rollupOptions: {
              external: ['electron'],
              output: {
                entryFileNames: '[name].mjs'
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  base: './',
  server: {
    host: '127.0.0.1',
    port: DEV_PORT,
    strictPort: false,
    hmr: {
      port: DEV_PORT + 1
    },
    watch: {
      usePolling: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:18080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: DEV_PORT,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
})
