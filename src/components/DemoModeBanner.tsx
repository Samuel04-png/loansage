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
    <div className="hidden md:block bg-amber-50 border-b border-amber-200 px-4 py-2.5 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-amber-900">
              Demo Mode Active
            </p>
            <p className="text-[10px] text-amber-700">
              You're testing the UI flow. Configure Supabase to enable full functionality.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('demo-banner-dismissed', 'true');
          }}
          className="text-amber-600 hover:text-amber-800 flex-shrink-0 p-1"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

