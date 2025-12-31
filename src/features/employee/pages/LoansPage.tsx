import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { LoanStatusBadge } from '../../../components/loans/LoanStatusBadge';
import { LoanActionButtons } from '../../../components/loans/LoanActionButtons';
import { SubmitLoanButton } from '../../../components/loans/SubmitLoanButton';
import { LoanStatus, UserRole } from '../../../types/loan-workflow';
import { useAgency } from '../../../hooks/useAgency';

export function EmployeeLoansPage() {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewAllLoans, setViewAllLoans] = useState(false); // Toggle for viewing all loans

  // Get user role
  const userRole = (profile?.employee_category === 'loan_officer' ? UserRole.LOAN_OFFICER :
                   profile?.role === 'admin' ? UserRole.ADMIN :
                   UserRole.LOAN_OFFICER) as UserRole;
  
  // Check if user is Loan Officer
  const isLoanOfficer = profile?.employee_category === 'loan_officer';

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

  const { data: loans, isLoading } = useQuery({
    queryKey: ['employee-loans', employee?.id, profile?.agency_id, statusFilter, viewAllLoans],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      
      // Build query based on viewAllLoans toggle
      let q;
      if (viewAllLoans && isLoanOfficer) {
        // View all loans in the agency (for Loan Officers)
        if (statusFilter !== 'all') {
          q = firestoreQuery(
            loansRef,
            where('status', '==', statusFilter),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = firestoreQuery(loansRef, orderBy('createdAt', 'desc'));
        }
      } else {
        // Default: only show loans assigned to this officer
        if (statusFilter !== 'all') {
          q = firestoreQuery(
            loansRef,
            where('officerId', '==', user?.id),
            where('status', '==', statusFilter),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = firestoreQuery(
            loansRef,
            where('officerId', '==', user?.id),
            orderBy('createdAt', 'desc')
          );
        }
      }

      const snapshot = await getDocs(q);
      const loansData = snapshot.docs.map(doc => {
        const loanData = doc.data();
        return {
          id: doc.id,
          ...loanData,
          createdAt: loanData.createdAt?.toDate?.() || loanData.createdAt,
          isOwnLoan: loanData.officerId === user?.id, // Track if this is the officer's own loan
        };
      });

      // Fetch customer details for each loan
      const loansWithCustomers = await Promise.all(
        loansData.map(async (loan: any) => {
          if (loan.customerId) {
            try {
              const { doc, getDoc } = await import('firebase/firestore');
              const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
              const customerSnap = await getDoc(customerRef);
              if (customerSnap.exists()) {
                loan.customer = { id: customerSnap.id, ...customerSnap.data() };
              }
            } catch (error) {
              console.warn('Failed to fetch customer:', error);
            }
          }
          return loan;
        })
      );

      return loansWithCustomers;
    },
    enabled: !!employee?.id && !!profile?.agency_id,
  });


  const filteredLoans = loans?.filter((loan: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.loanNumber?.toLowerCase().includes(search) ||
      loan.id?.toLowerCase().includes(search) ||
      loan.customer?.fullName?.toLowerCase().includes(search) ||
      loan.customer?.name?.toLowerCase().includes(search) ||
      loan.loanType?.toLowerCase().includes(search) ||
      String(loan.amount || '').includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Loan Pipeline</h2>
          <p className="text-slate-600 dark:text-neutral-400">Manage your loan applications</p>
        </div>
        <Link to="/employee/loans/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Loan Application
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100 dark:border-neutral-700">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by loan number or customer..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-neutral-500" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
              <option value="defaulted">Defaulted</option>
            </select>
            {isLoanOfficer && (
              <Button
                variant={viewAllLoans ? "default" : "outline"}
                onClick={() => setViewAllLoans(!viewAllLoans)}
                className="whitespace-nowrap"
              >
                {viewAllLoans ? "View My Loans" : "View All Loans"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="divide-y">
              {filteredLoans.map((loan: any) => (
                <Link
                  key={loan.id}
                  to={`/employee/loans/${loan.id}`}
                  className="block p-6 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-neutral-100">{loan.loanNumber || loan.id}</h3>
                        <LoanStatusBadge status={loan.status as LoanStatus} />
                        {isLoanOfficer && !loan.isOwnLoan && (
                          <Badge variant="outline" className="text-xs">
                            Read-Only
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-neutral-400">Customer</p>
                          <p className="font-medium text-slate-900 dark:text-neutral-100">
                            {loan.customer?.fullName || loan.customer?.name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-neutral-400">Amount</p>
                          <p className="font-semibold text-slate-900 dark:text-neutral-100">
                            {formatCurrency(Number(loan.amount || 0), loan.currency || 'ZMW')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-neutral-400">Created</p>
                          <p className="text-slate-600 dark:text-neutral-400">{formatDateSafe(loan.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-neutral-600" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-neutral-400">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-neutral-600" />
              <p>No loans found</p>
              <Link to="/employee/loans/create">
                <Button variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Loan
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
