import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AlertTriangle, Home } from 'lucide-react';

export function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="mb-8">
          <AlertTriangle className="w-24 h-24 text-red-300 mx-auto" />
        </div>
        <h1 className="text-6xl font-bold text-slate-900 mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">Server Error</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Something went wrong on our end. Please try again later.
        </p>
        <Link to="/">
          <Button>
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

