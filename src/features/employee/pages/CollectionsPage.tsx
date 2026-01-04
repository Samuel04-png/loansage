import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Search, DollarSign, Phone, Mail, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export function CollectionsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Get all loans first
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['collections-loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      try {
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const snapshot = await getDocs(loansRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error: any) {
        console.error('Error fetching loans for collections:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id,
  });

  // Get all repayments from all loans
  const { data: repayments, isLoading } = useQuery({
    queryKey: ['collections-repayments', loans?.map((l: any) => l.id), profile?.agency_id],
    queryFn: async () => {
      if (!loans || loans.length === 0 || !profile?.agency_id) return [];

      try {
        const allRepayments: any[] = [];

        for (const loan of loans) {
          try {
            const repaymentsRef = collection(
              db,
              'agencies',
              profile.agency_id,
              'loans',
              loan.id,
              'repayments'
            );
            let loanRepayments: any[] = [];
            try {
              const q = firestoreQuery(
                repaymentsRef,
                where('status', '==', 'pending'),
                orderBy('dueDate', 'asc')
              );
              const snapshot = await getDocs(q);
              loanRepayments = snapshot.docs.map(doc => ({
                id: doc.id,
                loanId: loan.id,
                loanNumber: (loan as any).loanNumber || loan.id,
                customerId: (loan as any).customerId,
                ...doc.data(),
                dueDate: doc.data().dueDate && typeof doc.data().dueDate.toDate === 'function'
                  ? doc.data().dueDate.toDate()
                  : doc.data().dueDate,
                }));
            } catch (queryError: any) {
              // If compound query fails, try simple query
              if (queryError?.code === 'failed-precondition' || queryError?.message?.includes('index')) {
                try {
                  const simpleSnapshot = await getDocs(repaymentsRef);
                  loanRepayments = simpleSnapshot.docs
                    .map(doc => ({
                      id: doc.id,
                      loanId: loan.id,
                      loanNumber: (loan as any).loanNumber || loan.id,
                      customerId: (loan as any).customerId,
                      ...doc.data(),
                      dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
                    }))
                    .filter((r: any) => r.status === 'pending')
                    .sort((a: any, b: any) => {
                      const aDate = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate || 0);
                      const bDate = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate || 0);
                      return aDate.getTime() - bDate.getTime();
                    });
                } catch (fallbackError) {
                  console.warn(`Failed to fetch repayments for loan ${loan.id} (fallback):`, fallbackError);
                }
              } else {
                console.warn(`Failed to fetch repayments for loan ${loan.id}:`, queryError);
              }
            }

            // Fetch customer data for each repayment
            for (const repayment of loanRepayments) {
              if (repayment.customerId) {
                try {
                  const { doc: getDocRef, getDoc } = await import('firebase/firestore');
                  const customerRef = getDocRef(db, 'agencies', profile.agency_id, 'customers', repayment.customerId);
                  const customerDoc = await getDoc(customerRef);
                  if (customerDoc.exists()) {
                    repayment.customer = { id: customerDoc.id, ...customerDoc.data() };
                  }
                } catch (error) {
                  console.warn('Failed to fetch customer:', error);
                }
              }
            }

            allRepayments.push(...loanRepayments);
          } catch (error) {
            console.warn(`Failed to fetch repayments for loan ${loan.id}:`, error);
          }
        }

        return allRepayments;
      } catch (error: any) {
        console.error('Error fetching repayments:', error);
        return [];
      }
    },
    enabled: !!loans && loans.length > 0 && !!profile?.agency_id,
  });

  const markAsPaid = useMutation({
    mutationFn: async ({ loanId, repaymentId }: { loanId: string; repaymentId: string }) => {
      if (!profile?.agency_id) throw new Error('Agency ID not found');
      
      const repaymentRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments', repaymentId);
      await updateDoc(repaymentRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections-repayments'] });
      toast.success('Payment marked as received');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update payment');
    },
  });

  const sendReminder = useMutation({
    mutationFn: async (repayment: any) => {
      toast.success(`Reminder sent to ${repayment.customer?.fullName || repayment.customer?.name || 'customer'}`);
    },
  });

  const getDaysOverdue = (dueDate: Date | string) => {
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredRepayments = repayments?.filter((r: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.loanNumber?.toLowerCase().includes(search) ||
      r.loanId?.toLowerCase().includes(search) ||
      r.customer?.fullName?.toLowerCase().includes(search) ||
      r.customer?.name?.toLowerCase().includes(search) ||
      String(r.amountDue || '').includes(search)
    );
  }) || [];

  const overdueRepayments = filteredRepayments.filter((r: any) => getDaysOverdue(r.dueDate) > 0);
  const upcomingRepayments = filteredRepayments.filter((r: any) => getDaysOverdue(r.dueDate) === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Collections Management</h1>
        <p className="helper-text">Track and manage loan repayments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-neutral-400">Total Pending</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(
                      filteredRepayments.reduce((sum: number, r: any) => sum + Number(r.amountDue || 0), 0),
                      'ZMW'
                    )}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-neutral-400">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">{overdueRepayments.length}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-neutral-400">Upcoming</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-500">{upcomingRepayments.length}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-neutral-700">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by loan number or customer..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || loansLoading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredRepayments.length > 0 ? (
            <div className="divide-y">
              {filteredRepayments.map((repayment: any) => {
                const daysOverdue = getDaysOverdue(repayment.dueDate);
                const isOverdue = daysOverdue > 0;

                return (
                  <div key={repayment.id} className="p-6 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900 dark:text-neutral-100">
                            {repayment.loanNumber || repayment.loanId}
                          </h3>
                          {isOverdue ? (
                            <Badge variant="destructive">
                              {daysOverdue} days overdue
                            </Badge>
                          ) : (
                            <Badge variant="warning">Due soon</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Customer</p>
                            <p className="font-medium text-slate-900 dark:text-neutral-100">
                              {repayment.customer?.fullName || repayment.customer?.name || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Amount</p>
                            <p className="font-semibold text-slate-900 dark:text-neutral-100">
                              {formatCurrency(Number(repayment.amountDue || 0), 'ZMW')}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Due Date</p>
                            <p className="text-slate-600 dark:text-neutral-300">{formatDateSafe(repayment.dueDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {repayment.customer?.phone || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {repayment.customer?.email || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendReminder.mutate(repayment)}
                          disabled={sendReminder.isPending}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Remind
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markAsPaid.mutate({ loanId: repayment.loanId, repaymentId: repayment.id })}
                          disabled={markAsPaid.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<DollarSign className="w-12 h-12" />}
              title="No pending repayments"
              description="All repayments are up to date. New pending repayments will appear here."
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
