import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { createAuditLog } from '../../lib/firebase/firestore-helpers';
import { Textarea } from '../ui/textarea';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  agencyId: string;
  remainingBalance: number;
  totalPayable: number;
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  loanId,
  agencyId,
  remainingBalance,
  totalPayable,
}: AddPaymentDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentAmount = parseFloat(amount);
    
    // Real-time validation using helper function
    const { validatePaymentAmount } = await import('../../lib/firebase/repayment-helpers');
    const validation = validatePaymentAmount(paymentAmount, remainingBalance);
    
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid payment amount');
      return;
    }

    setLoading(true);
    try {
      // Get all repayments for this loan
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (repayments.length === 0) {
        toast.error('No repayments found for this loan');
        setLoading(false);
        return;
      }

      // Sort repayments by due date (oldest first) and filter unpaid ones
      const unpaidRepayments = repayments
        .filter((r: any) => {
          const amountDue = Number(r.amountDue || 0);
          const amountPaid = Number(r.amountPaid || 0);
          return amountPaid < amountDue;
        })
        .sort((a: any, b: any) => {
          const dateA = a.dueDate?.toDate?.() || a.dueDate || new Date(0);
          const dateB = b.dueDate?.toDate?.() || b.dueDate || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });

      if (unpaidRepayments.length === 0) {
        toast.error('All repayments are already paid');
        setLoading(false);
        return;
      }

      // Distribute payment across repayments (oldest first)
      let remainingPayment = paymentAmount;
      const paymentDateTimestamp = paymentDate ? new Date(paymentDate) : new Date();

      for (const repayment of unpaidRepayments) {
        if (remainingPayment <= 0) break;

        const amountDue = Number(repayment.amountDue || 0);
        const amountPaid = Number(repayment.amountPaid || 0);
        const remaining = amountDue - amountPaid;

        const paymentForThisRepayment = Math.min(remainingPayment, remaining);
        const newAmountPaid = amountPaid + paymentForThisRepayment;
        const isFullyPaid = newAmountPaid >= amountDue;

        // Update repayment
        const repaymentRef = doc(
          db,
          'agencies',
          agencyId,
          'loans',
          loanId,
          'repayments',
          repayment.id
        );

        await updateDoc(repaymentRef, {
          amountPaid: newAmountPaid,
          status: isFullyPaid ? 'paid' : repayment.status,
          paidAt: isFullyPaid ? serverTimestamp() : repayment.paidAt,
          paymentMethod: paymentMethod || null,
          lastPaymentDate: serverTimestamp(),
          lastPaymentAmount: paymentForThisRepayment,
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
          repayment.id,
          'paymentHistory',
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );

        const { setDoc, Timestamp } = await import('firebase/firestore');
        const paymentHistoryData: any = {
          amount: paymentForThisRepayment,
          paymentMethod: paymentMethod || 'cash',
          recordedBy: user?.id || '',
          recordedAt: Timestamp.fromDate(paymentDateTimestamp) || serverTimestamp(),
          notes: notes || null,
        };
        
        // Only add transactionId if provided
        if (transactionId && transactionId.trim()) {
          paymentHistoryData.transactionId = transactionId.trim();
        }
        
        await setDoc(paymentHistoryRef, paymentHistoryData);

        remainingPayment -= paymentForThisRepayment;
      }

      // Update loan summary (remaining balance, total paid, upcoming due date, status)
      const { updateLoanAfterPayment } = await import('../../lib/firebase/repayment-helpers');
      await updateLoanAfterPayment(agencyId, loanId);

      // Create audit log
      createAuditLog(agencyId, {
        actorId: user?.id || '',
        action: 'add_payment',
        targetCollection: 'loans',
        targetId: loanId,
        metadata: {
          amount: paymentAmount,
          paymentMethod,
          notes,
          paymentDate,
        },
      }).catch(() => {
        // Ignore audit log errors
      });

      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['loan', agencyId, loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      
      setAmount('');
      setTransactionId('');
      setNotes('');
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
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this loan. Remaining balance: {remainingBalance.toLocaleString()} ZMW
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
                max={remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter payment amount"
                required
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Remaining balance: {remainingBalance.toLocaleString()} ZMW
              </p>
            </div>

            <div>
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="mt-2"
                max={new Date().toISOString().split('T')[0]}
              />
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
                placeholder="Enter transaction reference number"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this payment"
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > remainingBalance}>
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

