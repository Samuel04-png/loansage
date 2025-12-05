import { useEffect } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import toast from 'react-hot-toast';

/**
 * Hook to show toast notifications for offline/online status changes
 */
export function useOfflineToast() {
  const { isOnline, isSyncing, pendingWrites } = useOfflineStatus();

  useEffect(() => {
    if (!isOnline) {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <div>
              <p className="font-semibold text-sm">You're offline</p>
              <p className="text-xs text-slate-600">
                Your changes will be saved locally and synced automatically when you're back online
              </p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        ),
        {
          duration: 5000,
          icon: '📡',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
          },
        }
      );
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && isSyncing && pendingWrites > 0) {
      toast.loading(
        `Syncing ${pendingWrites} change${pendingWrites > 1 ? 's' : ''}...`,
        {
          id: 'syncing',
        }
      );
    } else if (isOnline && !isSyncing && pendingWrites === 0) {
      toast.success('All changes synced!', {
        id: 'syncing',
      });
    }
  }, [isOnline, isSyncing, pendingWrites]);
}

