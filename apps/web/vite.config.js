import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },

  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@heroicons')) {
            return 'vendor-icons';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          if (
            id.includes('node_modules/@tanstack/react-query') ||
            id.includes('node_modules/@supabase')
          ) {
            return 'vendor-data';
          }
          if (id.includes('node_modules/sonner')) {
            return 'vendor-ui';
          }
        }
      }
    }
  },
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.eot'],
  optimizeDeps: {
    include: ['@fontsource-variable/geist']
  }
})