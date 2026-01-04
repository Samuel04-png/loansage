/**
 * Loan Status Badge Component - Premium Design
 * Displays loan status with pill-shaped, subtle background styling
 */

import { cn } from '../../lib/utils';
import { LoanStatus } from '../../types/loan-workflow';
import { 
  FileEdit, 
  Clock, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Ban 
} from 'lucide-react';

interface LoanStatusBadgeProps {
  status: LoanStatus | string | undefined;
  className?: string;
  size?: 'sm' | 'default';
}

// Premium status styling - subtle backgrounds with strong text
const statusConfig: Record<string, { 
  label: string; 
  bgClass: string; 
  textClass: string; 
  icon: any;
}> = {
  draft: {
    label: 'Draft',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    icon: FileEdit,
  },
  pending: {
    label: 'Pending',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  under_review: {
    label: 'Under Review',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    icon: Eye,
  },
  approved: {
    label: 'Approved',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  disbursed: {
    label: 'Disbursed',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
    textClass: 'text-violet-700 dark:text-violet-400',
    icon: DollarSign,
  },
  active: {
    label: 'Active',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    icon: TrendingUp,
  },
  overdue: {
    label: 'Overdue',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    icon: AlertTriangle,
  },
  defaulted: {
    label: 'Defaulted',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    icon: Ban,
  },
  cancelled: {
    label: 'Cancelled',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-600 dark:text-gray-400',
    icon: XCircle,
  },
  closed: {
    label: 'Closed',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-400',
    icon: CheckCircle,
  },
  paid: {
    label: 'Paid',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30',
    textClass: 'text-teal-700 dark:text-teal-400',
    icon: CheckCircle,
  },
};

export function LoanStatusBadge({ status, className, size = 'default' }: LoanStatusBadgeProps) {
  // Normalize status to lowercase string
  const normalizedStatus = (!status || status === '') 
    ? 'pending' 
    : String(status).toLowerCase().replace(/_/g, '_');
  
  const config = statusConfig[normalizedStatus] || statusConfig['pending'];
  const Icon = config.icon;

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1' 
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span 
      className={cn(
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        config.bgClass,
        config.textClass,
        sizeClasses,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
}

