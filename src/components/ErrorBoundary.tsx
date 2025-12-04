import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

