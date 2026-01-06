import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import { useAuth } from '../../../hooks/useAuth';

interface LoanStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  currentStatus: string;
  agencyId: string;
}

export function LoanStatusDialog({ open, onOpenChange, loanId, currentStatus, agencyId }: LoanStatusDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending', description: 'Awaiting approval' },
    { value: 'approved', label: 'Approved', description: 'Loan approved, ready for disbursement' },
    { value: 'active', label: 'Active', description: 'Loan is active and being repaid' },
    { value: 'completed', label: 'Completed', description: 'Loan fully repaid' },
    { value: 'defaulted', label: 'Defaulted', description: 'Loan in default' },
    { value: 'rejected', label: 'Rejected', description: 'Loan application rejected' },
    { value: 'cancelled', label: 'Cancelled', description: 'Loan cancelled' },
  ];

  const handleStatusChange = async () => {
    if (newStatus === currentStatus) {
      toast('Status is already set to this value', { icon: 'ℹ️' });
      return;
    }

    setLoading(true);
    
    // Optimistic update - immediately update the cache
    const previousLoanData = queryClient.getQueryData(['loan', agencyId, loanId]);
    const previousLoansData = queryClient.getQueryData(['loans', agencyId]);
    
    // Optimistically update the individual loan query
    queryClient.setQueryData(['loan', agencyId, loanId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        status: newStatus,
        statusNotes: notes || null,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: user?.id || null,
        updatedAt: new Date(),
      };
    });
    
    // Optimistically update the loans list query
    queryClient.setQueryData(['loans', agencyId], (old: any[]) => {
      if (!old) return old;
      return old.map((loan: any) => 
        loan.id === loanId 
          ? { 
              ...loan, 
              status: newStatus, 
              statusNotes: notes || null,
              statusUpdatedAt: new Date(),
              updatedAt: new Date(),
            } 
          : loan
      );
    });
    
    // Close dialog immediately for better UX
    onOpenChange(false);
    toast.success('Loan status updated successfully');
    
    try {
      const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
      await updateDoc(loanRef, {
        status: newStatus,
        statusNotes: notes || null,
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedBy: user?.id || null,
        updatedAt: serverTimestamp(),
      });

      // Create audit log (don't block on this)
      createAuditLog(agencyId, {
        actorId: user?.id || '',
        action: 'update_loan_status',
        targetCollection: 'loans',
        targetId: loanId,
        metadata: {
          oldStatus: currentStatus,
          newStatus,
          notes,
        },
      }).catch(() => {
        // Ignore audit log errors
      });

      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ['loans'] }); // All loan queries
      queryClient.invalidateQueries({ queryKey: ['loan'] }); // All individual loan queries
      queryClient.invalidateQueries({ queryKey: ['employee-loans'] }); // Employee loans
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // Dashboard stats
      queryClient.invalidateQueries({ queryKey: ['ai-analysis-data'] }); // AI insights data
      queryClient.invalidateQueries({ queryKey: ['ai_insights'] }); // AI insights
      setNotes('');
    } catch (error: any) {
      console.error('Error updating loan status:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to update loan status';
      if (error?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to update this loan status. Please contact an administrator.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      
      // Rollback optimistic update on error
      if (previousLoanData) {
        queryClient.setQueryData(['loan', agencyId, loanId], previousLoanData);
      }
      if (previousLoansData) {
        queryClient.setQueryData(['loans', agencyId], previousLoansData);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Loan Status</DialogTitle>
          <DialogDescription>
            Update the status of this loan. Current status: <strong>{currentStatus}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="status">New Status *</Label>
            <select
              id="status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this status change..."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleStatusChange} disabled={loading || newStatus === currentStatus}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

