import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sentryVitePlugin } from "@sentry/vite-plugin";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sentryVitePlugin({
    org: "sss-q1", 
    project: "javascript-react",
    // If you're running local, make sure you've run `vercel env pull` 
    // or set this token in your terminal.
    authToken: process.env.SENTRY_AUTH_TOKEN, 
  }), cloudflare()],
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
  }
})