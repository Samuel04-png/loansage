import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Plus, Search, ChevronRight, FileText, Loader2, Eye, Calendar, User, CreditCard } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { LoanStatusBadge } from '../../../components/loans/LoanStatusBadge';
import { FilterChips } from '../../../components/ui/filter-chips';
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
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewAllLoans, setViewAllLoans] = useState(true); // Default: show ALL agency loans (unified view)
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

  // UNIFIED DATA ACCESS: By default, show ALL agency loans
  // Toggle allows switching to "My Loans Only" view
  const { data: loans, isLoading } = useQuery({
    queryKey: ['employee-loans', profile?.agency_id, statusFilter, viewAllLoans],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      
      // Build query - default is ALL agency loans (unified view)
      let q;
      if (!viewAllLoans) {
        // "My Loans" mode - only show loans created by or assigned to this officer
        if (statusFilter !== 'all') {
          q = firestoreQuery(
            loansRef,
            where('createdBy', '==', user?.id),
            where('status', '==', statusFilter),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = firestoreQuery(
            loansRef,
            where('createdBy', '==', user?.id),
            orderBy('createdAt', 'desc')
          );
        }
      } else {
        // Default: All agency loans (unified data access)
        if (statusFilter !== 'all') {
          q = firestoreQuery(
            loansRef,
            where('status', '==', statusFilter),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = firestoreQuery(loansRef, orderBy('createdAt', 'desc'));
        }
      }

      let loansData: any[] = [];
      try {
        const snapshot = await getDocs(q);
        loansData = snapshot.docs.map(doc => {
          const loanData = doc.data() as any;
          return {
            id: doc.id,
            ...loanData,
            createdAt: loanData.createdAt?.toDate?.() || loanData.createdAt,
            isOwnLoan: loanData.createdBy === user?.id || loanData.officerId === user?.id, // Track if this is the officer's own loan
          };
        });
      } catch (error: any) {
        console.error('Error fetching loans:', error);
        // If query fails due to missing index, try fallback query
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
          console.warn('Index missing, using fallback query');
          try {
            const snapshot = await getDocs(loansRef);
            loansData = snapshot.docs
              .map(doc => {
                const loanData = doc.data() as any;
                return {
                  id: doc.id,
                  ...loanData,
                  createdAt: loanData.createdAt?.toDate?.() || loanData.createdAt,
                  isOwnLoan: loanData.createdBy === user?.id || loanData.officerId === user?.id,
                };
              })
              .filter((loan: any) => {
                // Filter by createdBy or officerId
                const matchesUser = loan.createdBy === user?.id || loan.officerId === user?.id;
                // Filter by status if needed
                if (statusFilter !== 'all' && !viewAllLoans) {
                  return matchesUser && loan.status === statusFilter;
                }
                return matchesUser;
              })
              .sort((a: any, b: any) => {
                const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
                const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
                return bDate.getTime() - aDate.getTime();
              });
          } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            toast.error('Failed to load loans data.');
            return [];
          }
        } else {
          toast.error('Failed to load loans data.');
          return [];
        }
      }

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
    enabled: !!profile?.agency_id,
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Loan Pipeline</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your loan applications</p>
        </div>
        <Link to="/employee/loans/create">
          <Button className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
            <Plus className="mr-2 h-4 w-4" />
            New Loan Application
          </Button>
        </Link>
      </motion.div>

      <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
        {/* Premium Control Bar */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex flex-col gap-4">
            {/* Row 1: Search + Toggle */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Large Search Input */}
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input
                  placeholder="Search loans..."
                  className="pl-12 h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Toggle Button */}
              <Button
                variant={viewAllLoans ? "default" : "outline"}
                onClick={() => setViewAllLoans(!viewAllLoans)}
                className={`whitespace-nowrap rounded-xl h-11 ${viewAllLoans ? 'bg-[#006BFF] hover:bg-[#0052CC]' : ''}`}
              >
                {viewAllLoans ? "All Loans" : "My Loans Only"}
              </Button>
            </div>
            
            {/* Row 2: Filter Chips */}
            <FilterChips 
              options={[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'active', label: 'Active' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'paid', label: 'Paid' },
                { id: 'defaulted', label: 'Defaulted' },
              ]} 
              selected={statusFilter} 
              onChange={setStatusFilter}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            /* Premium Loading Skeleton */
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-5 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="hidden md:block">
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="hidden lg:block">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredLoans.length > 0 ? (
            /* Premium Two-Line Table Layout */
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredLoans.map((loan: any, index: number) => {
                const loanPermissions = getLoanPermissions(
                  userRole,
                  loan.status as LoanStatus,
                  loan.isOwnLoan || loan.createdBy === user?.id || loan.officerId === user?.id
                );
                const customerName = loan.customer?.fullName || loan.customer?.name || loan.customerName || 'Unknown';
                
                return (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15 }}
                    className="group px-6 py-5 hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-4">
                      {/* Column 1: Loan ID + Customer (Two-Line) */}
                      <Link to={`/employee/loans/${loan.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Loan Icon */}
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#006BFF]/10 to-[#4F46E5]/10 dark:from-[#006BFF]/20 dark:to-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-6 h-6 text-[#006BFF]" />
                        </div>
                        
                        {/* ID + Customer (Two-Line) */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-slate-900 dark:text-neutral-100 font-semibold text-[15px] truncate">
                              {loan.loanNumber || loan.id?.slice(0, 16)}
                            </h3>
                            {/* Read-only indicator */}
                            {isLoanOfficer && !loan.isOwnLoan && loan.createdBy !== user?.id && loan.officerId !== user?.id && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                Read-Only
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-neutral-400 text-xs">
                            <User className="w-3 h-3" />
                            <span className="truncate">{customerName}</span>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Column 2: Amount + Term (Two-Line) */}
                      <div className="hidden md:block w-32 text-right">
                        <p className="text-slate-900 dark:text-neutral-100 font-bold text-base">
                          {formatCurrency(Number(loan?.amount || 0), loan?.currency || 'ZMW')}
                        </p>
                        <p className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">
                          {loan?.durationMonths || 12} months
                        </p>
                      </div>
                      
                      {/* Column 3: Type + Date (Two-Line) */}
                      <div className="hidden lg:block w-28">
                        <p className="text-slate-700 dark:text-neutral-300 font-medium text-sm capitalize truncate">
                          {loan?.loanType || 'Personal'}
                        </p>
                        <div className="flex items-center gap-1 text-slate-500 dark:text-neutral-400 text-xs mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateSafe(loan?.createdAt)}</span>
                        </div>
                      </div>
                      
                      {/* Column 4: Status Badge (Soft Pill) */}
                      <div className="w-28 flex justify-center">
                        <LoanStatusBadge status={loan.status as LoanStatus} size="sm" />
                      </div>
                      
                      {/* Column 5: Actions */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-52 rounded-xl shadow-lg ring-1 ring-black/5"
                          >
                            {/* View - Always available */}
                            <DropdownMenuItem onClick={() => navigate(`/employee/loans/${loan.id}`)}>
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {/* Edit - Permission-based */}
                            {loanPermissions.canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLoanId(loan.id);
                                  setEditLoanDrawerOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                                Edit Loan
                              </DropdownMenuItem>
                            )}
                            {/* Delete - Restricted */}
                            {(loan.status === 'draft' || loan.status === 'rejected' || 
                              profile?.role === 'admin' || profile?.employee_category === 'manager') && (
                              <DropdownMenuItem
                                destructive
                                onClick={() => setDeleteLoanId(loan.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Premium Empty State */
            <div className="py-16 px-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                <CreditCard className="w-10 h-10 text-[#006BFF]" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No loans found' : 'No loans yet'}
              </h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm max-w-md mx-auto mb-6">
                {searchTerm 
                  ? "No loans match your search criteria. Try adjusting your search or filters."
                  : "Start by creating your first loan application."
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link to="/employee/loans/create">
                  <Button className="bg-[#006BFF] hover:bg-[#0052CC] text-white rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Loan
                  </Button>
                </Link>
              )}
            </div>
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
