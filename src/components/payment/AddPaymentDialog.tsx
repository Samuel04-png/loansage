import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, runTransaction, getDoc, setDoc, Timestamp } from 'firebase/firestore';
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
      // First, check if loan exists and is in a valid state for payments
      const loanRef = doc(db, 'agencies', agencyId, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      
      if (!loanSnap.exists()) {
        toast.error('Loan not found');
        setLoading(false);
        return;
      }
      
      const loanData = loanSnap.data();
      const loanStatus = loanData.status?.toLowerCase();
      
      // Validate loan is in a state that can accept payments
      const payableStatuses = ['active', 'disbursed', 'overdue', 'approved'];
      if (!payableStatuses.includes(loanStatus)) {
        toast.error(`Cannot record payment for loan in "${loanStatus}" status. Loan must be Active or Disbursed.`);
        setLoading(false);
        return;
      }

      // Get all repayments for this loan
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loanId, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // If no repayment schedule exists, use AD-HOC payment mode
      const useAdHocPayment = repayments.length === 0;

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

      // If we have repayments but all are paid
      if (!useAdHocPayment && unpaidRepayments.length === 0) {
        toast.error('All scheduled repayments are already paid');
        setLoading(false);
        return;
      }

      // Generate deterministic transaction ID for idempotency based on payment context
      const paymentDateStr = paymentDate ? new Date(paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const deterministicId = transactionId?.trim() || 
        `payment-${loanId}-${paymentAmount.toFixed(2)}-${paymentMethod}-${paymentDateStr}-${Date.now()}`;
      const paymentTransactionId = deterministicId;
      const paymentDateTimestamp = paymentDate ? new Date(paymentDate) : new Date();

      if (useAdHocPayment) {
        // ===== AD-HOC PAYMENT MODE =====
        // No repayment schedule exists - record payment directly against loan balance
        console.log('Using ad-hoc payment mode (no repayment schedule)');
        
        await runTransaction(db, async (transaction) => {
          // Re-read loan to get current balance
          const currentLoanSnap = await transaction.get(loanRef);
          if (!currentLoanSnap.exists()) {
            throw new Error('Loan not found');
          }
          
          const currentLoan = currentLoanSnap.data();
          const currentBalance = Number(currentLoan.outstandingBalance || currentLoan.remainingBalance || currentLoan.totalPayable || 0);
          
          if (paymentAmount > currentBalance) {
            throw new Error(`Payment amount (${paymentAmount.toLocaleString()}) exceeds outstanding balance (${currentBalance.toLocaleString()})`);
          }
          
          const newBalance = Math.max(0, currentBalance - paymentAmount);
          const totalPaid = Number(currentLoan.totalPaid || 0) + paymentAmount;
          const isFullyPaid = newBalance <= 0;
          
          // Update loan with new balance
          transaction.update(loanRef, {
            outstandingBalance: newBalance,
            remainingBalance: newBalance,
            totalPaid: totalPaid,
            lastPaymentDate: serverTimestamp(),
            lastPaymentAmount: paymentAmount,
            status: isFullyPaid ? 'paid' : currentLoan.status,
            updatedAt: serverTimestamp(),
          });
          
          // Create payment record in payments subcollection
          const paymentRef = doc(collection(db, 'agencies', agencyId, 'loans', loanId, 'payments'), paymentTransactionId);
          
          transaction.set(paymentRef, {
            id: paymentTransactionId,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            paymentDate: Timestamp.fromDate(paymentDateTimestamp),
            recordedBy: user?.id || '',
            recordedAt: serverTimestamp(),
            notes: notes || null,
            transactionId: transactionId || null,
            type: 'ad_hoc', // Indicates this is not against a scheduled installment
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
          });
        });
        
        console.log('Ad-hoc payment recorded successfully');
      } else {
        // ===== SCHEDULED PAYMENT MODE =====
        // Distribute payment across scheduled repayments
        const repaymentIds = unpaidRepayments.map((r: any) => r.id);

        await runTransaction(db, async (transaction) => {
          // Re-read each repayment within transaction to get latest state
          const currentRepayments = await Promise.all(
            repaymentIds.map(async (repaymentId) => {
              const repaymentDocRef = doc(db, 'agencies', agencyId, 'loans', loanId, 'repayments', repaymentId);
              const repaymentSnap = await transaction.get(repaymentDocRef);
              if (!repaymentSnap.exists()) {
                return null;
              }
              return {
                id: repaymentId,
                ...repaymentSnap.data(),
              };
            })
          );
          
          const validRepayments = currentRepayments.filter(r => r !== null) as any[];

          // Sort repayments by due date (oldest first) and filter unpaid ones
          const currentUnpaidRepayments = validRepayments
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

          if (currentUnpaidRepayments.length === 0) {
            throw new Error('All repayments are already paid');
          }

          // Check if this payment transaction already exists (idempotency)
          const firstRepaymentId = currentUnpaidRepayments[0].id;
          const paymentCheckRef = doc(
            db,
            'agencies',
            agencyId,
            'loans',
            loanId,
            'repayments',
            firstRepaymentId,
            'paymentHistory',
            paymentTransactionId
          );
          
          const paymentCheckSnap = await transaction.get(paymentCheckRef);
          if (paymentCheckSnap.exists()) {
            throw new Error('This payment has already been recorded');
          }

          // Distribute payment across repayments (oldest first)
          let remainingPayment = paymentAmount;

          for (const repayment of currentUnpaidRepayments) {
            if (remainingPayment <= 0) break;

            const amountDue = Number(repayment.amountDue || 0);
            const amountPaid = Number(repayment.amountPaid || 0);
            const remaining = amountDue - amountPaid;

            const paymentForThisRepayment = Math.min(remainingPayment, remaining);
            const newAmountPaid = amountPaid + paymentForThisRepayment;
            const isFullyPaid = newAmountPaid >= amountDue;

            // Update repayment atomically
            const repaymentRef = doc(
              db,
              'agencies',
              agencyId,
              'loans',
              loanId,
              'repayments',
              repayment.id
            );

            transaction.update(repaymentRef, {
              amountPaid: newAmountPaid,
              status: isFullyPaid ? 'paid' : repayment.status,
              paidAt: isFullyPaid ? serverTimestamp() : repayment.paidAt,
              paymentMethod: paymentMethod || null,
              lastPaymentDate: serverTimestamp(),
              lastPaymentAmount: paymentForThisRepayment,
              updatedAt: serverTimestamp(),
            });

            // Create payment history entry with unique ID for idempotency
            const paymentHistoryRef = doc(
              db,
              'agencies',
              agencyId,
              'loans',
              loanId,
              'repayments',
              repayment.id,
              'paymentHistory',
              `${paymentTransactionId}-${repayment.id}`
            );

            const paymentHistoryData: any = {
              amount: paymentForThisRepayment,
              paymentMethod: paymentMethod || 'cash',
              recordedBy: user?.id || '',
              recordedAt: Timestamp.fromDate(paymentDateTimestamp),
              notes: notes || null,
              transactionId: paymentTransactionId,
              type: 'scheduled',
            };

            transaction.set(paymentHistoryRef, paymentHistoryData);

            remainingPayment -= paymentForThisRepayment;
          }

          if (remainingPayment > 0) {
            throw new Error(`Payment amount exceeds total due. Remaining: ${remainingPayment.toLocaleString()}`);
          }
        });
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
      
      // Invalidate all related queries for immediate update
      queryClient.invalidateQueries({ queryKey: ['loan', agencyId, loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history', agencyId, loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans', agencyId] });
      
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
