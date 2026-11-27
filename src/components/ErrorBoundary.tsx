import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error && parsed.operationType) {
        message = `Cloud sync (${parsed.operationType} on ${parsed.path ?? 'resource'}): ${parsed.error}`;
      }
    } catch {
      // plain text error
    }
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#111216] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-[#16181D] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-base font-semibold">Workspace Recovery</h1>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
            >
              <RotateCcw className="w-4 h-4" />
              Resume Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
