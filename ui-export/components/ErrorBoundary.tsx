import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches render-time errors anywhere below it in the
 * tree and renders a recoverable fallback instead of a blank screen.
 *
 * Place one near the root and (optionally) finer-grained ones around
 * heavy sections (the grid, public pages, etc.) so a single broken
 * artifact can't take the whole app down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfacing through the console for now; wire this to Sentry / your
    // logger when you add one.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred. Try refreshing the page."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="rounded-[--radius-card] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              Try again
            </button>
            <button
              onClick={() => {
                this.reset();
                window.location.assign("/");
              }}
              className="rounded-[--radius-card] bg-foreground px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
