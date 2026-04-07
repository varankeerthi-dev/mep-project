import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "sss-q1", 
      project: "javascript-react",
      // If you're running local, make sure you've run `vercel env pull` 
      // or set this token in your terminal.
      authToken: process.env.SENTRY_AUTH_TOKEN, 
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      sonner: path.resolve(__dirname, 'src/sonner.ts')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // --- ADD THIS FOR SENTRY PROFILING ---
    headers: {
      "Document-Policy": "js-profiling",
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Larger chunks = fewer requests = faster subsequent navigation
        manualChunks: {
          // Group heavy vendor libs into single chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@heroicons/react', 'sonner'],
          'vendor-data': ['@tanstack/react-query', '@supabase/supabase-js'],
        }
      }
    }
  }
})