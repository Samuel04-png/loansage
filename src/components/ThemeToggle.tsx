import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '../components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  // useTheme now returns defaults if not in provider, so this is safe
  const { resolvedTheme, toggleTheme } = useTheme();
  
  // Extra safety check
  if (!toggleTheme || typeof toggleTheme !== 'function') {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "relative h-9 w-9 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
        className
      )}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={resolvedTheme}
          initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
          )}
        </motion.div>
      </AnimatePresence>
      {showLabel && (
        <span className="ml-2 text-sm hidden sm:inline">
          {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
        </span>
      )}
    </Button>
  );
}

