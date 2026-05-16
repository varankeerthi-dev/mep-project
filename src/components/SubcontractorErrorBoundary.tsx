import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SubcontractorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[Subcontractor ${this.props.moduleName || 'Module'} Error]:`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '24px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            padding: '32px',
            maxWidth: '480px',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              marginBottom: '16px',
            }}>
              <AlertTriangle size={24} style={{ color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 8px' }}>
              Something went wrong
            </h3>
            <p style={{ fontSize: '14px', color: '#737373', margin: '0 0 20px' }}>
              {this.props.moduleName ? `Error in ${this.props.moduleName}` : 'An unexpected error occurred'}
            </p>
            {this.state.error && (
              <pre style={{
                fontSize: '11px',
                color: '#dc2626',
                background: '#fef2f2',
                padding: '12px',
                borderRadius: '4px',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '120px',
                marginBottom: '16px',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RefreshCcw size={16} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
