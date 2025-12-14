import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { FileText, Users, Clock, CheckCircle2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function EmployeeDashboard() {
  const { profile, user } = useAuth();

  // Find employee by user ID
  const { data: employee } = useQuery({
    queryKey: ['employee-by-user', user?.id, profile?.agency_id],
    queryFn: async () => {
      if (!user?.id || !profile?.agency_id) return null;

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const q = firestoreQuery(employeesRef, where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!user?.id && !!profile?.agency_id,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['employee-dashboard-stats', employee?.id, profile?.agency_id],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return null;

      // Get assigned loans
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const myLoansQuery = firestoreQuery(loansRef, where('officerId', '==', user?.id));
      const loansSnapshot = await getDocs(myLoansQuery);
      const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const activeLoans = loans.filter((l: any) => l.status === 'active');
      const pendingLoans = loans.filter((l: any) => l.status === 'pending');
      const approvedLoans = loans.filter((l: any) => l.status === 'approved');

      // Get assigned customers
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const myCustomersQuery = firestoreQuery(customersRef, where('createdBy', '==', user?.id));
      const customersSnapshot = await getDocs(myCustomersQuery);
      const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get pending approvals (loans pending approval)
      const pendingApprovals = loans.filter((l: any) => l.status === 'pending');

      // Get overdue loans
      const now = new Date();
      let overdueCount = 0;
      for (const loan of activeLoans) {
        const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'repayments');
        const overdueQuery = firestoreQuery(
          repaymentsRef,
          where('status', '==', 'pending'),
          where('dueDate', '<=', now)
        );
        const overdueSnapshot = await getDocs(overdueQuery);
        if (overdueSnapshot.size > 0) {
          overdueCount++;
        }
      }

      // Calculate total portfolio value
      const totalPortfolioValue = activeLoans.reduce((sum, l: any) => sum + Number(l.amount || 0), 0);

      // Get recent loans
      const recentLoans = loans
        .sort((a: any, b: any) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, 5);

      return {
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        pendingLoans: pendingLoans.length,
        approvedLoans: approvedLoans.length,
        totalCustomers: customers.length,
        pendingApprovals: pendingApprovals.length,
        overdueCount,
        totalPortfolioValue,
        recentLoans,
      };
    },
    enabled: !!employee?.id && !!profile?.agency_id && !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <p className="text-neutral-600 dark:text-neutral-400">
          Here's an overview of your work today.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'My Loans', value: stats?.totalLoans || 0, subtext: `${stats?.activeLoans || 0} active`, icon: FileText, color: 'text-[#006BFF]' },
          { label: 'Portfolio Value', value: formatCurrency(stats?.totalPortfolioValue || 0, 'ZMW'), icon: TrendingUp, color: 'text-[#22C55E]' },
          { label: 'Pending Approvals', value: stats?.pendingApprovals || 0, icon: Clock, color: 'text-[#FACC15]' },
          { label: 'Overdue Loans', value: stats?.overdueCount || 0, icon: AlertCircle, color: 'text-[#EF4444]' },
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
                    {stat.subtext && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{stat.subtext}</p>
                    )}
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

      {/* Additional Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {[
          { label: 'My Customers', value: stats?.totalCustomers || 0, icon: Users, color: 'text-[#006BFF]' },
          { label: 'Approved Loans', value: stats?.approvedLoans || 0, icon: CheckCircle2, color: 'text-[#22C55E]' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
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

      {/* Quick Actions - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-white dark:bg-neutral-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Link to="/employee/loans/create">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full p-6 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-[#006BFF]/20 dark:hover:border-blue-500/30 text-left transition-all duration-300 cursor-pointer"
                >
                  <FileText className="w-6 h-6 text-[#006BFF] mb-3" />
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Create New Loan</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Start a loan application</p>
                </motion.div>
              </Link>
              <Link to="/employee/loans/pending">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full p-6 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-[#006BFF]/20 dark:hover:border-blue-500/30 text-left transition-all duration-300 cursor-pointer"
                >
                  <Clock className="w-6 h-6 text-[#FACC15] mb-3" />
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Pending Approvals</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{stats?.pendingApprovals || 0} loans pending</p>
                </motion.div>
              </Link>
              <Link to="/employee/overdue">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full p-6 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-[#006BFF]/20 dark:hover:border-blue-500/30 text-left transition-all duration-300 cursor-pointer"
                >
                  <AlertCircle className="w-6 h-6 text-[#EF4444] mb-3" />
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Overdue Loans</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{stats?.overdueCount || 0} need attention</p>
                </motion.div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Loans - Reference Style */}
      {stats?.recentLoans && stats.recentLoans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900">Recent Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentLoans.map((loan: any, index: number) => (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                  >
                    <Link
                      to={`/employee/loans/${loan.id}`}
                      className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:border-[#006BFF]/20 transition-all duration-300"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900 mb-1">Loan #{loan.id.substring(0, 8)}</p>
                        <p className="text-sm text-neutral-600">
                          {formatCurrency(Number(loan.amount || 0), 'ZMW')} • {loan.loanType || 'Personal Loan'} • {loan.createdAt ? formatDateSafe(loan.createdAt) : '-'}
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
