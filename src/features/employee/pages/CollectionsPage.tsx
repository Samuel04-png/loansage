import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, DollarSign, Phone, Mail, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
  import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';

export function CollectionsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: repayments, isLoading } = useQuery({
    queryKey: ['collections', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const { data, error } = await supabase
        .from('repayments')
        .select('*, loans!inner(loan_number, customer_id, customers(users(full_name, phone, email)))')
        .eq('loans.agency_id', profile.agency_id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.agency_id,
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('repayments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Payment marked as received');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update payment');
    },
  });

  const sendReminder = useMutation({
    mutationFn: async (repayment: any) => {
      // In a real app, this would send SMS/Email via a service
      toast.success(`Reminder sent to ${repayment.loans?.customers?.users?.full_name}`);
    },
  });

  const getDaysOverdue = (dueDate: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredRepayments = repayments?.filter((r: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.loans?.loan_number?.toLowerCase().includes(search) ||
      r.loans?.loanNumber?.toLowerCase().includes(search) ||
      r.loans?.id?.toLowerCase().includes(search) ||
      r.loans?.customers?.users?.full_name?.toLowerCase().includes(search) ||
      r.loans?.customer?.fullName?.toLowerCase().includes(search) ||
      r.loanId?.toLowerCase().includes(search) ||
      r.id?.toLowerCase().includes(search) ||
      String(r.amount || '').includes(search)
    );
  }) || [];

  const overdueRepayments = filteredRepayments.filter((r: any) => getDaysOverdue(r.due_date) > 0);
  const upcomingRepayments = filteredRepayments.filter((r: any) => getDaysOverdue(r.due_date) === 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Collections Management</h2>
        <p className="text-slate-600">Track and manage loan repayments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Pending</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    filteredRepayments.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0)
                  )}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueRepayments.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Upcoming</p>
                <p className="text-2xl font-bold text-amber-600">{upcomingRepayments.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
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
          ) : filteredRepayments.length > 0 ? (
            <div className="divide-y">
              {filteredRepayments.map((repayment: any) => {
                const daysOverdue = getDaysOverdue(repayment.due_date);
                const isOverdue = daysOverdue > 0;

                return (
                  <div key={repayment.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">
                            {repayment.loans?.loan_number}
                          </h3>
                          {isOverdue ? (
                            <Badge variant="destructive">
                              {daysOverdue} days overdue
                            </Badge>
                          ) : (
                            <Badge variant="warning">Due soon</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-slate-500">Customer</p>
                            <p className="font-medium text-slate-900">
                              {repayment.loans?.customers?.users?.full_name || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Amount</p>
                            <p className="font-semibold text-slate-900">
                              {formatCurrency(Number(repayment.amount))}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Due Date</p>
                            <p className="text-slate-600">{formatDateSafe(repayment.due_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {repayment.loans?.customers?.users?.phone || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {repayment.loans?.customers?.users?.email || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendReminder.mutate(repayment)}
                          disabled={sendReminder.isPending}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Remind
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markAsPaid.mutate(repayment.id)}
                          disabled={markAsPaid.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No pending repayments</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

