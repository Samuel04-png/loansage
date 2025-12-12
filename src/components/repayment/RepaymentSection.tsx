import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Plus, DollarSign, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../lib/utils';
import { AddPaymentDialog } from '../payment/AddPaymentDialog';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { calculateLoanFinancials } from '../../lib/firebase/loan-calculations';
import { Skeleton } from '../ui/skeleton';

interface RepaymentSectionProps {
  loan: any;
  agencyId: string;
}

interface PaymentHistoryEntry {
  id: string;
  amount: number;
  paymentMethod: string;
  recordedBy: string;
  recordedAt: any;
  notes?: string;
  transactionId?: string;
  repaymentId: string;
}

export function RepaymentSection({ loan, agencyId }: RepaymentSectionProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Real-time listener for payment history updates
  useEffect(() => {
    if (!loan.id || !agencyId) {
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    const unsubscribeFunctions: (() => void)[] = [];

    // Function to fetch all payment history
    const fetchAllPaymentHistory = async () => {
      try {
        const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        const allPayments: PaymentHistoryEntry[] = [];

        // Fetch payment history from each repayment
        for (const repaymentDoc of repaymentsSnapshot.docs) {
          const repaymentId = repaymentDoc.id;
          const paymentHistoryRef = collection(
            db,
            'agencies',
            agencyId,
            'loans',
            loan.id,
            'repayments',
            repaymentId,
            'paymentHistory'
          );

          try {
            const paymentHistorySnapshot = await getDocs(paymentHistoryRef);
            paymentHistorySnapshot.docs.forEach((paymentDoc) => {
              const paymentData = paymentDoc.data();
              allPayments.push({
                id: paymentDoc.id,
                amount: Number(paymentData.amount || 0),
                paymentMethod: paymentData.paymentMethod || 'cash',
                recordedBy: paymentData.recordedBy || '',
                recordedAt: paymentData.recordedAt?.toDate?.() || paymentData.recordedAt,
                notes: paymentData.notes || undefined,
                transactionId: paymentData.transactionId || undefined,
                repaymentId,
              });
            });
          } catch (error) {
            console.warn(`Failed to fetch payment history for repayment ${repaymentId}:`, error);
          }
        }

        // Sort by date (newest first)
        const sorted = allPayments.sort((a, b) => {
          const dateA = a.recordedAt?.toDate?.() || a.recordedAt || new Date(0);
          const dateB = b.recordedAt?.toDate?.() || b.recordedAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        setPaymentHistory(sorted);
        setHistoryLoading(false);
      } catch (error) {
        console.error('Error fetching payment history:', error);
        setHistoryLoading(false);
      }
    };

    // Initial fetch
    fetchAllPaymentHistory();

    // Set up real-time listeners for all repayment payment histories
    const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
    
    // Listen to repayments collection changes
    const unsubscribeRepayments = onSnapshot(repaymentsRef, async (snapshot) => {
      // When repayments change, re-fetch all payment history
      await fetchAllPaymentHistory();
      
      // Set up listeners for each repayment's payment history
      snapshot.docs.forEach((repaymentDoc) => {
        const repaymentId = repaymentDoc.id;
        const paymentHistoryRef = collection(
          db,
          'agencies',
          agencyId,
          'loans',
          loan.id,
          'repayments',
          repaymentId,
          'paymentHistory'
        );

        // Real-time listener for payment history changes
        const unsubscribe = onSnapshot(
          paymentHistoryRef,
          () => {
            // Re-fetch all payment history when any payment history changes
            fetchAllPaymentHistory();
          },
          (error) => {
            console.warn(`Failed to listen to payment history for repayment ${repaymentId}:`, error);
          }
        );

        unsubscribeFunctions.push(unsubscribe);
      });
    }, (error) => {
      console.error('Error setting up repayment listeners:', error);
      setHistoryLoading(false);
    });

    unsubscribeFunctions.push(unsubscribeRepayments);

    // Cleanup function
    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }, [loan.id, agencyId]);

  // Fetch staff member names
  const { data: staffNames } = useQuery({
    queryKey: ['staff-names', paymentHistory?.map(p => p.recordedBy)],
    queryFn: async () => {
      if (!paymentHistory || paymentHistory.length === 0) return {};

      const names: Record<string, string> = {};
      const uniqueUserIds = [...new Set(paymentHistory.map(p => p.recordedBy).filter(Boolean))];

      for (const userId of uniqueUserIds) {
        try {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            names[userId] = userData.full_name || userData.name || userData.email || userId;
          } else {
            names[userId] = userId;
          }
        } catch (error) {
          names[userId] = userId;
        }
      }

      return names;
    },
    enabled: !!paymentHistory && paymentHistory.length > 0,
  });

  // Calculate financials
  const principal = Number(loan.amount || 0);
  const interestRate = Number(loan.interestRate || 0);
  const durationMonths = Number(loan.durationMonths || 0);
  const financials = calculateLoanFinancials(principal, interestRate, durationMonths);

  // Calculate totals - use loan's calculated values if available, otherwise calculate
  const totalPaid = loan.totalPaid !== undefined 
    ? Number(loan.totalPaid || 0)
    : loan.repayments?.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0) || 0;
  const totalPayable = financials.totalAmount;
  const remainingBalance = loan.remainingBalance !== undefined
    ? Number(loan.remainingBalance || 0)
    : Math.max(0, totalPayable - totalPaid);
  
  // Get upcoming due date from loan or calculate from repayments
  const upcomingDueDate = loan.upcomingDueDate?.toDate?.() || loan.upcomingDueDate || 
    (loan.repayments?.length > 0 
      ? loan.repayments
          .filter((r: any) => {
            const amountDue = Number(r.amountDue || 0);
            const amountPaid = Number(r.amountPaid || 0);
            return amountPaid < amountDue && r.status !== 'paid';
          })
          .sort((a: any, b: any) => {
            const dateA = a.dueDate?.toDate?.() || a.dueDate || new Date(0);
            const dateB = b.dueDate?.toDate?.() || b.dueDate || new Date(0);
            return dateA.getTime() - dateB.getTime();
          })[0]?.dueDate?.toDate?.() || null
      : null);

  // Determine loan status
  const getLoanStatus = () => {
    if (remainingBalance <= 0) {
      return { status: 'Paid in Full', variant: 'success' as const, icon: CheckCircle2 };
    }
    
    // Check for overdue repayments
    const hasOverdue = loan.repayments?.some((r: any) => {
      if (r.status === 'paid') return false;
      try {
        const dueDate = r.dueDate?.toDate?.() || r.dueDate || new Date();
        return dueDate < new Date();
      } catch {
        return false;
      }
    });

    if (hasOverdue) {
      return { status: 'Overdue', variant: 'destructive' as const, icon: AlertTriangle };
    }

    return { status: 'Active', variant: 'default' as const, icon: Clock };
  };

  const loanStatus = getLoanStatus();
  const StatusIcon = loanStatus.icon;

  // Calculate payment details including interest and principal breakdown
  const getPaymentDetails = (payment: PaymentHistoryEntry) => {
    if (!paymentHistory) {
      return {
        remainingAfter: remainingBalance,
        interestPortion: 0,
        principalPortion: payment.amount,
        paymentNumber: 0,
      };
    }
    
    // Sort payments chronologically (oldest first) to calculate cumulative remaining
    const sortedPayments = [...paymentHistory].sort((a, b) => {
      const dateA = a.recordedAt?.toDate?.() || a.recordedAt || new Date(0);
      const dateB = b.recordedAt?.toDate?.() || b.recordedAt || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    // Find the index of this payment in the sorted list
    const paymentIndex = sortedPayments.findIndex(p => p.id === payment.id);
    if (paymentIndex === -1) {
      return {
        remainingAfter: remainingBalance,
        interestPortion: 0,
        principalPortion: payment.amount,
        paymentNumber: 0,
      };
    }

    // Calculate remaining balance before this payment
    let balanceBefore = totalPayable;
    let totalInterestPaidBefore = 0;
    
    for (let i = 0; i < paymentIndex; i++) {
      balanceBefore -= sortedPayments[i].amount;
      // Calculate interest portion of previous payments
      const prevPayment = sortedPayments[i];
      const prevBalanceBefore = totalPayable - sortedPayments.slice(0, i).reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate remaining interest at that point
      const totalInterest = financials.totalInterest;
      const totalPaidBeforePrev = totalPayable - prevBalanceBefore;
      const proportionPaidBeforePrev = totalPaidBeforePrev / totalPayable;
      const expectedInterestPaidBeforePrev = totalInterest * proportionPaidBeforePrev;
      const remainingInterestBeforePrev = Math.max(0, totalInterest - expectedInterestPaidBeforePrev);
      
      const prevInterestPortion = Math.min(prevPayment.amount, remainingInterestBeforePrev);
      totalInterestPaidBefore += prevInterestPortion;
    }

    // Calculate interest and principal portions for this payment
    const totalInterest = financials.totalInterest;
    const remainingInterest = Math.max(0, totalInterest - totalInterestPaidBefore);
    
    // For this payment, allocate to interest first, then principal
    const interestPortion = Math.min(payment.amount, remainingInterest);
    const principalPortion = payment.amount - interestPortion;

    // Calculate remaining balance after this payment
    const remainingAfter = Math.max(0, balanceBefore - payment.amount);

    return {
      remainingAfter,
      interestPortion: Math.round(interestPortion * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      paymentNumber: paymentIndex + 1,
    };
  };

  return (
    <div className="space-y-6">
      {/* Repayment Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="flex items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#006BFF]" />
              Repayment Summary
            </CardTitle>
            <Badge
              variant={loanStatus.variant}
              className={loanStatus.variant === 'success' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' : ''}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {loanStatus.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Loan Amount
                </p>
                <p className="text-lg font-bold text-neutral-900">
                  {formatCurrency(principal, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-[#22C55E]/5 rounded-xl border border-[#22C55E]/10">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Total Payable
                </p>
                <p className="text-lg font-bold text-[#22C55E]">
                  {formatCurrency(totalPayable, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-[#FACC15]/5 rounded-xl border border-[#FACC15]/10">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Total Paid
                </p>
                <p className="text-lg font-bold text-[#FACC15]">
                  {formatCurrency(totalPaid, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-[#EF4444]/5 rounded-xl border border-[#EF4444]/10">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Remaining Balance
                </p>
                <p className="text-lg font-bold text-[#EF4444]">
                  {formatCurrency(remainingBalance, 'ZMW')}
                </p>
              </div>
            </div>
            
            {/* Upcoming Due Date */}
            {upcomingDueDate && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                      Next Payment Due
                    </p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatDateSafe(upcomingDueDate)}
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-[#006BFF]" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Payment Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-end"
      >
        <Button
          onClick={() => setPaymentDialogOpen(true)}
          disabled={remainingBalance <= 0}
          className="rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Payment
        </Button>
      </motion.div>

      {/* Payment History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !paymentHistory || paymentHistory.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-600 font-medium mb-2">No payments recorded yet.</p>
                <p className="text-sm text-gray-500">
                  Payments will appear here once they are recorded.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-neutral-200">
                      <TableHead className="font-semibold text-neutral-700">#</TableHead>
                      <TableHead className="font-semibold text-neutral-700">Date</TableHead>
                      <TableHead className="font-semibold text-neutral-700 text-right">Total Amount</TableHead>
                      <TableHead className="font-semibold text-neutral-700 text-right">Interest</TableHead>
                      <TableHead className="font-semibold text-neutral-700 text-right">Principal</TableHead>
                      <TableHead className="font-semibold text-neutral-700 text-right">Remaining Balance</TableHead>
                      <TableHead className="font-semibold text-neutral-700">Payment Method</TableHead>
                      <TableHead className="font-semibold text-neutral-700">Transaction ID</TableHead>
                      <TableHead className="font-semibold text-neutral-700">Recorded By</TableHead>
                      <TableHead className="font-semibold text-neutral-700">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((payment, index) => {
                      const paymentDate = payment.recordedAt?.toDate?.() || payment.recordedAt || new Date();
                      const paymentDetails = getPaymentDetails(payment);
                      const staffName = staffNames?.[payment.recordedBy] || payment.recordedBy || 'Unknown';

                      return (
                        <motion.tr
                          key={payment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + index * 0.03 }}
                          className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                        >
                          <TableCell className="font-medium text-neutral-600">
                            {paymentDetails.paymentNumber}
                          </TableCell>
                          <TableCell className="text-neutral-700">
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDateSafe(paymentDate)}</span>
                              <span className="text-xs text-neutral-500">
                                {paymentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-neutral-900 text-base">
                              {formatCurrency(payment.amount, 'ZMW')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[#EF4444] font-semibold">
                              {formatCurrency(paymentDetails.interestPortion, 'ZMW')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[#22C55E] font-semibold">
                              {formatCurrency(paymentDetails.principalPortion, 'ZMW')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-neutral-700">
                              {formatCurrency(paymentDetails.remainingAfter, 'ZMW')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {payment.paymentMethod.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-neutral-600 text-sm font-mono">
                            {payment.transactionId ? (
                              <span className="text-xs bg-neutral-100 px-2 py-1 rounded">
                                {payment.transactionId}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-neutral-600 text-sm">
                            {staffName}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {payment.notes ? (
                              <div className="group relative">
                                <span className="text-xs text-neutral-500 truncate block">
                                  {payment.notes.length > 30 
                                    ? `${payment.notes.substring(0, 30)}...` 
                                    : payment.notes}
                                </span>
                                {payment.notes.length > 30 && (
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-neutral-900 text-white text-xs rounded px-2 py-1 max-w-xs">
                                    {payment.notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-xs">—</span>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        loanId={loan.id}
        agencyId={agencyId}
        remainingBalance={remainingBalance}
        totalPayable={totalPayable}
      />
    </div>
  );
}

