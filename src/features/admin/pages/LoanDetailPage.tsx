import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, DollarSign, Calendar, FileText, User, AlertTriangle, CheckCircle2, Clock, TrendingUp, Download } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { RecordPaymentDialog } from '../../../components/payment/RecordPaymentDialog';
import { useState } from 'react';
import { exportRepayments } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Plus, TrendingUp, DollarSign } from 'lucide-react';
import { calculateLoanFinancials, calculateLoanProfit } from '../../../lib/firebase/loan-calculations';

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const { profile } = useAuth();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<any>(null);

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (loanError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Error loading loan</p>
        <p className="text-sm text-slate-400 mb-4">{loanError.message || 'Unknown error'}</p>
        <Link to="/admin/loans">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </Link>
      </div>
    );
  }

  if (!loan && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Loan not found</p>
        <p className="text-sm text-slate-400 mb-4">Loan ID: {loanId}</p>
        <p className="text-xs text-slate-400 mb-4">Agency ID: {profile?.agency_id || 'N/A'}</p>
        <Link to="/admin/loans">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loans
          </Button>
        </Link>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/loans">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Loan Details</h2>
            <p className="text-slate-600">Loan ID: {loan.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(loan.status || 'pending')}
          <Button
            variant="outline"
            onClick={() => setStatusDialogOpen(true)}
          >
            Change Status
          </Button>
        </div>
      </div>

      {/* Loan Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Loan Amount</p>
              <p className="font-semibold text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {formatCurrency(Number(loan.amount || 0), 'ZMW')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Interest Rate</p>
              <p className="font-semibold">{loan.interestRate || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Duration</p>
              <p className="font-semibold">{loan.durationMonths || 0} months</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Loan Type</p>
              <p className="font-semibold capitalize">{loan.loanType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Disbursement Date</p>
              <p className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {loan.disbursementDate 
                  ? formatDateSafe(loan.disbursementDate?.toDate?.() || loan.disbursementDate) 
                  : 'Not disbursed'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {loan.createdAt 
                  ? formatDateSafe(loan.createdAt?.toDate?.() || loan.createdAt) 
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Principal</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(principal, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Total Interest</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(financials.totalInterest, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Total Amount Owed</p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(financials.totalAmount, 'ZMW')}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Total Paid</p>
                <p className="text-lg font-bold text-amber-700">
                  {formatCurrency(totalPaid, 'ZMW')}
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Profit Earned</p>
                <p className={`text-xl font-bold ${profitData.isProfitable ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {formatCurrency(profitData.profit, 'ZMW')}
                </p>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500">Profit Margin</p>
                <p className={`font-semibold ${profitData.isProfitable ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {profitData.profitMargin.toFixed(2)}%
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Remaining Balance</p>
                <p className="font-semibold text-slate-700">
                  {formatCurrency(profitData.remainingBalance, 'ZMW')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Related Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loan.customer && (
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <Link to={`/admin/customers/${loan.customer.id}`}>
                  <p className="font-semibold text-primary-600 hover:underline">
                    {loan.customer.fullName || 'N/A'}
                  </p>
                </Link>
                <p className="text-xs text-slate-500">{loan.customer.email || loan.customer.phone || ''}</p>
              </div>
            )}
            {loan.officer && (
              <div>
                <p className="text-sm text-slate-500">Loan Officer</p>
                <p className="font-semibold">{loan.officer.full_name || 'N/A'}</p>
                <p className="text-xs text-slate-500">{loan.officer.email || ''}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-500">Outstanding Balance</p>
              <p className="font-semibold text-lg text-amber-600">
                {formatCurrency(outstanding, 'ZMW')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Paid</p>
              <p className="font-semibold text-emerald-600">
                {formatCurrency(totalPaid, 'ZMW')}
              </p>
            </div>
            {overdueRepayments.length > 0 && (
              <div>
                <p className="text-sm text-slate-500">Overdue Repayments</p>
                <p className="font-semibold text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {overdueRepayments.length}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collateral */}
      {loan.collateral && loan.collateral.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Collateral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loan.collateral.map((coll: any) => (
                <Link
                  key={coll.id}
                  to={`/admin/loans/${loan.id}/collateral/${coll.id}`}
                  className="block p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold capitalize">{coll.type?.replace('_', ' ') || 'N/A'}</p>
                      <p className="text-sm text-slate-500">{coll.description || 'No description'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(coll.estimatedValue || coll.value || 0), 'ZMW')}</p>
                      {coll.verificationStatus && (
                        <Badge variant={coll.verificationStatus === 'verified' ? 'success' : 'warning'} className="mt-1">
                          {coll.verificationStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repayment Schedule */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Repayment Schedule</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (loan.repayments && loan.repayments.length > 0) {
                exportRepayments(loan.repayments);
                toast.success('Repayments exported successfully');
              } else {
                toast.error('No repayments to export');
              }
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {loan.repayments && loan.repayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Due Date</th>
                    <th className="px-4 py-3 text-right">Amount Due</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Paid Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.repayments.map((repayment: any) => {
                    let dueDate: Date;
                    try {
                      dueDate = repayment.dueDate?.toDate 
                        ? repayment.dueDate.toDate() 
                        : repayment.dueDate instanceof Date 
                        ? repayment.dueDate 
                        : repayment.dueDate 
                        ? new Date(repayment.dueDate) 
                        : new Date();
                    } catch (error) {
                      console.warn('Error parsing due date:', error);
                      dueDate = new Date();
                    }
                    
                    const isOverdue = repayment.status === 'pending' && !isNaN(dueDate.getTime()) && dueDate < new Date();
                    
                    let paidAtDate: Date | null = null;
                    if (repayment.paidAt) {
                      try {
                        paidAtDate = repayment.paidAt?.toDate 
                          ? repayment.paidAt.toDate() 
                          : repayment.paidAt instanceof Date 
                          ? repayment.paidAt 
                          : new Date(repayment.paidAt);
                        if (isNaN(paidAtDate.getTime())) paidAtDate = null;
                      } catch (error) {
                        console.warn('Error parsing paid date:', error);
                        paidAtDate = null;
                      }
                    }
                    
                    return (
                      <tr key={repayment.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {formatDateSafe(dueDate)}
                          {isOverdue && (
                            <Badge variant="destructive" className="ml-2">Overdue</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(Number(repayment.amountDue || 0), 'ZMW')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(Number(repayment.amountPaid || 0), 'ZMW')}
                        </td>
                        <td className="px-4 py-3">
                          {repayment.status === 'paid' ? (
                            <Badge variant="success">Paid</Badge>
                          ) : repayment.status === 'overdue' ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                          {repayment.lateFee && (
                            <span className="text-xs text-red-600 ml-2">
                              Late Fee: {formatCurrency(Number(repayment.lateFee || 0), 'ZMW')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDateSafe(paidAtDate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {repayment.status !== 'paid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRepayment(repayment);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Record Payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No repayment schedule found
            </div>
          )}
        </CardContent>
      </Card>

      {loan.id && (
        <>
          <LoanStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            loanId={loan.id}
            currentStatus={loan.status || 'pending'}
            agencyId={profile?.agency_id || ''}
          />
          {selectedRepayment && (
            <RecordPaymentDialog
              open={paymentDialogOpen}
              onOpenChange={(open) => {
                setPaymentDialogOpen(open);
                if (!open) setSelectedRepayment(null);
              }}
              loanId={loan.id}
              repaymentId={selectedRepayment.id}
              repayment={selectedRepayment}
              agencyId={profile?.agency_id || ''}
            />
          )}
        </>
      )}
    </div>
  );
}

