import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Plus, Search, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { LoanStatusBadge } from '../../../components/loans/LoanStatusBadge';
import { LoanActionButtons } from '../../../components/loans/LoanActionButtons';
import { SubmitLoanButton } from '../../../components/loans/SubmitLoanButton';
import { LoanStatus, UserRole, getLoanPermissions } from '../../../types/loan-workflow';
import { useAgency } from '../../../hooks/useAgency';
import { EditLoanDrawer } from '../components/EditLoanDrawer';
import { deleteLoan } from '../../../lib/firebase/loan-helpers';
import { useMutation } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export function EmployeeLoansPage() {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewAllLoans, setViewAllLoans] = useState(false); // Toggle for viewing all loans
  const [editLoanDrawerOpen, setEditLoanDrawerOpen] = useState(false);
  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

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


  const deleteLoanMutation = useMutation({
    mutationFn: async (loanId: string) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Not authenticated');
      }
      await deleteLoan(profile.agency_id, loanId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-loans'] });
      toast.success('Loan deleted successfully');
      setDeleteLoanId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete loan');
    },
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
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid grid-cols-3 gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-5" />
                </div>
              ))}
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="divide-y">
              {filteredLoans.map((loan: any) => {
                const loanPermissions = getLoanPermissions(
                  userRole,
                  loan.status as LoanStatus,
                  loan.isOwnLoan || loan.officerId === user?.id
                );
                
                return (
                  <div
                    key={loan.id}
                    className="p-6 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <Link to={`/employee/loans/${loan.id}`} className="flex-1">
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
                              {formatCurrency(Number(loan?.amount || 0), loan?.currency || 'ZMW')}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-neutral-400">Created</p>
                            <p className="text-slate-600 dark:text-neutral-400">{formatDateSafe(loan?.createdAt)}</p>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 ml-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {loanPermissions.canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLoanId(loan.id);
                                  setEditLoanDrawerOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {(loan.status === 'draft' || loan.status === 'rejected' || 
                              profile?.role === 'admin' || profile?.employee_category === 'manager') && (
                              <DropdownMenuItem
                                onClick={() => setDeleteLoanId(loan.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Link to={`/employee/loans/${loan.id}`}>
                          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-neutral-600" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="w-12 h-12 mx-auto text-muted-foreground" />}
              title="No loans found"
              description={searchTerm 
                ? "No loans match your search criteria. Try adjusting your filters."
                : "You haven't created any loans yet. Get started by creating your first loan application."
              }
              action={searchTerm ? undefined : {
                label: "Create Your First Loan",
                onClick: () => window.location.href = '/employee/loans/create'
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Loan Drawer */}
      <EditLoanDrawer
        open={editLoanDrawerOpen}
        onOpenChange={setEditLoanDrawerOpen}
        loanId={selectedLoanId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employee-loans'] });
          queryClient.invalidateQueries({ queryKey: ['loan', selectedLoanId] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteLoanId} onOpenChange={(open) => !open && setDeleteLoanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this loan? This action cannot be undone.
              Only DRAFT or REJECTED loans can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteLoanId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteLoanId) {
                  deleteLoanMutation.mutate(deleteLoanId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLoanMutation.isPending}
            >
              {deleteLoanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
