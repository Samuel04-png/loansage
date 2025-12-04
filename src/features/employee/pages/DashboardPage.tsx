import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { FileText, Users, Clock, CheckCircle2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import { Link } from 'react-router-dom';

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back!</h2>
        <p className="text-slate-600">
          Here's an overview of your work today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">My Loans</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats?.totalLoans || 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.activeLoans || 0} active
                </p>
              </div>
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Portfolio Value</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(stats?.totalPortfolioValue || 0, 'ZMW')}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Pending Approvals</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats?.pendingApprovals || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">My Customers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats?.totalCustomers || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Overdue Loans</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats?.overdueCount || 0}
                </p>
                {stats?.overdueCount > 0 && (
                  <p className="text-xs text-red-600 mt-1">Action needed</p>
                )}
              </div>
              {stats?.overdueCount > 0 ? (
                <AlertCircle className="h-8 w-8 text-red-600" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Approved Loans</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats?.approvedLoans || 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Link to="/employee/loans/create">
              <button className="w-full p-4 border rounded-lg hover:bg-slate-50 text-left transition-colors">
                <FileText className="w-6 h-6 text-primary-600 mb-2" />
                <p className="font-semibold">Create New Loan</p>
                <p className="text-sm text-slate-500">Start a loan application</p>
              </button>
            </Link>
            <Link to="/employee/loans/pending">
              <button className="w-full p-4 border rounded-lg hover:bg-slate-50 text-left transition-colors">
                <Clock className="w-6 h-6 text-primary-600 mb-2" />
                <p className="font-semibold">Pending Approvals</p>
                <p className="text-sm text-slate-500">{stats?.pendingApprovals || 0} loans pending</p>
              </button>
            </Link>
            <Link to="/employee/overdue">
              <button className="w-full p-4 border rounded-lg hover:bg-slate-50 text-left transition-colors">
                <AlertCircle className="w-6 h-6 text-primary-600 mb-2" />
                <p className="font-semibold">Overdue Loans</p>
                <p className="text-sm text-slate-500">{stats?.overdueCount || 0} need attention</p>
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {stats?.recentLoans && stats.recentLoans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentLoans.map((loan: any) => (
                <Link
                  key={loan.id}
                  to={`/employee/loans/${loan.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold">Loan #{loan.id.substring(0, 8)}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(Number(loan.amount || 0), 'ZMW')} • {loan.loanType || 'Personal Loan'} • {loan.createdAt ? formatDateSafe(loan.createdAt) : '-'}
                    </p>
                  </div>
                  <Badge variant={loan.status === 'active' ? 'success' : loan.status === 'pending' ? 'warning' : 'outline'}>
                    {loan.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
