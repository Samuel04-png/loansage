/**
 * Premium Status Badge - Soft Pill Design
 * Used for displaying status in data tables with fintech aesthetics
 */

import { cn } from '../../lib/utils';

type StatusType = 
  | 'active' | 'approved' | 'paid' | 'verified' | 'success'
  | 'pending' | 'processing' | 'warning' | 'draft'
  | 'overdue' | 'rejected' | 'defaulted' | 'inactive' | 'error' | 'cancelled'
  | 'disbursed' | 'info';

interface StatusBadgeProps {
  status: string | undefined | null;
  className?: string;
  showDot?: boolean;
  size?: 'sm' | 'default';
}

const statusConfig: Record<StatusType, { 
  bg: string; 
  text: string; 
  border: string;
  dot: string;
}> = {
  // Success states
  active: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  approved: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  paid: { 
    bg: 'bg-teal-50 dark:bg-teal-950/40', 
    text: 'text-teal-700 dark:text-teal-400', 
    border: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500'
  },
  verified: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  success: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  
  // Warning states
  pending: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  processing: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  warning: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  draft: { 
    bg: 'bg-slate-50 dark:bg-slate-800', 
    text: 'text-slate-600 dark:text-slate-400', 
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  
  // Error states
  overdue: { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500'
  },
  rejected: { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500'
  },
  defaulted: { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500'
  },
  inactive: { 
    bg: 'bg-slate-50 dark:bg-slate-800', 
    text: 'text-slate-500 dark:text-slate-400', 
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  error: { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-400', 
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500'
  },
  cancelled: { 
    bg: 'bg-slate-50 dark:bg-slate-800', 
    text: 'text-slate-500 dark:text-slate-400', 
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  
  // Info states
  disbursed: { 
    bg: 'bg-violet-50 dark:bg-violet-950/40', 
    text: 'text-violet-700 dark:text-violet-400', 
    border: 'border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500'
  },
  info: { 
    bg: 'bg-blue-50 dark:bg-blue-950/40', 
    text: 'text-blue-700 dark:text-blue-400', 
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500'
  },
};

function normalizeStatus(status: string | undefined | null): StatusType {
  if (!status) return 'inactive';
  
  const s = status.toLowerCase().replace(/[_\s-]/g, '');
  
  // Map common variations
  if (['active', 'approved', 'paid', 'verified', 'success', 'completed'].includes(s)) {
    if (s === 'completed') return 'paid';
    return s as StatusType;
  }
  if (['pending', 'processing', 'warning', 'draft', 'under_review', 'underreview'].includes(s)) {
    if (s === 'underreview') return 'pending';
    return s as StatusType;
  }
  if (['overdue', 'rejected', 'defaulted', 'inactive', 'error', 'cancelled', 'failed'].includes(s)) {
    if (s === 'failed') return 'error';
    return s as StatusType;
  }
  if (['disbursed'].includes(s)) return 'disbursed';
  
  return 'inactive';
}

function formatStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function StatusBadge({ status, className, showDot = true, size = 'default' }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const config = statusConfig[normalizedStatus];
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : 'px-3 py-1 text-xs';

  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap',
        config.bg,
        config.text,
        config.border,
        sizeClasses,
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      )}
      {formatStatusLabel(status)}
    </span>
  );
}

// Export for use with loan statuses
export { statusConfig, normalizeStatus, formatStatusLabel };
