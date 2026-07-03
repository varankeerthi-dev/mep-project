import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: '0.75rem' }} />
          <h3 style={{ fontWeight: 600, color: '#1f2937', marginBottom: '0.5rem' }}>
            {this.props.tabName} failed to load
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
