import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query as firestoreQuery, where, orderBy, doc, updateDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
// Using native select for sorting
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  FileText, 
  Loader2, 
  Eye, 
  Download, 
  ArrowUpDown,
  DollarSign,
  TrendingUp,
  Percent,
  BarChart3,
  Calendar,
  User,
  Phone,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  CheckSquare,
  Square,
  Upload
} from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { LoanApprovalDialog } from '../components/LoanApprovalDialog';
import { exportLoans } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { calculateLoanFinancials } from '../../../lib/firebase/loan-calculations';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { LoanStatusBadge } from '../../../components/loans/LoanStatusBadge';
import { LoanActionButtons } from '../../../components/loans/LoanActionButtons';
import { LoanStatus, UserRole } from '../../../types/loan-workflow';
import { submitLoanForReview, disburseLoan } from '../../../lib/loans/workflow';
import { useAgency } from '../../../hooks/useAgency';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Breadcrumbs } from '../../../components/ui/breadcrumbs';
import { StickyActionBar, StickyActionBarSpacer } from '../../../components/ui/sticky-action-bar';
import { EmptyState } from '../../../components/ui/empty-state';
import { TableCard, TableCardRow } from '../../../components/ui/responsive-table';

type SortOption = 'date' | 'repaymentDate' | 'status' | 'amount' | 'customerName';

export function LoansPage() {
  const { profile, user } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Read query parameters from URL on mount and when they change
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const overdueParam = searchParams.get('overdue');
    
    if (statusParam) {
      setStatusFilter(statusParam);
    } else if (overdueParam === 'true') {
      setStatusFilter('overdue');
    }
  }, [searchParams]);
  const [newLoanDrawerOpen, setNewLoanDrawerOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<{ id: string; status: string } | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<{ id: string; loanNumber?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkPaymentDialogOpen, setBulkPaymentDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('active');
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState<string>('');
  const [bulkPaymentDate, setBulkPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Get user role
  const userRole = (profile?.role === 'admin' ? UserRole.ADMIN :
                   profile?.employee_category === 'accountant' ? UserRole.ACCOUNTANT :
                   profile?.employee_category === 'loan_officer' ? UserRole.LOAN_OFFICER :
                   UserRole.ADMIN) as UserRole;

  // Fetch all loans
  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ['loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      const loansData = snapshot.docs
        .map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }))
        .filter((loan: any) => !loan.deleted); // Filter out deleted loans

      // Fetch customer data, repayments, and calculate metrics for each loan
      const loansWithDetails = await Promise.all(
        loansData.map(async (loan: any) => {
          // Fetch customer
          if (loan.customerId) {
            try {
              const { doc: getDocRef, getDoc } = await import('firebase/firestore');
              const customerRef = getDocRef(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
              const customerDoc = await getDoc(customerRef);
              if (customerDoc.exists()) {
                loan.customer = { id: customerDoc.id, ...customerDoc.data() };
              }
            } catch (error) {
              console.warn('Failed to fetch customer:', error);
              loan.customer = null;
            }
          }

          // Fetch repayments
          try {
            const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'repayments');
            const repaymentsSnapshot = await getDocs(repaymentsRef);
            loan.repayments = repaymentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
              paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
            }));
            
            const totalPaid = loan.repayments.reduce((sum: number, r: any) => 
              sum + Number(r.amountPaid || 0), 0);
            loan.totalPaid = totalPaid;

            // Get next payment due date
            const pendingRepayments = loan.repayments
              .filter((r: any) => r.status === 'pending' && r.dueDate)
              .sort((a: any, b: any) => {
                const dateA = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate);
                const dateB = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate);
                return dateA.getTime() - dateB.getTime();
              });
            loan.nextPaymentDue = pendingRepayments[0]?.dueDate || null;
          } catch (error) {
            loan.repayments = [];
            loan.totalPaid = 0;
            loan.nextPaymentDue = null;
          }

          // Calculate financial metrics
          const principal = Number(loan.amount || 0);
          const interestRate = Number(loan.interestRate || 0);
          const durationMonths = Number(loan.durationMonths || 0);
          
          if (principal > 0 && interestRate > 0 && durationMonths > 0) {
            const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
            loan.financials = financials;
            loan.remainingBalance = Math.max(0, financials.totalAmount - loan.totalPaid);
            loan.expectedProfit = financials.totalInterest;
            loan.paymentProgress = financials.totalAmount > 0 ? (loan.totalPaid / financials.totalAmount) * 100 : 0;
          } else {
            loan.financials = null;
            loan.remainingBalance = principal;
            loan.expectedProfit = 0;
            loan.paymentProgress = 0;
          }

          return loan;
        })
      );

      return loansWithDetails;
    },
    enabled: !!profile?.agency_id,
  });

  // Filter and sort loans
  const filteredAndSortedLoans = useMemo(() => {
    if (!loans) return [];

    let filtered = loans.filter((loan: any) => {
      // Status filter - handle special cases
      if (statusFilter !== 'all') {
        const loanStatus = (loan.status || '').toLowerCase();
        
        if (statusFilter === 'active') {
          // Active includes both 'active' and 'approved' loans
          if (loanStatus !== 'active' && loanStatus !== 'approved') {
            return false;
          }
        } else if (statusFilter === 'overdue') {
          // Overdue loans: have pending repayments past due date
          const now = new Date();
          const hasOverdueRepayment = loan.repayments?.some((r: any) => {
            if (r.status !== 'pending') return false;
            const dueDate = r.dueDate instanceof Date ? r.dueDate : new Date(r.dueDate);
            return dueDate < now;
          });
          if (!hasOverdueRepayment) {
            return false;
          }
        } else if (statusFilter === 'settled') {
          // Settled includes both 'settled' and 'paid' loans
          if (loanStatus !== 'settled' && loanStatus !== 'paid') {
            return false;
          }
        } else if (statusFilter === 'pending') {
          // Pending filter - exact match
          if (loanStatus !== 'pending') {
            return false;
          }
        } else if (statusFilter === 'under_review') {
          if (loanStatus !== 'under_review') {
            return false;
          }
        } else if (statusFilter === 'closed') {
          // Closed includes both 'closed' and 'paid' for backward compatibility
          if (loanStatus !== 'closed' && loanStatus !== 'paid' && loanStatus !== 'settled') {
            return false;
          }
        } else {
          // Exact match for other filters
          if (loanStatus !== statusFilter.toLowerCase()) {
            return false;
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          loan.id?.toLowerCase().includes(search) ||
          loan.loanNumber?.toLowerCase().includes(search) ||
          loan.customer?.fullName?.toLowerCase().includes(search) ||
          loan.customer?.name?.toLowerCase().includes(search) ||
          loan.customer?.nrcNumber?.toLowerCase().includes(search) ||
          loan.customer?.nrc?.toLowerCase().includes(search) ||
          loan.customer?.phone?.toLowerCase().includes(search) ||
          String(loan.amount || '').includes(search)
        );
      }

      return true;
    });

    // Sort
    filtered.sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
          bValue = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
          break;
        case 'repaymentDate':
          aValue = a.nextPaymentDue instanceof Date ? a.nextPaymentDue : new Date(a.nextPaymentDue || 0);
          bValue = b.nextPaymentDue instanceof Date ? b.nextPaymentDue : new Date(b.nextPaymentDue || 0);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'amount':
          aValue = Number(a.amount || 0);
          bValue = Number(b.amount || 0);
          break;
        case 'customerName':
          aValue = (a.customer?.fullName || a.customer?.name || '').toLowerCase();
          bValue = (b.customer?.fullName || b.customer?.name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [loans, statusFilter, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil((filteredAndSortedLoans.length || 0) / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLoans = filteredAndSortedLoans.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  // Handle loan actions
  const handleSubmitLoan = async (loanId: string) => {
    if (!agency?.id || !user?.id) {
      toast.error('Agency or user not found');
      return;
    }

    try {
      const result = await submitLoanForReview({
        loanId,
        agencyId: agency.id,
        userId: user.id,
        userRole,
      });

      if (result.success) {
        toast.success('Loan submitted for review');
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      } else {
        toast.error(result.error || 'Failed to submit loan');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit loan');
    }
  };

  const handleDisburseLoan = async (loanId: string) => {
    if (!agency?.id || !user?.id) {
      toast.error('Agency or user not found');
      return;
    }

    try {
      const result = await disburseLoan(loanId, agency.id, user.id, userRole);
      if (result.success) {
        toast.success('Loan disbursed successfully');
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      } else {
        toast.error(result.error || 'Failed to disburse loan');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to disburse loan');
    }
  };

  // Delete loan mutation
  // Bulk status update
  const bulkStatusUpdate = useMutation({
    mutationFn: async (loanIds: string[]) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const batch = writeBatch(db);
      loanIds.forEach(loanId => {
        const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
        batch.update(loanRef, {
          status: bulkStatus,
          updatedAt: serverTimestamp(),
        });
      });
      
      await batch.commit();
      
      // Create audit logs
      for (const loanId of loanIds) {
        await createAuditLog(profile.agency_id, {
          actorId: user?.id || 'system',
          action: 'bulk_status_update',
          targetCollection: 'loans',
          targetId: loanId,
          metadata: { newStatus: bulkStatus, bulkOperation: true },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success(`Updated ${selectedLoans.size} loan(s) status to ${bulkStatus}`);
      setSelectedLoans(new Set());
      setBulkStatusDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update loans');
    },
  });

  // Bulk payment recording
  const bulkPaymentRecord = useMutation({
    mutationFn: async (loanIds: string[]) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      if (!bulkPaymentAmount) throw new Error('Payment amount is required');
      
      const amount = parseFloat(bulkPaymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid payment amount');
      
      const batch = writeBatch(db);
      
      for (const loanId of loanIds) {
        const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        
        // Find next pending repayment
        const repayments = repaymentsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status === 'pending')
          .sort((a: any, b: any) => {
            const aDate = a.dueDate?.toDate?.() || new Date(a.dueDate);
            const bDate = b.dueDate?.toDate?.() || new Date(b.dueDate);
            return aDate.getTime() - bDate.getTime();
          });
        
        if (repayments.length > 0) {
          const repayment = repayments[0];
          const repaymentRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments', repayment.id);
          
          const amountPaid = (repayment.amountPaid || 0) + amount;
          const isFullyPaid = amountPaid >= repayment.amountDue;
          
          batch.update(repaymentRef, {
            amountPaid,
            status: isFullyPaid ? 'paid' : 'partial',
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      
      await batch.commit();
      
      // Create audit logs
      for (const loanId of loanIds) {
        await createAuditLog(profile.agency_id, {
          actorId: user?.id || 'system',
          action: 'bulk_payment_recorded',
          targetCollection: 'loans',
          targetId: loanId,
          metadata: { amount, paymentDate: bulkPaymentDate, bulkOperation: true },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success(`Recorded payments for ${selectedLoans.size} loan(s)`);
      setSelectedLoans(new Set());
      setBulkPaymentAmount('');
      setBulkPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payments');
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async (loanId: string) => {
      if (!profile?.agency_id || !loanId) throw new Error('Missing agency ID or loan ID');
      
      // Soft delete - mark as deleted instead of actually deleting
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      await updateDoc(loanRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.id || profile.id,
        updatedAt: serverTimestamp(),
      });

      // Create audit log
      await createAuditLog(profile.agency_id, {
        actorId: user?.id || profile.id,
        action: 'delete_loan',
        targetCollection: 'loans',
        targetId: loanId,
        metadata: { softDelete: true },
      });
    },
    onSuccess: () => {
      toast.success('Loan deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setDeleteDialogOpen(false);
      setLoanToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete loan');
    },
  });

  const stats = useMemo(() => {
    if (!loans) return null;
    
    return {
      total: loans.length,
      totalPortfolio: loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
      totalCollected: loans.reduce((sum: number, l: any) => sum + (l.totalPaid || 0), 0),
      totalOutstanding: loans.reduce((sum: number, l: any) => sum + (l.remainingBalance || 0), 0),
      expectedProfit: loans.reduce((sum: number, l: any) => sum + (l.expectedProfit || 0), 0),
    };
  }, [loans]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-neutral-900 dark:text-neutral-100">Loans</h1>
          <p className="helper-text mt-1">Manage and track all loans in your portfolio</p>
        </div>
        <div className="hidden md:flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (filteredAndSortedLoans && filteredAndSortedLoans.length > 0) {
                exportLoans(filteredAndSortedLoans);
                toast.success('Loans exported successfully');
              } else {
                toast.error('No loans to export');
              }
            }}
            className="rounded-lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            onClick={() => setNewLoanDrawerOpen(true)}
            className="bg-[#006BFF] hover:bg-[#0052CC] text-white rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </div>

      {/* Sticky Action Bar for Mobile */}
      <StickyActionBar>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (filteredAndSortedLoans && filteredAndSortedLoans.length > 0) {
                exportLoans(filteredAndSortedLoans);
                toast.success('Loans exported successfully');
              } else {
                toast.error('No loans to export');
              }
            }}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            onClick={() => setNewLoanDrawerOpen(true)}
            className="flex-1 bg-[#006BFF] hover:bg-[#0052CC] text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </StickyActionBar>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Portfolio</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 currency-amount">
                    {formatCurrency(stats.totalPortfolio, 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{stats.total} loans</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Collected</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 currency-amount">
                    {formatCurrency(stats.totalCollected, 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    <span className="currency-amount">{formatCurrency(stats.totalOutstanding, 'ZMW')}</span> outstanding
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Expected Profit</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1 currency-amount">
                    {formatCurrency(stats.expectedProfit, 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">From interest</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1 currency-amount">
                    {formatCurrency(stats.totalOutstanding, 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Remaining to collect</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <Percent className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content with Tabs */}
      <Card className="border-neutral-200">
        <CardHeader className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col gap-4">
            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search by loan ID, customer name, NRC, or phone..."
                  className="pl-9 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="flex h-10 w-full sm:w-[200px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#006BFF]/20 dark:focus:ring-blue-500/30 focus:border-[#006BFF] dark:focus:border-blue-500 transition-all"
              >
                <option value="date">Date Issued</option>
                <option value="repaymentDate">Repayment Date</option>
                <option value="status">Status</option>
                <option value="amount">Amount</option>
                <option value="customerName">Customer Name</option>
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded-lg"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter Tabs */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                <TabsList className="inline-flex w-full md:grid md:grid-cols-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 min-w-max md:min-w-0">
                  <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 whitespace-nowrap">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Pending
                  </TabsTrigger>
                  <TabsTrigger value="active" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Active
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Approved
                  </TabsTrigger>
                  <TabsTrigger value="settled" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Settled
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Rejected
                  </TabsTrigger>
                  <TabsTrigger value="defaulted" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 whitespace-nowrap">
                    Defaulted
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          </div>
        </CardHeader>

        {/* Bulk Actions Bar */}
        {selectedLoans.size > 0 && (
          <div className="border-b border-neutral-200 dark:border-neutral-800 bg-blue-50 dark:bg-blue-900/20 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedLoans.size} loan{selectedLoans.size > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLoans(new Set())}
                className="text-xs"
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkStatusDialogOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Update Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkPaymentDialogOpen(true)}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedLoansData = filteredAndSortedLoans.filter((loan: any) => selectedLoans.has(loan.id));
                  exportLoans(selectedLoansData);
                  toast.success('Selected loans exported successfully');
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAndSortedLoans.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLoans.size === paginatedLoans.length && paginatedLoans.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLoans(new Set(paginatedLoans.map((loan: any) => loan.id)));
                            } else {
                              setSelectedLoans(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Loan Details</TableHead>
                      <TableHead className="font-semibold">Customer</TableHead>
                      <TableHead className="font-semibold text-right">Loan Amount</TableHead>
                      <TableHead className="font-semibold text-right">Amount Repaid</TableHead>
                      <TableHead className="font-semibold text-right">Amount Owed</TableHead>
                      <TableHead className="font-semibold text-right">Interest Rate</TableHead>
                      <TableHead className="font-semibold">Duration</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Next Payment</TableHead>
                      <TableHead className="font-semibold">Risk Score</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLoans.map((loan: any) => {
                    const principal = Number(loan.amount || 0);
                    const interestRate = Number(loan.interestRate || 0);
                    const totalPaid = loan.totalPaid || 0;
                    const totalPayable = loan.financials?.totalAmount || principal;
                    const remainingBalance = loan.remainingBalance || totalPayable;
                    const durationMonths = loan.durationMonths || 0;
                    const riskScore = loan.riskScore || 0;

                    return (
                      <TableRow 
                        key={loan.id} 
                        className={cn(
                          "hover:bg-neutral-50 transition-colors",
                          selectedLoans.has(loan.id) && "bg-blue-50"
                        )}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLoans.has(loan.id)}
                            onCheckedChange={(checked) => {
                              const newSelection = new Set(selectedLoans);
                              if (checked) {
                                newSelection.add(loan.id);
                              } else {
                                newSelection.delete(loan.id);
                              }
                              setSelectedLoans(newSelection);
                            }}
                          />
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/loans/${loan.id}`)}
                        >
                          <div className="space-y-1">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {loan.loanNumber || loan.id.substring(0, 12)}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {loan.loanType || 'Standard Loan'}
                            </div>
                            <div className="text-xs text-neutral-400">
                              {formatDateSafe(loan.createdAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/loans/${loan.id}`)}
                        >
                          <div className="space-y-1">
                            <div className="font-medium text-neutral-900">
                              {loan.customer?.fullName || loan.customer?.name || 'N/A'}
                            </div>
                            {loan.customer?.phone && (
                              <div className="text-xs text-neutral-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {loan.customer.phone}
                              </div>
                            )}
                            {loan.customer?.nrcNumber && (
                              <div className="text-xs text-neutral-500">
                                NRC: {loan.customer.nrcNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-neutral-900 currency-amount">
                            {formatCurrency(principal, 'ZMW')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-emerald-600 currency-amount">
                            {formatCurrency(totalPaid, 'ZMW')}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {loan.paymentProgress?.toFixed(1) || 0}% paid
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-red-600 currency-amount">
                            {formatCurrency(remainingBalance, 'ZMW')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-neutral-900 currency-amount">
                            {interestRate}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-700">
                            {durationMonths} months
                          </div>
                        </TableCell>
                        <TableCell>
                          <LoanStatusBadge status={loan.status as LoanStatus} />
                        </TableCell>
                        <TableCell>
                          {loan.nextPaymentDue ? (
                            <div className="text-sm text-neutral-700">
                              {formatDateSafe(loan.nextPaymentDue)}
                            </div>
                          ) : (
                            <div className="text-sm text-neutral-400">N/A</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "text-sm font-medium",
                            riskScore >= 80 ? "text-emerald-600" :
                            riskScore >= 60 ? "text-amber-600" :
                            "text-red-600"
                          )}>
                            {riskScore}/100
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <LoanActionButtons
                              loanStatus={loan.status as LoanStatus}
                              userRole={userRole}
                              isLoanOwner={loan.created_by === user?.id || loan.officerId === user?.id}
                              onSubmit={() => handleSubmitLoan(loan.id)}
                              onApprove={() => {
                                setSelectedLoan({ id: loan.id, status: loan.status });
                                setApprovalDialogOpen(true);
                              }}
                              onReject={() => {
                                setSelectedLoan({ id: loan.id, status: loan.status });
                                setApprovalDialogOpen(true);
                              }}
                              onDisburse={() => handleDisburseLoan(loan.id)}
                              onManageRepayments={() => navigate(`/admin/loans/${loan.id}?tab=repayments`)}
                              onClose={() => {
                                setSelectedLoan({ id: loan.id, status: loan.status });
                                setStatusDialogOpen(true);
                              }}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/admin/loans/${loan.id}`} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                {(userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedLoan({ id: loan.id, status: loan.status });
                                      setStatusDialogOpen(true);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Change Status
                                  </DropdownMenuItem>
                                )}
                                {(userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLoanToDelete({ id: loan.id, loanNumber: loan.loanNumber });
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Loan
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {filteredAndSortedLoans.length > pageSize && (
              <div className="border-t border-neutral-200 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-neutral-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedLoans.length)} of {filteredAndSortedLoans.length} loans
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="rounded-lg min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
            ) : (
            <EmptyState
              icon={FileText}
              title="No loans found"
              description={
                searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters to find loans'
                  : 'Get started by creating your first loan in the system'
              }
              action={
                !searchTerm && statusFilter === 'all'
                  ? {
                      label: 'New Loan',
                      onClick: () => setNewLoanDrawerOpen(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Spacer for sticky action bar on mobile */}
      <StickyActionBarSpacer />

      <NewLoanDrawer
        open={newLoanDrawerOpen}
        onOpenChange={setNewLoanDrawerOpen}
        onSuccess={() => {
          refetch();
        }}
      />

      {selectedLoan && (
        <LoanStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          loanId={selectedLoan.id}
          currentStatus={selectedLoan.status}
          agencyId={profile?.agency_id || ''}
        />
      )}

      {/* Bulk Status Update Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Status</DialogTitle>
            <DialogDescription>
              Update status for {selectedLoans.size} selected loan{selectedLoans.size > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Status</Label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="settled">Settled</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkStatusUpdate.mutate(Array.from(selectedLoans))}
              disabled={bulkStatusUpdate.isPending}
            >
              {bulkStatusUpdate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update {selectedLoans.size} Loan{selectedLoans.size > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Payment Dialog */}
      <Dialog open={bulkPaymentDialogOpen} onOpenChange={setBulkPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Record Payment</DialogTitle>
            <DialogDescription>
              Record payment for {selectedLoans.size} selected loan{selectedLoans.size > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                value={bulkPaymentAmount}
                onChange={(e) => setBulkPaymentAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={bulkPaymentDate}
                onChange={(e) => setBulkPaymentDate(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!bulkPaymentAmount) {
                  toast.error('Please enter payment amount');
                  return;
                }
                bulkPaymentRecord.mutate(Array.from(selectedLoans));
              }}
              disabled={bulkPaymentRecord.isPending}
            >
              {bulkPaymentRecord.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Loan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this loan? This action will mark the loan as deleted (soft delete) and it will no longer appear in the loans list.
              {loanToDelete?.loanNumber && (
                <div className="mt-2 font-semibold text-neutral-900">
                  Loan: {loanToDelete.loanNumber}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setLoanToDelete(null);
              }}
              disabled={deleteLoan.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (loanToDelete?.id) {
                  deleteLoan.mutate(loanToDelete.id);
                }
              }}
              disabled={deleteLoan.isPending}
            >
              {deleteLoan.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Approval Dialog */}
      {selectedLoan && agency?.id && (
        <LoanApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          loanId={selectedLoan.id}
          agencyId={agency.id}
          currentStatus={selectedLoan.status as LoanStatus}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            refetch();
            setSelectedLoan(null);
          }}
        />
      )}
    </div>
  );
}
