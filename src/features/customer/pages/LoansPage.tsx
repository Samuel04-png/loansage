import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Search, FileText, ChevronRight, Loader2, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { motion } from 'framer-motion';

export function CustomerLoansPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

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

  const { data: loans, isLoading } = useQuery({
    queryKey: ['customer-loans', customer?.id, profile?.agency_id],
    queryFn: async () => {
      if (!customer?.id || !profile?.agency_id) return [];

      try {
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const q = firestoreQuery(loansRef, where('customerId', '==', customer.id), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));
      } catch (error: any) {
        console.error('Error fetching customer loans:', error);
        // If query fails due to missing index, try fallback query
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
          console.warn('Index missing, using fallback query');
          try {
            const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
            const snapshot = await getDocs(loansRef);
            const allLoans = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            }));
            // Filter in memory
            return allLoans
              .filter((loan: any) => loan.customerId === customer.id)
              .sort((a: any, b: any) => {
                const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
                const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
                return bDate.getTime() - aDate.getTime();
              });
          } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            return [];
          }
        }
        return [];
      }
    },
    enabled: !!customer?.id && !!profile?.agency_id,
  });

  // Get repayments for all loans
  const { data: repayments } = useQuery({
    queryKey: ['customer-repayments', loans?.map((l: any) => l.id), profile?.agency_id],
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
            const q = firestoreQuery(repaymentsRef, orderBy('dueDate', 'asc'));
            const snapshot = await getDocs(q);
            
            const loanRepayments = snapshot.docs.map(doc => ({
              id: doc.id,
              loanId: loan.id,
              ...doc.data(),
              dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
            }));

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'defaulted':
        return <Badge variant="destructive">Defaulted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOutstandingBalance = (loan: any) => {
    const loanRepayments = repayments?.filter((r: any) => r.loanId === loan.id) || [];
    const paidAmount = loanRepayments
      .filter((r: any) => r.status === 'paid')
      .reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0);
    return Number(loan.amount || 0) - paidAmount;
  };

  const getNextPayment = (loan: any) => {
    const loanRepayments = repayments?.filter((r: any) => r.loanId === loan.id) || [];
    const nextPayment = loanRepayments.find((r: any) => r.status === 'pending');
    return nextPayment;
  };

  const filteredLoans = loans?.filter((loan: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.id?.toLowerCase().includes(search) ||
      loan.loanNumber?.toLowerCase().includes(search) ||
      loan.loanType?.toLowerCase().includes(search) ||
      loan.status?.toLowerCase().includes(search) ||
      String(loan.amount || '').includes(search) ||
      String(loan.interestRate || '').includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">My Loans</h1>
        <p className="helper-text">View and manage your loan applications</p>
      </motion.div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100 dark:border-neutral-700">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search loans..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="divide-y">
              {filteredLoans.map((loan: any) => {
                const outstanding = getOutstandingBalance(loan);
                const nextPayment = getNextPayment(loan);

                return (
                  <Link
                    key={loan.id}
                    to={`/customer/loans/${loan.id}`}
                    className="block p-6 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900 dark:text-neutral-100">{loan.id}</h3>
                          {getStatusBadge(loan.status)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Loan Amount</p>
                            <p className="font-semibold text-slate-900 dark:text-neutral-100">
                              {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Outstanding</p>
                            <p className="font-semibold text-slate-900 dark:text-neutral-100">
                              {formatCurrency(outstanding, 'ZMW')}
                            </p>
                          </div>
                          {nextPayment && (
                            <div>
                              <p className="text-slate-500 dark:text-neutral-400">Next Payment</p>
                              <p className="font-semibold text-slate-900 dark:text-neutral-100">
                                {formatCurrency(Number(nextPayment.amountDue || 0), 'ZMW')}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-neutral-400">
                                Due: {formatDateSafe(nextPayment.dueDate)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {loan.durationMonths} months
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {loan.interestRate}% interest
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-neutral-600" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="No loans found"
              description="You don't have any loan applications yet. Contact your loan officer to get started."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
