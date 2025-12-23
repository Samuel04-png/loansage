import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc, query as firestoreQuery, where, orderBy, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  FileText, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  XCircle,
  Edit,
  Trash2,
  Plus,
  Shield,
  History,
  Phone,
  Mail,
  MapPin,
  Loader2,
  CreditCard,
  MoreVertical,
  Send
} from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { RepaymentSection } from '../../../components/repayment/RepaymentSection';
import { AddPaymentDialog } from '../../../components/payment/AddPaymentDialog';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { calculateLoanFinancials } from '../../../lib/firebase/loan-calculations';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import { useLoanAIInsights } from '../../../hooks/useAIInsights';
import { AIInsightsPanel } from '../../../components/ai/AIInsightsPanel';
import { Sparkles } from 'lucide-react';
import { AddCollateralDrawer } from '../components/AddCollateralDrawer';
import { LoanApprovalDialog } from '../components/LoanApprovalDialog';
import { LoanStatus, UserRole, getLoanPermissions } from '../../../types/loan-workflow';
import { submitLoanForReview, disburseLoan } from '../../../lib/loans/workflow';
import { useAgency } from '../../../hooks/useAgency';

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const { agency } = useAgency();
  const queryClient = useQueryClient();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addCollateralDrawerOpen, setAddCollateralDrawerOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Get user role
  const userRole = (profile?.role === 'admin' ? UserRole.ADMIN : 
                   profile?.employee_category === 'accountant' ? UserRole.ACCOUNTANT :
                   profile?.employee_category === 'loan_officer' ? UserRole.LOAN_OFFICER :
                   UserRole.ADMIN) as UserRole;

  // Handle loan actions
  const handleSubmitLoan = async () => {
    if (!agency?.id || !user?.id || !loanId) {
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
        queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      } else {
        toast.error(result.error || 'Failed to submit loan');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit loan');
    }
  };

  const handleDisburseLoan = async () => {
    if (!agency?.id || !user?.id || !loanId) {
      toast.error('Agency or user not found');
      return;
    }

    try {
      const result = await disburseLoan(loanId, agency.id, user.id, userRole);
      if (result.success) {
        toast.success('Loan disbursed successfully');
        queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      } else {
        toast.error(result.error || 'Failed to disburse loan');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to disburse loan');
    }
  };

  // AI Insights for this loan
  const { insights: loanAIInsights, isLoading: aiLoading } = useLoanAIInsights(loanId, true);

  // Fetch loan details
  const { data: loan, isLoading, error: loanError, refetch: refetchLoan } = useQuery({
    queryKey: ['loan', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return null;

      try {
        const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
        const loanSnap = await getDoc(loanRef);
        
        if (!loanSnap.exists()) return null;
        
        const loanData = { id: loanSnap.id, ...loanSnap.data() };

        // Get customer info - check both customerId and customer_id fields
        const customerId = loanData.customerId || loanData.customer_id;
        if (customerId) {
          try {
            const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists()) {
              loanData.customer = { id: customerSnap.id, ...customerSnap.data() };
            } else {
              console.warn(`Customer document not found for ID: ${customerId}`);
              // Try to find customer by querying if direct lookup fails
              try {
                const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
                const customerQuery = firestoreQuery(
                  customersRef,
                  where('id', '==', customerId)
                );
                const customerQuerySnap = await getDocs(customerQuery);
                if (!customerQuerySnap.empty) {
                  loanData.customer = { id: customerQuerySnap.docs[0].id, ...customerQuerySnap.docs[0].data() };
                }
              } catch (queryError) {
                console.warn('Failed to query customer:', queryError);
              }
            }
          } catch (error) {
            console.error('Failed to fetch customer:', error);
          }
        } else {
          console.warn('No customerId or customer_id found in loan data');
        }

        // Get officer info
        if (loanData.officerId) {
          try {
            const userRef = doc(db, 'users', loanData.officerId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              loanData.officer = { id: userSnap.id, ...userSnap.data() };
            }
          } catch (error) {
            console.warn('Failed to fetch officer:', error);
          }
        }

        // Get repayments
        const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        loanData.repayments = repaymentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
          paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
        }));

        // Get collateral from loan's subcollection
        try {
        const collateralRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'collateral');
        const collateralSnapshot = await getDocs(collateralRef);
        loanData.collateral = collateralSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
          }));
        } catch (error) {
          console.warn('Error fetching collateral:', error);
          loanData.collateral = [];
        }
        
        // Also check top-level collateral registry for this loan
        if (!loanData.collateral || loanData.collateral.length === 0) {
          try {
            const registryRef = collection(db, 'agencies', profile.agency_id, 'collateral');
            const registrySnapshot = await getDocs(registryRef);
            const registryCollateral = registrySnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter((coll: any) => coll.loanId === loanId);
            
            if (registryCollateral.length > 0) {
              loanData.collateral = registryCollateral;
            }
          } catch (error) {
            console.warn('Error fetching collateral from registry:', error);
          }
        }

        return loanData;
      } catch (error) {
        console.error('Error fetching loan:', error);
        throw error;
      }
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Fetch customer's other loans
  const customerIdForQuery = loan?.customerId || (loan as any)?.customer_id;
  const { data: customerLoans } = useQuery({
    queryKey: ['customer-loans', profile?.agency_id, customerIdForQuery],
    queryFn: async () => {
      if (!profile?.agency_id || !customerIdForQuery) return [];
      
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      // Try both customerId and customer_id fields
      const q1 = firestoreQuery(loansRef, where('customerId', '==', customerIdForQuery));
      const q2 = firestoreQuery(loansRef, where('customer_id', '==', customerIdForQuery));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allLoans = new Map();
      
      snap1.docs.forEach(doc => {
        if (doc.id !== loanId) {
          allLoans.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
      
      snap2.docs.forEach(doc => {
        if (doc.id !== loanId) {
          allLoans.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
      
      return Array.from(allLoans.values());
    },
    enabled: !!profile?.agency_id && !!customerIdForQuery && !!loan,
  });

  // Fetch activity logs for this loan
  const { data: activityLogs } = useQuery({
    queryKey: ['loan-activity-logs', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return [];

      const logsRef = collection(db, 'agencies', profile.agency_id, 'audit_logs');
      const q = firestoreQuery(
        logsRef,
        where('targetId', '==', loanId),
        where('targetCollection', '==', 'loans'),
        orderBy('createdAt', 'desc')
      );
      
      try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));
      } catch (error) {
        // If query fails (e.g., missing index), try without orderBy
        const q2 = firestoreQuery(
          logsRef,
          where('targetId', '==', loanId),
          where('targetCollection', '==', 'loans')
        );
        const snapshot = await getDocs(q2);
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));
        return logs.sort((a: any, b: any) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
      }
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Delete loan mutation
  const deleteLoan = useMutation({
    mutationFn: async () => {
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
      navigate('/admin/loans');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete loan');
    },
  });

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      approved: { label: 'Approved', className: 'bg-blue-50 text-blue-700 border-blue-200' },
      rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
      settled: { label: 'Settled', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      paid: { label: 'Settled', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      defaulted: { label: 'Defaulted', className: 'bg-red-50 text-red-700 border-red-200' },
    };

    const config = statusConfig[status] || { 
      label: status, 
      className: 'bg-neutral-50 text-neutral-700 border-neutral-200' 
    };
    return <Badge variant="outline" className={cn('border', config.className)}>{config.label}</Badge>;
  };

  // Show loading state while auth or loan data is loading
  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  // If auth is done but no profile, show error (shouldn't happen due to RoleGuard, but safety check)
  if (!profile?.agency_id) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Authentication Error
        </p>
        <p className="text-sm text-neutral-600 mb-6">
          Unable to load your profile. Please try refreshing the page.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()} className="rounded-lg">
          Refresh Page
        </Button>
      </div>
    );
  }

  if (loanError || !loan) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          {loanError ? 'Error loading loan' : 'Loan not found'}
        </p>
        <p className="text-sm text-neutral-600 mb-6">
          {loanError?.message || `Loan ID: ${loanId}`}
        </p>
        <Link to="/admin/loans">
          <Button variant="outline" className="rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </Link>
      </div>
    );
  }
  
  // Calculate financials
  const principal = Number(loan.amount || 0);
  const interestRate = Number(loan.interestRate || 0);
  const durationMonths = Number(loan.durationMonths || 0);
  const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
  const totalPaid = loan.repayments?.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0) || 0;
  const remainingBalance = Math.max(0, financials.totalAmount - totalPaid);
  const startDate = loan.createdAt?.toDate?.() || loan.createdAt || new Date();
  const endDate = loan.endDate?.toDate?.() || loan.endDate || (() => {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + durationMonths);
    return end;
  })();

  // Get permissions for current user and loan status
  const isLoanOwner = loan.created_by === user?.id || loan.officerId === user?.id;
  const permissions = getLoanPermissions(userRole, loan.status as LoanStatus, isLoanOwner);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6"
      >
        <div className="flex flex-col gap-6">
          {/* Top Row: Title and Back Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/loans">
                <Button variant="outline" size="icon" className="rounded-xl">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Loan Details</h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                  {loan.loanNumber || loan.id.substring(0, 12)}
                </p>
              </div>
            </div>
            {getStatusBadge(loan.status)}
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Submit for Review */}
              {permissions.canSubmit && (
                <Button
                  onClick={handleSubmitLoan}
                  className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Review
                </Button>
              )}


              {/* Manage Repayments - Show for active/approved/disbursed loans */}
              {permissions.canManageRepayments && (
                <Button
                  onClick={() => setActiveTab('repayments')}
                  variant="outline"
                  className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Repayments
                </Button>
              )}

              {/* Add Payment - Quick action for active loans */}
              {(loan.status === 'active' || loan.status === 'approved' || loan.status === 'disbursed') && (
                <Button
                  onClick={() => {
                    setActiveTab('repayments');
                    setPaymentDialogOpen(true);
                  }}
                  variant="outline"
                  className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Payment
                </Button>
              )}

              {/* Close Loan - Show for active loans */}
              {permissions.canClose && loan.status === 'active' && (
                <Button
                  onClick={() => setStatusDialogOpen(true)}
                  variant="outline"
                  className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Close Loan
                </Button>
              )}

              {/* Change Status - Show for non-terminal statuses */}
              {loan.status !== 'closed' && loan.status !== 'settled' && loan.status !== 'rejected' && (
                <Button
                  onClick={() => setStatusDialogOpen(true)}
                  variant="outline"
                  className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Change Status
                </Button>
              )}
            </div>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl border-neutral-200 hover:bg-neutral-50">
                  <MoreVertical className="h-4 w-4 mr-2" />
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                {/* Approve */}
                {permissions.canApprove && (
                  (loan.status === 'pending' || loan.status === 'under_review' || loan.status === 'approved' || loan.status === 'draft' || permissions.canOverride) && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedAction('approve');
                          setApprovalDialogOpen(true);
                        }}
                        className="cursor-pointer rounded-lg text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </DropdownMenuItem>
                      {permissions.canReject && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedAction('reject');
                            setApprovalDialogOpen(true);
                          }}
                          className="cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )
                )}

                {/* Disburse */}
                {permissions.canDisburse && (
                  (loan.status === 'approved' || loan.status === 'disbursed' || permissions.canOverride) && loan.status !== 'active' && loan.status !== 'closed' && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          handleDisburseLoan();
                        }}
                        className="cursor-pointer rounded-lg text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                      >
                        <DollarSign className="mr-2 h-4 w-4" />
                        Disburse Loan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )
                )}

                <DropdownMenuItem
                  onClick={() => setActiveTab('repayments')}
                  className="cursor-pointer rounded-lg"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Repayments
                </DropdownMenuItem>
                {(userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setStatusDialogOpen(true)}
                      className="cursor-pointer rounded-lg"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Change Status
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="cursor-pointer text-red-600 focus:text-red-600 rounded-lg"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Loan
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1.5">
          <TabsTrigger 
            value="overview" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-700 transition-all duration-200"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="repayments" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-700 transition-all duration-200"
          >
            Repayments
          </TabsTrigger>
          <TabsTrigger 
            value="collateral" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-700 transition-all duration-200"
          >
            Collateral
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-700 transition-all duration-200"
          >
            Activity Logs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* AI Insights for this loan - Only show if there are actual insights (not just loading) */}
          {!aiLoading && loanAIInsights.length > 0 && (
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#006BFF]" />
                  AI Intelligence Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AIInsightsPanel insights={loanAIInsights} isLoading={false} maxItems={5} />
              </CardContent>
            </Card>
          )}

      <div className="grid gap-6 md:grid-cols-2">
            {/* Customer Overview */}
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-[#006BFF]" />
                  Customer Overview
                </CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                {loan.customer ? (
                  <>
              <div>
                      <p className="text-sm font-medium text-neutral-600 mb-1">Name</p>
                      <p className="text-lg font-semibold text-neutral-900">
                        {loan.customer.fullName || loan.customer.name || 'N/A'}
                </p>
              </div>
                    {loan.customer.nrcNumber && (
              <div>
                        <p className="text-sm font-medium text-neutral-600 mb-1">NRC</p>
                        <p className="text-base text-neutral-900 dark:text-neutral-100">{loan.customer.nrcNumber}</p>
                      </div>
                    )}
                    {loan.customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-neutral-400" />
                        <p className="text-base text-neutral-900">{loan.customer.phone}</p>
                      </div>
                    )}
                    {loan.customer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        <p className="text-base text-neutral-900">{loan.customer.email}</p>
                      </div>
                    )}
                    {loan.customer.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                        <p className="text-base text-neutral-900">{loan.customer.address}</p>
                      </div>
                    )}
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                      <p className="text-sm font-medium text-neutral-600 mb-2">Total Loans</p>
                      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {(customerLoans?.length || 0) + 1}
                      </p>
              </div>
                    {customerLoans && customerLoans.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-neutral-600 mb-2">Other Loans</p>
                        <div className="space-y-2">
                          {customerLoans.slice(0, 3).map((otherLoan: any) => (
                            <Link
                              key={otherLoan.id}
                              to={`/admin/loans/${otherLoan.id}`}
                              className="block p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                            >
                              <div className="flex items-center justify-between">
              <div>
                                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {otherLoan.loanNumber || otherLoan.id.substring(0, 8)}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {formatCurrency(Number(otherLoan.amount || 0), 'ZMW')}
                                  </p>
                                </div>
                                {getStatusBadge(otherLoan.status)}
                              </div>
                            </Link>
                          ))}
                          {customerLoans.length > 3 && (
                            <p className="text-xs text-neutral-500 text-center">
                              +{customerLoans.length - 3} more
                            </p>
                          )}
              </div>
              </div>
                    )}
                    {loan.customer.id && (
                    <Link to={`/admin/customers/${loan.customer.id}`}>
                      <Button variant="outline" className="w-full rounded-lg">
                        View Customer Profile
                      </Button>
                    </Link>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-500">Customer information not available</p>
                    {(loan.customerId || (loan as any).customer_id) && (
                      <p className="text-xs text-neutral-400">
                        Customer ID: {loan.customerId || (loan as any).customer_id}
                      </p>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>

            {/* Loan Information */}
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#006BFF]" />
                  Loan Information
              </CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Loan ID</p>
                    <p className="text-base font-mono text-neutral-900 dark:text-neutral-100">
                      {loan.loanNumber || loan.id.substring(0, 12)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Status</p>
                    {getStatusBadge(loan.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">Principal Amount</p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatCurrency(principal, 'ZMW')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">Interest Amount</p>
                  <p className="text-xl font-semibold text-[#006BFF]">
                    {formatCurrency(financials.totalInterest, 'ZMW')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(financials.totalAmount, 'ZMW')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Amount Repaid</p>
                    <p className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(totalPaid, 'ZMW')}
                  </p>
                </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Amount Remaining</p>
                    <p className="text-lg font-semibold text-red-600">
                      {formatCurrency(remainingBalance, 'ZMW')}
                  </p>
                </div>
              </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Interest Rate</p>
                    <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{interestRate}%</p>
                  </div>
                <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Duration</p>
                    <p className="text-base font-semibold text-neutral-900">{durationMonths} months</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Start Date</p>
                    <p className="text-base text-neutral-900">{formatDateSafe(startDate)}</p>
                </div>
              <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">End Date</p>
                    <p className="text-base text-neutral-900">{formatDateSafe(endDate)}</p>
                  </div>
              </div>
              <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">Loan Type</p>
                  <p className="text-base font-semibold text-neutral-900 capitalize">
                    {loan.loanType || 'Standard Loan'}
                </p>
              </div>
                {loan.riskScore !== undefined && (
                <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">Risk Assessment Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-200 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            loan.riskScore >= 80 ? "bg-emerald-500" :
                            loan.riskScore >= 60 ? "bg-amber-500" :
                            "bg-red-500"
                          )}
                          style={{ width: `${loan.riskScore}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold",
                        loan.riskScore >= 80 ? "text-emerald-600" :
                        loan.riskScore >= 60 ? "text-amber-600" :
                        "text-red-600"
                      )}>
                        {loan.riskScore}/100
                      </span>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
        </TabsContent>

        {/* Repayments Tab */}
        <TabsContent value="repayments" className="mt-6">
          {loan.id && profile?.agency_id && (
            <RepaymentSection loan={loan} agencyId={profile.agency_id} />
          )}
        </TabsContent>

        {/* Collateral Tab */}
        <TabsContent value="collateral" className="mt-6">
          <Card className="border-neutral-200">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#006BFF]" />
                Collateral Information
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setAddCollateralDrawerOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Collateral
              </Button>
            </CardHeader>
            <CardContent>
              {loan.collateral && loan.collateral.length > 0 ? (
                <div className="space-y-4">
                  {loan.collateral.map((coll: any) => (
                    <div
                    key={coll.id}
                      className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold text-neutral-900 capitalize">
                              {coll.type?.replace('_', ' ') || 'N/A'}
                            </p>
                          {coll.verificationStatus && (
                            <Badge 
                                variant={coll.verificationStatus === 'verified' ? 'default' : 'outline'}
                              className={cn(
                                coll.verificationStatus === 'verified' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              )}
                            >
                              {coll.verificationStatus}
                            </Badge>
                          )}
                          </div>
                          <p className="text-sm text-neutral-600 mb-2">
                            {coll.description || 'No description'}
                          </p>
                          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                            {coll.brand && <span>Brand: {coll.brand}</span>}
                            {coll.model && <span>Model: {coll.model}</span>}
                            {coll.year && <span>Year: {coll.year}</span>}
                            {coll.serialNumber && <span>Serial: {coll.serialNumber}</span>}
                            {coll.condition && <span className="capitalize">Condition: {coll.condition}</span>}
                            {coll.location && <span>Location: {coll.location}</span>}
                          </div>
                          {coll.photos && coll.photos.length > 0 && (
                            <div className="mt-3 flex gap-2">
                              {coll.photos.slice(0, 3).map((photo: string, idx: number) => (
                                <img
                                  key={idx}
                                  src={photo}
                                  alt={`Collateral ${idx + 1}`}
                                  className="w-16 h-16 object-cover rounded border border-neutral-200"
                                />
                              ))}
                              {coll.photos.length > 3 && (
                                <div className="w-16 h-16 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center text-xs text-neutral-500">
                                  +{coll.photos.length - 3}
                                </div>
                          )}
                        </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-neutral-900">
                            {formatCurrency(Number(coll.estimatedValue || coll.value || 0), 'ZMW')}
                          </p>
                          <p className="text-xs text-neutral-500">Estimated Value</p>
                        </div>
                        </div>
                      </div>
                ))}
              </div>
              ) : (
                <div className="text-center py-12 text-neutral-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>No collateral registered for this loan</p>
            <Button
              variant="outline"
                    className="mt-4 rounded-lg"
              onClick={() => {
                      setAddCollateralDrawerOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Collateral
            </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#006BFF]" />
                Activity Logs
              </CardTitle>
          </CardHeader>
          <CardContent>
              {activityLogs && activityLogs.length > 0 ? (
                <div className="space-y-4">
                  {activityLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                          <History className="w-5 h-5 text-neutral-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-neutral-900 capitalize">
                              {log.action?.replace('_', ' ') || 'Unknown Action'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.targetCollection}
                            </Badge>
                </div>
                          {log.metadata && (
                            <div className="text-sm text-neutral-600 mb-2">
                              {log.metadata.oldStatus && log.metadata.newStatus && (
                                <p>
                                  Status changed from <span className="font-medium">{log.metadata.oldStatus}</span> to{' '}
                                  <span className="font-medium">{log.metadata.newStatus}</span>
                                </p>
                              )}
                              {log.metadata.amount && (
                                <p>Amount: {formatCurrency(log.metadata.amount, 'ZMW')}</p>
                              )}
                              {log.metadata.reason && (
                                <p>Reason: {log.metadata.reason}</p>
                            )}
                          </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-neutral-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDateSafe(log.createdAt)}
                              </span>
                            {log.actorId && log.actorId !== 'system' && (
                              <span>By: {log.actorId.substring(0, 8)}...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500">
                  <History className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>No activity logs found</p>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {loan.id && (
          <LoanStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            loanId={loan.id}
            currentStatus={loan.status || 'pending'}
            agencyId={profile?.agency_id || ''}
          />
      )}

      {loan && loanId && agency?.id && (
        <LoanApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={(open) => {
            setApprovalDialogOpen(open);
            if (!open) {
              setSelectedAction(null); // Reset action when dialog closes
            }
          }}
          loanId={loanId}
          agencyId={agency.id}
          currentStatus={loan.status as LoanStatus}
          initialAction={selectedAction}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            setSelectedAction(null);
          }}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete Loan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this loan? This action will mark the loan as deleted.
              You can restore it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteLoan.mutate();
                setDeleteDialogOpen(false);
              }}
              disabled={deleteLoan.isPending}
              className="rounded-lg"
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

      {/* Add Collateral Drawer */}
      <AddCollateralDrawer
        open={addCollateralDrawerOpen}
        onOpenChange={setAddCollateralDrawerOpen}
        initialLoanId={loanId}
        initialCustomerId={loan?.customerId || (loan as any)?.customer_id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['loan', profile?.agency_id, loanId] });
          queryClient.invalidateQueries({ queryKey: ['collaterals', profile?.agency_id] });
          refetchLoan();
          toast.success('Collateral added successfully');
        }}
      />
    </div>
  );
}
