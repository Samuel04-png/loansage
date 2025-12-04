import { isDemoMode } from '../lib/supabase/client';
import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(
    localStorage.getItem('demo-banner-dismissed') === 'true'
  );

  if (!isDemoMode || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Demo Mode Active
            </p>
            <p className="text-xs text-amber-700">
              You're testing the UI flow. Configure Supabase to enable full functionality.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('demo-banner-dismissed', 'true');
          }}
          className="text-amber-600 hover:text-amber-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

