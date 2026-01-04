/**
 * Filter Chips - Premium Toggle Filter Component
 * Fintech-style clickable pills for filtering data
 */

import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: FilterOption[];
  selected: string;
  onChange: (id: string) => void;
  className?: string;
}

export function FilterChips({ options, selected, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {options.map((option) => (
        <motion.button
          key={option.id}
          onClick={() => onChange(option.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative px-3.5 py-1.5 text-sm font-medium rounded-full transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006BFF]/30',
            selected === option.id
              ? 'bg-[#006BFF] text-white shadow-md shadow-blue-500/25'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-200'
          )}
        >
          <span>{option.label}</span>
          {option.count !== undefined && (
            <span 
              className={cn(
                'ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
                selected === option.id
                  ? 'bg-white/20 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
              )}
            >
              {option.count}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

// Simple variant for inline use
interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
  className?: string;
}

export function FilterChip({ label, active = false, onClick, count, className }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006BFF]/30',
        active
          ? 'bg-[#006BFF] text-white shadow-md shadow-blue-500/25'
          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
        className
      )}
    >
      {label}
      {count !== undefined && (
        <span 
          className={cn(
            'ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
            active
              ? 'bg-white/20'
              : 'bg-neutral-200 dark:bg-neutral-700'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
