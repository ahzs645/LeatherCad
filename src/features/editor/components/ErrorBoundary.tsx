import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, resetErrorBoundary: () => void) => ReactNode)
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.resetErrorBoundary)
        }
        return this.props.fallback
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            gap: '1rem',
            minHeight: '120px',
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            margin: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.4rem 1rem',
              border: '1px solid #b91c1c',
              borderRadius: '4px',
              background: '#fff',
              color: '#b91c1c',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback?: ErrorBoundaryProps['fallback'],
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WithErrorBoundaryWrapper.displayName = `withErrorBoundary(${displayName})`
  return WithErrorBoundaryWrapper
}
