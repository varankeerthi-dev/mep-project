// src/main.tsx
import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
// Font faces must be imported from JS rather than from index.css.
// @tailwindcss/postcss resolves CSS @import itself and inlines the file text,
// which leaves url() pointing at node_modules-relative ./files/*.woff2 paths that
// Vite never emits. Production builds shipped all 18 of those requests as 404s
// falling through to the SPA index.html. Importing the same packages from JS
// routes them through Vite's own CSS pipeline, which writes the woff2 assets.
// Found during audit FE-012; do not move these back into index.css.
// The explicit /index.css paths are deliberate: vite/client declares module
// '*.css', whereas the bare specifier only type-checks for the packages that
// happen to ship a .d.css.ts, which @fontsource-variable/geist does not.
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import App from './App'
import { queryClient } from './queryClient'

type ErrorBoundaryProps = {
  children?: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#666' }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', marginTop: 20, cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
