import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Download, Calendar, TrendingUp, DollarSign, Users, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export function ReportsPage() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['reports', profile?.agency_id, dateRange],
    queryFn: async () => {
      if (!profile?.agency_id) return null;

      const { data: loans } = await supabase
        .from('loans')
        .select('*')
        .eq('agency_id', profile.agency_id);

      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('agency_id', profile.agency_id);

      const { data: repayments } = await supabase
        .from('repayments')
        .select('*, loans!inner(agency_id)')
        .eq('loans.agency_id', profile.agency_id);

      return { loans, customers, repayments };
    },
    enabled: !!profile?.agency_id,
  });

  const loanStatusData = {
    labels: ['Active', 'Pending', 'Approved', 'Paid', 'Defaulted'],
    datasets: [
      {
        label: 'Loans by Status',
        data: [
          stats?.loans?.filter((l: any) => l.status === 'active').length || 0,
          stats?.loans?.filter((l: any) => l.status === 'pending').length || 0,
          stats?.loans?.filter((l: any) => l.status === 'approved').length || 0,
          stats?.loans?.filter((l: any) => l.status === 'paid').length || 0,
          stats?.loans?.filter((l: any) => l.status === 'defaulted').length || 0,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(251, 191, 36, 0.5)',
          'rgba(34, 197, 94, 0.5)',
          'rgba(16, 185, 129, 0.5)',
          'rgba(239, 68, 68, 0.5)',
        ],
      },
    ],
  };

  const totalLoanAmount = stats?.loans?.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0) || 0;
  const totalRepayments = stats?.repayments?.filter((r: any) => r.status === 'paid').reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-slate-600">Comprehensive insights into your loan portfolio</p>
        </div>
        <div className="flex gap-2">
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Loans</p>
                <p className="text-2xl font-bold">{stats?.loans?.length || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Portfolio</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLoanAmount)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Repayments</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRepayments)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Customers</p>
                <p className="text-2xl font-bold">{stats?.customers?.length || 0}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loan Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : (
              <Pie data={loanStatusData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span className="font-medium">Approval Rate</span>
                <Badge variant="success">
                  {stats?.loans?.length
                    ? Math.round(
                        ((stats.loans.filter((l: any) => l.status === 'approved' || l.status === 'active').length /
                          stats.loans.length) *
                          100) as number
                      )
                    : 0}
                  %
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span className="font-medium">Default Rate</span>
                <Badge variant="destructive">
                  {stats?.loans?.length
                    ? Math.round(
                        ((stats.loans.filter((l: any) => l.status === 'defaulted').length /
                          stats.loans.length) *
                          100) as number
                      )
                    : 0}
                  %
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span className="font-medium">Collection Rate</span>
                <Badge variant="default">
                  {totalLoanAmount > 0
                    ? Math.round(((totalRepayments / totalLoanAmount) * 100) as number)
                    : 0}
                  %
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

