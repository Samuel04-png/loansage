import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ShieldAlert, Home } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="mb-8">
          <ShieldAlert className="w-24 h-24 text-amber-300 mx-auto" />
        </div>
        <h1 className="text-6xl font-bold text-slate-900 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">Unauthorized</h2>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          You don't have permission to access this page. Please contact your administrator.
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

