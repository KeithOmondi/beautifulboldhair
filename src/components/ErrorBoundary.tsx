import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last line of defence: a crash shows a calm message and a way out, never a blank white page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
        <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-stone-600">We hit an unexpected problem. Your information is safe. Please reload the page and try again.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-stone-800">Reload page</button>
          <a href="/" className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-5 text-sm font-medium text-stone-800 hover:bg-stone-50">Go to home</a>
        </div>
      </div>
    );
  }
}
