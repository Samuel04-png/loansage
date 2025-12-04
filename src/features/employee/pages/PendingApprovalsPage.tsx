import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, CheckCircle2, XCircle, FileText, Loader2, Eye } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export function PendingApprovalsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: pendingLoans, isLoading } = useQuery({
    queryKey: ['pending-approvals', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const { data, error } = await supabase
        .from('loans')
        .select('*, customers(customer_id, users(full_name, email)), created_by:employees(user_id, users(full_name))')
        .eq('agency_id', profile.agency_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  const approveLoan = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from('loans')
        .update({
          status: 'approved',
          approved_by: profile?.id,
        })
        .eq('id', loanId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Loan approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve loan');
    },
  });

  const rejectLoan = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from('loans')
        .update({
          status: 'rejected',
        })
        .eq('id', loanId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Loan rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject loan');
    },
  });

  const filteredLoans = pendingLoans?.filter((loan: any) =>
    loan.loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.customers?.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
                        <h3 className="font-semibold text-slate-900">{loan.loan_number}</h3>
                        <Badge variant="warning">Pending Approval</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-slate-500">Customer</p>
                          <p className="font-medium text-slate-900">
                            {loan.customers?.users?.full_name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Amount</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(Number(loan.amount), loan.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Type</p>
                          <p className="text-slate-600 capitalize">{loan.loan_type}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Created By</p>
                          <p className="text-slate-600">
                            {loan.created_by?.users?.full_name || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Created: {formatDateSafe(loan.created_at)}</span>
                        <span>Duration: {loan.duration_months} months</span>
                        <span>Interest: {loan.interest_rate}%</span>
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

