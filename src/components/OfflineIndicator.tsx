import { usePWA } from '../hooks/usePWA';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './ui/badge';

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <Badge variant="destructive" className="flex items-center gap-2 px-4 py-2 shadow-lg">
            <WifiOff className="w-4 h-4" />
            <span>You're offline</span>
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

