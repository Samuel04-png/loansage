import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, Users, Loader2, UserPlus } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';;

export function EmployeeCustomersPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Get employee ID
  const { data: employee } = useQuery({
    queryKey: ['employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['employee-customers', employee?.id],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('*, users(email, full_name, phone)')
        .eq('agency_id', profile.agency_id)
        .eq('assigned_officer_id', employee.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id && !!profile?.agency_id,
  });

  const filteredCustomers = customers?.filter((cust: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cust.users?.full_name?.toLowerCase().includes(search) ||
      cust.fullName?.toLowerCase().includes(search) ||
      cust.name?.toLowerCase().includes(search) ||
      cust.customer_id?.toLowerCase().includes(search) ||
      cust.customerId?.toLowerCase().includes(search) ||
      cust.id?.toLowerCase().includes(search) ||
      cust.nrc_number?.toLowerCase().includes(search) ||
      cust.nrc?.toLowerCase().includes(search) ||
      cust.nrcNumber?.toLowerCase().includes(search) ||
      cust.email?.toLowerCase().includes(search) ||
      cust.phone?.toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Customers</h2>
          <p className="text-slate-600">Manage your assigned customers</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search customers..."
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
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">NRC</th>
                    <th className="px-6 py-3">Risk Score</th>
                    <th className="px-6 py-3">KYC Status</th>
                    <th className="px-6 py-3">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust: any) => (
                    <tr
                      key={cust.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-slate-600">
                              {cust.users?.full_name?.charAt(0) || 'C'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {cust.users?.full_name || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">{cust.users?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{cust.customer_id}</td>
                      <td className="px-6 py-4">{cust.nrc_number || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full mr-2 ${
                              cust.risk_score >= 80
                                ? 'bg-emerald-500'
                                : cust.risk_score >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          ></div>
                          <span className="font-medium">{cust.risk_score}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cust.kyc_status === 'verified' ? (
                          <Badge variant="success">Verified</Badge>
                        ) : cust.kyc_status === 'pending' ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDateSafe(cust.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No customers assigned to you</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

