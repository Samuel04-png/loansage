import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Wallet, FileText, Calendar, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back!</h2>
        <p className="text-slate-600">Here's an overview of your loans.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(dashboardData?.totalOutstanding || 0, dashboardData?.currency || 'ZMW')}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active Loans</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {dashboardData?.totalLoans || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {dashboardData?.nextPayment ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Next Payment</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(Number(dashboardData.nextPayment.amount), dashboardData.currency || 'ZMW')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Due {formatDateSafe(dashboardData.nextPayment.dueDate)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Next Payment</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">-</p>
                  <p className="text-xs text-slate-500 mt-1">No upcoming payments</p>
                </div>
                <Clock className="h-8 w-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Loan History</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {dashboardData?.loanHistory?.length || 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total loans</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData?.loanHistory && dashboardData.loanHistory.length > 0 ? (
            <div className="space-y-4">
              {dashboardData.loanHistory.map((loan: any) => (
                <Link
                  key={loan.id}
                  to={`/customer/loans/${loan.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold">Loan #{loan.id.substring(0, 8)}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(Number(loan.amount || 0), 'ZMW')} • {loan.loanType || 'Personal Loan'} • {formatDateSafe(loan.createdAt)}
                    </p>
                  </div>
                  <Badge variant={loan.status === 'active' ? 'success' : loan.status === 'pending' ? 'warning' : 'outline'}>
                    {loan.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No loan history yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
