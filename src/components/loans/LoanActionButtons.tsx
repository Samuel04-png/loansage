/**
 * Loan Action Buttons Component
 * 
 * Displays action buttons based on user role and loan status
 */

import { Button } from '../ui/button';
import { LoanStatus, UserRole, canPerformAction, getLoanPermissions } from '../../types/loan-workflow';
import { Send, Edit, CheckCircle2, XCircle, DollarSign, FileText } from 'lucide-react';

interface LoanActionButtonsProps {
  loanStatus: LoanStatus;
  userRole: UserRole;
  isLoanOwner: boolean;
  onEdit?: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onDisburse?: () => void;
  onManageRepayments?: () => void;
  onClose?: () => void;
  className?: string;
}

export function LoanActionButtons({
  loanStatus,
  userRole,
  isLoanOwner,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onDisburse,
  onManageRepayments,
  onClose,
  className = '',
}: LoanActionButtonsProps) {
  const permissions = getLoanPermissions(userRole, loanStatus, isLoanOwner);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {permissions.canEdit && onEdit && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      )}

      {permissions.canSubmit && onSubmit && (
        <Button size="sm" onClick={onSubmit}>
          <Send className="w-4 h-4 mr-2" />
          Submit for Review
        </Button>
      )}

      {permissions.canApprove && onApprove && (
        <Button size="sm" variant="default" onClick={onApprove}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Approve
        </Button>
      )}

      {permissions.canReject && onReject && (
        <Button size="sm" variant="destructive" onClick={onReject}>
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>
      )}

      {permissions.canDisburse && onDisburse && (
        <Button size="sm" variant="default" onClick={onDisburse}>
          <DollarSign className="w-4 h-4 mr-2" />
          Disburse
        </Button>
      )}

      {permissions.canManageRepayments && onManageRepayments && (
        <Button size="sm" variant="outline" onClick={onManageRepayments}>
          <FileText className="w-4 h-4 mr-2" />
          Manage Repayments
        </Button>
      )}

      {permissions.canClose && onClose && (
        <Button size="sm" variant="outline" onClick={onClose}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Close Loan
        </Button>
      )}
    </div>
  );
}

