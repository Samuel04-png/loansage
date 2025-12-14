import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Wallet, FileText, Calendar, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function CustomerDashboard() {
  const { profile } = useAuth();

  // Find customer by user ID
  const { data: customer } = useQuery({
    queryKey: ['customer-by-user', profile?.id, profile?.agency_id],
    queryFn: async () => {
      if (!profile?.id || !profile?.agency_id) return null;

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const q = firestoreQuery(customersRef, where('userId', '==', profile.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!profile?.id && !!profile?.agency_id,
  });

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['customer-dashboard', customer?.id, profile?.agency_id],
    queryFn: async () => {
      if (!customer?.id || !profile?.agency_id) return null;

      // Get active loans
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const activeLoansQuery = firestoreQuery(
        loansRef,
        where('customerId', '==', customer.id),
        where('status', '==', 'active')
      );
      const loansSnapshot = await getDocs(activeLoansQuery);
      const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all repayments for active loans
      let allRepayments: any[] = [];
      let nextPayment: any = null;

      for (const loan of loans) {
        const repaymentsRef = collection(
          db,
          'agencies',
          profile.agency_id,
          'loans',
          loan.id,
          'repayments'
        );
        const repaymentsQuery = firestoreQuery(
          repaymentsRef,
          where('status', '==', 'pending'),
          orderBy('dueDate', 'asc'),
          limit(1)
        );
        const repaymentsSnapshot = await getDocs(repaymentsQuery);
        
        if (!repaymentsSnapshot.empty && !nextPayment) {
          const payment = repaymentsSnapshot.docs[0];
          nextPayment = {
            amount: payment.data().amountDue || 0,
            dueDate: payment.data().dueDate?.toDate?.() || payment.data().dueDate,
            loanId: loan.id,
          };
        }

        // Get all repayments for outstanding calculation
        const allRepaymentsQuery = firestoreQuery(repaymentsRef);
        const allRepaymentsSnapshot = await getDocs(allRepaymentsQuery);
        allRepayments.push(...allRepaymentsSnapshot.docs.map(doc => ({
          loanId: loan.id,
          ...doc.data(),
        })));
      }

      // Calculate outstanding balance
      const paidAmount = allRepayments
        .filter((r: any) => r.status === 'paid')
        .reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0);
      
      const totalLoanAmount = loans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0);
      const totalOutstanding = totalLoanAmount - paidAmount;

      // Get loan history (all loans)
      const allLoansQuery = firestoreQuery(
        loansRef,
        where('customerId', '==', customer.id),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const allLoansSnapshot = await getDocs(allLoansQuery);
      const loanHistory = allLoansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));

      return {
        totalLoans: loans.length,
        totalOutstanding,
        nextPayment,
        loanHistory,
        currency: 'ZMW',
      };
    },
    enabled: !!customer?.id && !!profile?.agency_id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Welcome back!</h2>
        <p className="text-neutral-600 dark:text-neutral-400">Here's an overview of your loans.</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { label: 'Outstanding Balance', value: formatCurrency(dashboardData?.totalOutstanding || 0, dashboardData?.currency || 'ZMW'), icon: Wallet, color: 'text-[#FACC15]' },
          { label: 'Active Loans', value: dashboardData?.totalLoans || 0, icon: FileText, color: 'text-[#006BFF]' },
          { label: 'Next Payment', value: dashboardData?.nextPayment ? formatCurrency(dashboardData.nextPayment.amount, dashboardData?.currency || 'ZMW') : 'N/A', icon: Calendar, color: 'text-[#22C55E]' },
          { label: 'Payment Due', value: dashboardData?.nextPayment ? formatDateSafe(dashboardData.nextPayment.dueDate) : 'N/A', icon: Clock, color: 'text-[#EF4444]' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800 hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.4)] transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">{stat.label}</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stat.value}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl bg-neutral-50 dark:bg-neutral-700", stat.color)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Loan History - Reference Style */}
      {dashboardData?.loanHistory && dashboardData.loanHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Loan History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.loanHistory.map((loan: any, index: number) => (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                  >
                    <Link
                      to={`/customer/loans/${loan.id}`}
                      className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-[#006BFF]/20 dark:hover:border-blue-500/30 transition-all duration-300"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Loan #{loan.id.substring(0, 8)}</p>
                        <p className="text-sm text-neutral-600">
                          {formatCurrency(Number(loan.amount || 0), 'ZMW')} • {loan.loanType || 'Personal Loan'} • {formatDateSafe(loan.createdAt)}
                        </p>
                      </div>
                      <Badge 
                        className={
                          loan.status === 'active' 
                            ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20"
                            : loan.status === 'pending'
                            ? "bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20"
                            : "bg-neutral-100 text-neutral-600 border-neutral-200"
                        }
                      >
                        {loan.status}
                      </Badge>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
