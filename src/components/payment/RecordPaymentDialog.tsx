import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp, Timestamp, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { createAuditLog } from '../../lib/firebase/firestore-helpers';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  repaymentId: string;
  repayment: any;
  agencyId: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  loanId,
  repaymentId,
  repayment,
  agencyId,
}: RecordPaymentDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);

  const amountDue = Number(repayment?.amountDue || 0);
  const amountPaid = Number(repayment?.amountPaid || 0);
  const remaining = amountDue - amountPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > remaining) {
      toast.error(`Payment amount cannot exceed remaining balance of ${remaining.toLocaleString()}`);
      return;
    }

    setLoading(true);
    try {
      const repaymentRef = doc(
        db,
        'agencies',
        agencyId,
        'loans',
        loanId,
        'repayments',
        repaymentId
      );

      const newAmountPaid = amountPaid + paymentAmount;
      const isFullyPaid = newAmountPaid >= amountDue;

      await updateDoc(repaymentRef, {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'paid' : repayment.status,
        paidAt: isFullyPaid ? serverTimestamp() : repayment.paidAt,
        paymentMethod: paymentMethod || null,
        transactionId: transactionId || null,
        lastPaymentDate: serverTimestamp(),
        lastPaymentAmount: paymentAmount,
        updatedAt: serverTimestamp(),
      });

      // Create payment history entry
      const paymentHistoryRef = doc(
        db,
        'agencies',
        agencyId,
        'loans',
        loanId,
        'repayments',
        repaymentId,
        'paymentHistory',
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      );

      const { setDoc } = await import('firebase/firestore');
      const paymentHistoryData: any = {
        amount: paymentAmount,
        paymentMethod: paymentMethod || 'cash',
        recordedBy: user?.id || '',
        recordedAt: serverTimestamp(),
      };
      
      // Only add transactionId if provided
      if (transactionId && transactionId.trim()) {
        paymentHistoryData.transactionId = transactionId.trim();
      }
      
      await setDoc(paymentHistoryRef, paymentHistoryData);

      // Create audit log
      createAuditLog(agencyId, {
        actorId: user?.id || '',
        action: 'record_payment',
        targetCollection: 'repayments',
        targetId: repaymentId,
        metadata: {
          loanId,
          amount: paymentAmount,
          paymentMethod,
          transactionId,
        },
      }).catch(() => {
        // Ignore audit log errors
      });

      // Update loan summary (remaining balance, total paid, upcoming due date, status)
      const { updateLoanAfterPayment } = await import('../../lib/firebase/repayment-helpers');
      await updateLoanAfterPayment(agencyId, loanId);

      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      
      setAmount('');
      setTransactionId('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this repayment. Amount due: {remaining.toLocaleString()} ZMW
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">Payment Amount (ZMW) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter payment amount"
                required
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Remaining balance: {remaining.toLocaleString()} ZMW
              </p>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                required
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
              <Input
                id="transactionId"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter transaction reference"
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
