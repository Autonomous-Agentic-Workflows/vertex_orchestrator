import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.state.error?.message?.includes('isTerraExtensionAvailable')) {
        return this.props.children;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-white">Application Exception Caught</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              An unexpected error occurred in the application view. You can reload the workspace or inspect the issue.
            </p>
            {this.state.error?.message && (
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-rose-400 overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Spark Studio</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

