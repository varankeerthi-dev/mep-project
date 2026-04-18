import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** If true, logs errors to console in development */
  logErrors?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * Catches React errors in child components and displays a fallback UI.
 * This prevents the entire app from crashing when a single page throws an error.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<CustomErrorPage />}>
 *   <Suspense fallback={<Loading />}>
 *     <LazyComponent />
 *   </Suspense>
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { logErrors = true, onError } = this.props;

    this.setState({ errorInfo });

    if (logErrors && import.meta.env.DEV) {
      console.group('🔴 Error Boundary Caught:');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT ERROR FALLBACK UI
// ═══════════════════════════════════════════════════════════════════════════════

interface DefaultErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

function DefaultErrorFallback({ error, errorInfo, onRetry }: DefaultErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600">
            We encountered an unexpected error. Please try again or contact support if the problem persists.
          </p>
        </div>

        {isDev && error && (
          <div className="mb-6 text-left">
            <details className="bg-gray-50 rounded-lg p-4 text-sm">
              <summary className="font-medium text-gray-700 cursor-pointer">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 p-3 bg-white rounded border border-gray-200 overflow-auto max-h-40 text-xs">
                <code className="text-red-600">{error.message}</code>
              </pre>
              {errorInfo?.componentStack && (
                <pre className="mt-2 p-3 bg-white rounded border border-gray-200 overflow-auto max-h-40 text-xs">
                  <code className="text-gray-600">
                    {errorInfo.componentStack.split('\n').slice(0, 5).join('\n')}
                  </code>
                </pre>
              )}
            </details>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="default">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ERROR BOUNDARY WRAPPER
// Use this to wrap individual page Suspense boundaries
// ═══════════════════════════════════════════════════════════════════════════════

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
}

export function PageErrorBoundary({ children, pageName = 'Page' }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      logErrors={true}
      onError={(error) => {
        // In production, you might want to send this to an error tracking service
        console.error(`[${pageName}] Error:`, error.message);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
