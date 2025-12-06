import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { ArrowLeft, DollarSign, Calendar, FileText, User, AlertTriangle, CheckCircle2, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { RepaymentSection } from '../../../components/repayment/RepaymentSection';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { calculateLoanFinancials, calculateLoanProfit } from '../../../lib/firebase/loan-calculations';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const { profile } = useAuth();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  // Fetch loan details
  const { data: loan, isLoading, error: loanError } = useQuery({
    queryKey: ['loan', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) {
        console.warn('Missing agency_id or loanId', { agency_id: profile?.agency_id, loanId });
        return null;
      }

      try {
        const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
        const loanSnap = await getDoc(loanRef);
        
        if (!loanSnap.exists()) {
          console.warn('Loan document does not exist', { loanId, agency_id: profile.agency_id });
          return null;
        }
        
        const loanData = { id: loanSnap.id, ...loanSnap.data() };
        console.log('Loan data fetched:', loanData);

        // Get customer info
        if (loanData.customerId) {
          try {
            const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loanData.customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists()) {
              loanData.customer = { id: customerSnap.id, ...customerSnap.data() };
            }
          } catch (error) {
            console.warn('Failed to fetch customer:', error);
          }
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

        // Get collateral
        const collateralRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'collateral');
        const collateralSnapshot = await getDocs(collateralRef);
        loanData.collateral = collateralSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        return loanData;
      } catch (error) {
        console.error('Error fetching loan:', error);
        throw error;
      }
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'completed':
      case 'paid':
        return <Badge variant="success">Completed</Badge>;
      case 'defaulted':
        return <Badge variant="destructive">Defaulted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loanError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[#EF4444]" />
        <p className="text-lg font-semibold text-neutral-900 mb-2">Error loading loan</p>
        <p className="text-sm text-neutral-600 mb-6">{loanError.message || 'Unknown error'}</p>
        <Link to="/admin/loans">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </Link>
      </motion.div>
    );
  }

  if (!loan && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
        <p className="text-lg font-semibold text-neutral-900 mb-2">Loan not found</p>
        <p className="text-sm text-neutral-600 mb-6">Loan ID: {loanId}</p>
        <Link to="/admin/loans">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </Link>
      </motion.div>
    );
  }

  if (!loan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#006BFF]" />
      </div>
    );
  }

  const totalPaid = loan.repayments?.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0) || 0;
  const totalDue = loan.repayments?.reduce((sum: number, r: any) => sum + Number(r.amountDue || 0), 0) || 0;
  
  // Calculate financials
  const principal = Number(loan.amount || 0);
  const interestRate = Number(loan.interestRate || 0);
  const durationMonths = Number(loan.durationMonths || 0);
  
  const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
  const profitData = calculateLoanProfit(principal, interestRate, totalPaid);
  
  const outstanding = financials.totalAmount - totalPaid;
  const overdueRepayments = loan.repayments?.filter((r: any) => {
    if (r.status === 'paid') return false;
    try {
      const dueDate = r.dueDate?.toDate 
        ? r.dueDate.toDate() 
        : r.dueDate instanceof Date 
        ? r.dueDate 
        : r.dueDate 
        ? new Date(r.dueDate) 
        : null;
      return dueDate && !isNaN(dueDate.getTime()) && dueDate < new Date();
    } catch (error) {
      return false;
    }
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Link to="/admin/loans">
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">Loan Details</h2>
            <p className="text-sm text-neutral-600 font-mono">ID: {loan.id.substring(0, 12)}...</p>
          </div>
        </div>
        <div className="flex gap-3">
          {getStatusBadge(loan.status || 'pending')}
          <Link to={`/admin/loans/${loanId}/analysis`}>
            <Button variant="default" className="rounded-xl">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analysis
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setStatusDialogOpen(true)}
            className="rounded-xl"
          >
            Change Status
          </Button>
        </div>
      </motion.div>

      {/* Loan Information - Reference Style */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900">Loan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Loan Amount</p>
                <p className="font-bold text-xl text-neutral-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#006BFF]" />
                  {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Interest Rate</p>
                <p className="font-semibold text-base text-neutral-900">{loan.interestRate || 0}%</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Duration</p>
                <p className="font-semibold text-base text-neutral-900">{loan.durationMonths || 0} months</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Loan Type</p>
                <p className="font-semibold text-base text-neutral-900 capitalize">{loan.loanType || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#006BFF]" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Principal</p>
                  <p className="text-lg font-bold text-neutral-900">
                    {formatCurrency(principal, 'ZMW')}
                  </p>
                </div>
                <div className="p-4 bg-[#006BFF]/5 rounded-xl border border-[#006BFF]/10">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Total Interest</p>
                  <p className="text-lg font-bold text-[#006BFF]">
                    {formatCurrency(financials.totalInterest, 'ZMW')}
                  </p>
                </div>
                <div className="p-4 bg-[#22C55E]/5 rounded-xl border border-[#22C55E]/10">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Total Amount Owed</p>
                  <p className="text-lg font-bold text-[#22C55E]">
                    {formatCurrency(financials.totalAmount, 'ZMW')}
                  </p>
                </div>
                <div className="p-4 bg-[#FACC15]/5 rounded-xl border border-[#FACC15]/10">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Total Paid</p>
                  <p className="text-lg font-bold text-[#FACC15]">
                    {formatCurrency(totalPaid, 'ZMW')}
                  </p>
                </div>
              </div>
              <div className="border-t border-neutral-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-700">Profit Earned</p>
                  <p className={`text-xl font-bold ${profitData.isProfitable ? 'text-[#22C55E]' : 'text-neutral-400'}`}>
                    {formatCurrency(profitData.profit, 'ZMW')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">Profit Margin</p>
                  <p className={`font-semibold ${profitData.isProfitable ? 'text-[#22C55E]' : 'text-neutral-400'}`}>
                    {profitData.profitMargin.toFixed(2)}%
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">Remaining Balance</p>
                  <p className="font-semibold text-neutral-900">
                    {formatCurrency(profitData.remainingBalance, 'ZMW')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900">Related Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {loan.customer && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Customer</p>
                  <Link to={`/admin/customers/${loan.customer.id}`}>
                    <p className="font-semibold text-[#006BFF] hover:underline text-base">
                      {loan.customer.fullName || 'N/A'}
                    </p>
                  </Link>
                  <p className="text-sm text-neutral-600 mt-1">{loan.customer.email || loan.customer.phone || ''}</p>
                </div>
              )}
              {loan.officer && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Loan Officer</p>
                  <p className="font-semibold text-neutral-900 text-base">{loan.officer.full_name || 'N/A'}</p>
                  <p className="text-sm text-neutral-600 mt-1">{loan.officer.email || ''}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Outstanding Balance</p>
                <p className="font-bold text-lg text-[#FACC15]">
                  {formatCurrency(outstanding, 'ZMW')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Total Paid</p>
                <p className="font-bold text-lg text-[#22C55E]">
                  {formatCurrency(totalPaid, 'ZMW')}
                </p>
              </div>
              {overdueRepayments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Overdue Repayments</p>
                  <p className="font-bold text-lg text-[#EF4444] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {overdueRepayments.length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Collateral - Reference Style */}
      {loan.collateral && loan.collateral.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900">Collateral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loan.collateral.map((coll: any, index: number) => (
                  <motion.div
                    key={coll.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <Link
                      to={`/admin/loans/${loan.id}/collateral/${coll.id}`}
                      className="block p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:border-[#006BFF]/20 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-neutral-900 capitalize mb-1">{coll.type?.replace('_', ' ') || 'N/A'}</p>
                          <p className="text-sm text-neutral-600">{coll.description || 'No description'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-neutral-900">{formatCurrency(Number(coll.estimatedValue || coll.value || 0), 'ZMW')}</p>
                          {coll.verificationStatus && (
                            <Badge 
                              className={cn(
                                "mt-2",
                                coll.verificationStatus === 'verified' 
                                  ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20" 
                                  : "bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20"
                              )}
                            >
                              {coll.verificationStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Repayment Section */}
      {loan.id && profile?.agency_id && (
        <RepaymentSection loan={loan} agencyId={profile.agency_id} />
      )}

      {loan.id && (
        <LoanStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          loanId={loan.id}
          currentStatus={loan.status || 'pending'}
          agencyId={profile?.agency_id || ''}
        />
      )}
    </div>
  );
}

