import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, AlertTriangle, Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;
import toast from 'react-hot-toast';

export function OverduePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: overdueRepayments, isLoading } = useQuery({
    queryKey: ['overdue', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('repayments')
        .select('*, loans!inner(loan_number, customer_id, customers(users(full_name, phone, email)))')
        .eq('loans.agency_id', profile.agency_id)
        .eq('status', 'pending')
        .lt('due_date', today)
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
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      toast.success('Payment marked as received');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update payment');
    },
  });

  const getDaysOverdue = (dueDate: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const totalOverdue = overdueRepayments?.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0) || 0;

  const filteredRepayments = overdueRepayments?.filter((r: any) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Overdue Loans</h2>
        <p className="text-slate-600">Track and manage overdue repayments</p>
      </div>

      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Total Overdue Amount</p>
              <p className="text-3xl font-bold text-red-900">{formatCurrency(totalOverdue)}</p>
              <p className="text-sm text-red-600 mt-1">{overdueRepayments?.length || 0} overdue payments</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
        </CardContent>
      </Card>

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

                return (
                  <div key={repayment.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">
                            {repayment.loans?.loan_number}
                          </h3>
                          <Badge variant="destructive">
                            {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                          </Badge>
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
                            <p className="font-semibold text-red-600">
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
                          onClick={() => {
                            // In a real app, this would open a call dialog or send SMS
                            toast(`Calling ${repayment.loans?.customers?.users?.phone}`, { icon: 'ℹ️' });
                          }}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Call
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
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-300" />
              <p>No overdue payments</p>
              <p className="text-sm mt-2">Great job! All payments are up to date.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

