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
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sticky top-16 z-[5] md:sticky md:top-0 md:z-[5]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
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
          className="text-amber-600 hover:text-amber-800 flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

