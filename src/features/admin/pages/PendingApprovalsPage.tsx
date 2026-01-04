import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, CheckCircle2, XCircle, FileText, Loader2, Eye, Clock, DollarSign, User } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { createNotification } from '../../../lib/firebase/notifications';
import { approveLoan, rejectLoan as rejectLoanWorkflow } from '../../../lib/loans/workflow';
import { UserRole } from '../../../types/loan-workflow';

export function PendingApprovalsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: pendingLoans = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = query(loansRef, where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      
      const loans = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const loan = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Fetch customer data
          if (loan.customerId) {
            try {
              const { doc: getDoc, getDoc: getDocData } = await import('firebase/firestore');
              const customerRef = getDoc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
              const customerDoc = await getDocData(customerRef);
              if (customerDoc.exists()) {
                loan.customer = { id: customerDoc.id, ...customerDoc.data() };
              }
            } catch (error) {
              console.warn('Failed to fetch customer:', error);
            }
          }
          
          return loan;
        })
      );

      return loans;
    },
    enabled: !!profile?.agency_id,
  });

  const approveLoanMutation = useMutation({
    mutationFn: async (loanId: string) => {
      if (!profile?.agency_id || !profile?.id) throw new Error('Agency ID or user ID not found');
      
      const userRole = (profile?.role === 'admin' ? UserRole.ADMIN :
                       profile?.role === 'owner' ? UserRole.ADMIN :
                       profile?.employee_category === 'accountant' ? UserRole.ACCOUNTANT :
                       UserRole.ADMIN) as UserRole;

      const result = await approveLoan(
        loanId,
        profile.agency_id,
        profile.id,
        userRole,
        'Loan approved by admin/accountant'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to approve loan');
      }

      // Create notification
      const loan = pendingLoans.find((l: any) => l.id === loanId);
      if (loan?.customerId && profile?.agency_id) {
        await createNotification({
          agencyId: profile.agency_id,
          userId: loan.customerId,
          type: 'loan_approved',
          title: 'Loan Approved',
          message: `Your loan application has been approved. Loan ID: ${loan.loanNumber || loanId}`,
          metadata: { loanId },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve loan');
    },
  });

  const rejectLoanMutation = useMutation({
    mutationFn: async ({ loanId, reason }: { loanId: string; reason?: string }) => {
      if (!profile?.agency_id || !profile?.id) throw new Error('Agency ID or user ID not found');
      
      const userRole = (profile?.role === 'admin' ? UserRole.ADMIN :
                       profile?.role === 'owner' ? UserRole.ADMIN :
                       profile?.employee_category === 'accountant' ? UserRole.ACCOUNTANT :
                       UserRole.ADMIN) as UserRole;

      const result = await rejectLoanWorkflow(
        loanId,
        profile.agency_id,
        profile.id,
        userRole,
        reason || 'Loan rejected by admin/accountant'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to reject loan');
      }

      // Create notification
      const loan = pendingLoans.find((l: any) => l.id === loanId);
      if (loan?.customerId && profile?.agency_id) {
        await createNotification({
          agencyId: profile.agency_id,
          userId: loan.customerId,
          type: 'loan_rejected',
          title: 'Loan Application Rejected',
          message: `Your loan application has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
          metadata: { loanId, reason },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject loan');
    },
  });

  const filteredLoans = pendingLoans.filter((loan: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.loanNumber?.toLowerCase().includes(search) ||
      loan.id?.toLowerCase().includes(search) ||
      loan.customer?.fullName?.toLowerCase().includes(search) ||
      loan.customer?.name?.toLowerCase().includes(search) ||
      String(loan.amount || '').includes(search)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-[#006BFF]" />
            Pending Approvals
          </h1>
          <p className="text-neutral-600 mt-2">Review and approve loan applications</p>
        </div>
        <Badge variant="default" className="bg-blue-600 text-white px-4 py-2 text-sm">
          {filteredLoans.length} Pending
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search loans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
              icon={Search}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-400" />
              <p className="text-neutral-500 mt-2">Loading pending approvals...</p>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No pending approvals</h3>
              <p className="text-neutral-500">All loans have been reviewed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLoans.map((loan: any) => (
                <Card key={loan.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="font-semibold text-neutral-900">
                              {loan.loanNumber || `Loan #${loan.id.slice(0, 8)}`}
                            </h3>
                            <p className="text-sm text-neutral-500">
                              Created {formatDateSafe(loan.createdAt?.toDate?.() || loan.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Customer</p>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-neutral-400" />
                              <p className="font-medium text-neutral-900">
                                {loan.customer?.fullName || loan.customer?.name || 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Amount</p>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-neutral-400" />
                              <p className="font-medium text-neutral-900">
                                {formatCurrency(loan.amount || 0)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Interest Rate</p>
                            <p className="font-medium text-neutral-900">
                              {loan.interestRate || 0}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-500 mb-1">Duration</p>
                            <p className="font-medium text-neutral-900">
                              {loan.durationMonths || 0} months
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Link 
                          to={`/admin/loans/${loan.id}`}
                          className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-10 md:h-9 px-3 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 transition-all duration-300"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => approveLoanMutation.mutate(loan.id)}
                          disabled={approveLoanMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {approveLoanMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const reason = prompt('Rejection reason (optional):');
                            rejectLoanMutation.mutate({ loanId: loan.id, reason: reason || undefined });
                          }}
                          disabled={rejectLoanMutation.isPending}
                        >
                          {rejectLoanMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-2" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

