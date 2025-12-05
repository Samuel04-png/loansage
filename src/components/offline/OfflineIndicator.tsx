import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { Wifi, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingWrites } = useOfflineStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [lastStatus, setLastStatus] = useState(isOnline);

  useEffect(() => {
    // Show notification when status changes
    if (lastStatus !== isOnline) {
      setShowNotification(true);
      setLastStatus(isOnline);
      
      // Hide after 5 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, lastStatus]);

  // Always show when offline
  if (!isOnline) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 animate-pulse" />
              <div>
                <p className="font-semibold text-sm">You're offline</p>
                <p className="text-xs text-amber-100">
                  Your changes will be saved locally and synced when you're back online
                </p>
              </div>
            </div>
            {pendingWrites > 0 && (
              <div className="flex items-center gap-2 text-xs bg-amber-600 px-3 py-1 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{pendingWrites} pending</span>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Show sync notification when coming back online
  if (showNotification && isOnline && (isSyncing || pendingWrites > 0)) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-emerald-500 text-white px-4 py-3 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSyncing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {isSyncing ? 'Syncing...' : 'Back online'}
                </p>
                <p className="text-xs text-emerald-100">
                  {isSyncing 
                    ? 'Syncing your changes to the server'
                    : 'All changes have been synced'
                  }
                </p>
              </div>
            </div>
            {pendingWrites > 0 && (
              <div className="flex items-center gap-2 text-xs bg-emerald-600 px-3 py-1 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{pendingWrites} syncing</span>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Compact indicator in corner when online (only show if no notifications)
  if (!showNotification && isOnline && !isSyncing && pendingWrites === 0) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <div className="bg-white rounded-full shadow-lg p-2 border-2 border-emerald-500">
          <Wifi className="w-4 h-4 text-emerald-500" />
        </div>
      </motion.div>
    );
  }

  return null;
}

