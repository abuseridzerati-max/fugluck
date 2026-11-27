import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryState = { hasError: boolean }

export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="ac-fullscreen-center">
          <div className="ac-panel" style={{ maxWidth: 440, padding: '24px', textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: '20px' }}>Something went wrong</h1>
            <p className="ac-text-muted" style={{ margin: '0 0 16px', fontSize: '14px' }}>
              An unexpected error interrupted this screen. Reload to return to Fugluck.
            </p>
            <button type="button" className="ac-btn ac-btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
