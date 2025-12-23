import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Search, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';

export function PaymentsPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

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

  // Get loans for this customer
  const { data: loans } = useQuery({
    queryKey: ['customer-loans', customer?.id, profile?.agency_id],
    queryFn: async () => {
      if (!customer?.id || !profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = firestoreQuery(loansRef, where('customerId', '==', customer.id));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!customer?.id && !!profile?.agency_id,
  });

  // Get repayments for all loans
  const { data: repayments, isLoading } = useQuery({
    queryKey: ['repayments', loans?.map((l: any) => l.id), filter, profile?.agency_id],
    queryFn: async () => {
      if (!loans || loans.length === 0 || !profile?.agency_id) return [];

      const allRepayments: any[] = [];

      for (const loan of loans) {
        const repaymentsRef = collection(
          db,
          'agencies',
          profile.agency_id,
          'loans',
          loan.id,
          'repayments'
        );
        
        let q = firestoreQuery(repaymentsRef, orderBy('dueDate', 'desc'));
        
        if (filter !== 'all') {
          q = firestoreQuery(repaymentsRef, where('status', '==', filter), orderBy('dueDate', 'desc'));
        }

        const snapshot = await getDocs(q);
        const loanRepayments = snapshot.docs.map(doc => ({
          id: doc.id,
          loanId: loan.id,
          loanNumber: loan.id,
          ...doc.data(),
          dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
          paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
        }));

        allRepayments.push(...loanRepayments);
      }

      return allRepayments;
    },
    enabled: !!loans && loans.length > 0 && !!profile?.agency_id,
  });

  const getStatusBadge = (status: string, dueDate: Date | string) => {
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const isOverdue = due < new Date() && status === 'pending';

    if (status === 'paid') {
      return (
        <Badge variant="success">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    } else if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    } else {
      return (
        <Badge variant="warning">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const totalPending = repayments?.filter((r: any) => r.status === 'pending').reduce((sum: number, r: any) => sum + Number(r.amountDue || 0), 0) || 0;
  const totalPaid = repayments?.filter((r: any) => r.status === 'paid').reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0) || 0;

  const filteredRepayments = repayments?.filter((r: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.loanNumber?.toLowerCase().includes(search) ||
      r.loanId?.toLowerCase().includes(search) ||
      r.id?.toLowerCase().includes(search) ||
      r.status?.toLowerCase().includes(search) ||
      String(r.amount || '').includes(search) ||
      String(r.amountPaid || '').includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Payments & Repayment Schedule</h2>
        <p className="text-slate-600">View your payment history and upcoming payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Pending</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending, 'ZMW')}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid, 'ZMW')}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Payments</p>
                <p className="text-2xl font-bold">{repayments?.length || 0}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by loan number..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredRepayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 dark:text-neutral-300 uppercase bg-slate-50 dark:bg-neutral-800/50 border-b border-slate-100 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-3">Loan Number</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Paid Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepayments.map((repayment: any) => (
                    <tr
                      key={`${repayment.loanId}-${repayment.id}`}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-medium">{repayment.loanNumber || repayment.loanId}</td>
                      <td className="px-6 py-4 font-semibold">
                        {formatCurrency(Number(repayment.amountDue || repayment.amountPaid || 0), 'ZMW')}
                      </td>
                      <td className="px-6 py-4">{formatDateSafe(repayment.dueDate)}</td>
                      <td className="px-6 py-4">
                        {formatDateSafe(repayment.paidAt)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(repayment.status, repayment.dueDate)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {repayment.status === 'pending' && (
                          <Button size="sm">Make Payment</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No payments found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
