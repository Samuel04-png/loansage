/**
 * Loan Approval/Rejection Dialog
 * 
 * Allows accountants and admins to approve or reject loans with required notes
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { approveLoan, rejectLoan } from '../../../lib/loans/workflow';
import { LoanStatus, UserRole } from '../../../types/loan-workflow';
import toast from 'react-hot-toast';
import { useAuth } from '../../../hooks/useAuth';

interface LoanApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  agencyId: string;
  currentStatus: LoanStatus;
  onSuccess: () => void;
  initialAction?: 'approve' | 'reject' | null;
}

export function LoanApprovalDialog({
  open,
  onOpenChange,
  loanId,
  agencyId,
  currentStatus,
  onSuccess,
  initialAction = null,
}: LoanApprovalDialogProps) {
  const { user, profile } = useAuth();
  const [action, setAction] = useState<'approve' | 'reject' | null>(initialAction);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Update action when initialAction changes (when dialog opens with pre-selected action)
  useEffect(() => {
    if (open && initialAction) {
      setAction(initialAction);
    } else if (!open) {
      // Reset when dialog closes
      setAction(null);
      setNotes('');
    }
  }, [open, initialAction]);

  const userRole = (profile?.role === 'admin' ? UserRole.ADMIN : 
                   profile?.employee_category === 'accountant' ? UserRole.ACCOUNTANT :
                   UserRole.LOAN_OFFICER) as UserRole;

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Please provide notes for your decision');
      return;
    }

    if (!action || !user?.id) {
      toast.error('Invalid action or user');
      return;
    }

    setLoading(true);
    try {
      let result;
      if (action === 'approve') {
        result = await approveLoan(loanId, agencyId, user.id, userRole, notes);
      } else {
        result = await rejectLoan(loanId, agencyId, user.id, userRole, notes);
      }

      if (result.success) {
        toast.success(`Loan ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        setNotes('');
        setAction(null);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || `Failed to ${action} loan`);
      }
    } catch (error: any) {
      console.error('Error processing loan decision:', error);
      toast.error(error.message || `Failed to ${action} loan`);
    } finally {
      setLoading(false);
    }
  };

  const canApprove = currentStatus === LoanStatus.PENDING || currentStatus === LoanStatus.UNDER_REVIEW;
  const canReject = currentStatus === LoanStatus.PENDING || currentStatus === LoanStatus.UNDER_REVIEW;

  if (!canApprove && !canReject) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review Loan Application</DialogTitle>
          <DialogDescription>
            {currentStatus === LoanStatus.PENDING
              ? 'Move this loan to under review and make a decision'
              : 'Approve or reject this loan application'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Selection */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={action === 'approve' ? 'default' : 'outline'}
              onClick={() => setAction('approve')}
              disabled={!canApprove || loading}
              className="h-auto py-6 flex flex-col items-center gap-2"
            >
              <CheckCircle2 className={`w-6 h-6 ${action === 'approve' ? 'text-white' : 'text-green-600'}`} />
              <span className="font-semibold">Approve</span>
              <span className="text-xs opacity-75">Approve this loan</span>
            </Button>

            <Button
              type="button"
              variant={action === 'reject' ? 'destructive' : 'outline'}
              onClick={() => setAction('reject')}
              disabled={!canReject || loading}
              className="h-auto py-6 flex flex-col items-center gap-2"
            >
              <XCircle className={`w-6 h-6 ${action === 'reject' ? 'text-white' : 'text-red-600'}`} />
              <span className="font-semibold">Reject</span>
              <span className="text-xs opacity-75">Reject this loan</span>
            </Button>
          </div>

          {/* Notes Field */}
          {action && (
            <div className="space-y-2">
              <Label htmlFor="notes">
                {action === 'approve' ? 'Approval Notes' : 'Rejection Reason'} *
              </Label>
              <Textarea
                id="notes"
                placeholder={
                  action === 'approve'
                    ? 'Provide notes for approval (e.g., borrower meets all criteria, collateral verified, etc.)'
                    : 'Provide reason for rejection (required)'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="resize-none"
                required
              />
              <p className="text-xs text-muted-foreground">
                {action === 'reject' && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Rejection notes are mandatory and will be recorded in the audit log
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setAction(null);
              setNotes('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!action || !notes.trim() || loading}
            variant={action === 'reject' ? 'destructive' : 'default'}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {action === 'approve' ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Loan
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Loan
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

