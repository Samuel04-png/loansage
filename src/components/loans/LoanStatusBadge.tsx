/**
 * Loan Status Badge Component
 * Displays loan status with appropriate styling
 */

import { Badge } from '../ui/badge';
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
  CheckCircle 
} from 'lucide-react';

interface LoanStatusBadgeProps {
  status: LoanStatus | string | undefined;
  className?: string;
}

const statusConfig: Record<LoanStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  [LoanStatus.DRAFT]: {
    label: 'Draft',
    variant: 'outline',
    icon: FileEdit,
  },
  [LoanStatus.PENDING]: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
  },
  [LoanStatus.UNDER_REVIEW]: {
    label: 'Under Review',
    variant: 'secondary',
    icon: Eye,
  },
  [LoanStatus.APPROVED]: {
    label: 'Approved',
    variant: 'default',
    icon: CheckCircle2,
  },
  [LoanStatus.REJECTED]: {
    label: 'Rejected',
    variant: 'destructive',
    icon: XCircle,
  },
  [LoanStatus.DISBURSED]: {
    label: 'Disbursed',
    variant: 'default',
    icon: DollarSign,
  },
  [LoanStatus.ACTIVE]: {
    label: 'Active',
    variant: 'default',
    icon: TrendingUp,
  },
  [LoanStatus.OVERDUE]: {
    label: 'Overdue',
    variant: 'destructive',
    icon: AlertTriangle,
  },
  [LoanStatus.CLOSED]: {
    label: 'Closed',
    variant: 'secondary',
    icon: CheckCircle,
  },
};

export function LoanStatusBadge({ status, className }: LoanStatusBadgeProps) {
  const config = statusConfig[status];
  
  // Handle undefined status or missing config
  if (!config || !status) {
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${className || ''}`}>
        <Clock className="w-3 h-3" />
        {status || 'Unknown'}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${className || ''}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

