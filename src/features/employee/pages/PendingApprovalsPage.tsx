import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, CheckCircle2, XCircle, FileText, Loader2, Eye } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { createNotification } from '../../../lib/firebase/notifications';

export function PendingApprovalsPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: pendingLoans = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = firestoreQuery(
        loansRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const loans = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const loan = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Fetch customer data
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
            }
          }
          
          return loan;
        })
      );

      return loans;
    },
    enabled: !!profile?.agency_id,
  });

  const approveLoan = useMutation({
    mutationFn: async (loanId: string) => {
      if (!profile?.agency_id) throw new Error('Agency ID not found');
      
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      await updateDoc(loanRef, {
        status: 'approved',
        approvedBy: user?.id || profile.id,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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

  const rejectLoan = useMutation({
    mutationFn: async (loanId: string) => {
      if (!profile?.agency_id) throw new Error('Agency ID not found');
      
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      await updateDoc(loanRef, {
        status: 'rejected',
        rejectedBy: user?.id || profile.id,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create notification
      const loan = pendingLoans.find((l: any) => l.id === loanId);
      if (loan?.customerId && profile?.agency_id) {
        await createNotification({
          agencyId: profile.agency_id,
          userId: loan.customerId,
          type: 'loan_rejected',
          title: 'Loan Rejected',
          message: `Your loan application has been rejected. Loan ID: ${loan.loanNumber || loanId}`,
          metadata: { loanId },
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

  const filteredLoans = pendingLoans?.filter((loan: any) => {
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pending Approvals</h2>
        <p className="text-slate-600">Review and approve loan applications</p>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by loan number or customer..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
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
                <div key={loan.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{loan.loanNumber || loan.id}</h3>
                        <Badge variant="warning">Pending Approval</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-slate-500">Customer</p>
                          <p className="font-medium text-slate-900">
                            {loan.customer?.fullName || loan.customer?.name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Amount</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(Number(loan.amount || 0), loan.currency || 'ZMW')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Type</p>
                          <p className="text-slate-600 capitalize">{loan.loanType || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Duration</p>
                          <p className="text-slate-600">{loan.durationMonths || 0} months</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Created: {formatDateSafe(loan.createdAt)}</span>
                        <span>Interest: {loan.interestRate || 0}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/employee/loans/${loan.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectLoan.mutate(loan.id)}
                        disabled={rejectLoan.isPending || approveLoan.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveLoan.mutate(loan.id)}
                        disabled={rejectLoan.isPending || approveLoan.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No pending approvals</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
