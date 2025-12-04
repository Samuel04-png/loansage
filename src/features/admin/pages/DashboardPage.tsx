import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, FileCheck, UserPlus, Plus, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
import { useLoanAutomation } from '../../../hooks/useLoanAutomation';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { subscribeToDashboardStats } from '../../../lib/firebase/dashboard-helpers';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, change, trend, icon: Icon, onClick }: any) => (
  <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex items-baseline space-x-2">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {change && (
          <span
            className={`text-xs font-medium flex items-center ${
              trend === 'up' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUpRight className="w-3 h-3 mr-1" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-1" />
            )}
            {change}
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);

export function AdminDashboard() {
  const { profile } = useAuth();
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [addCustomerDrawerOpen, setAddCustomerDrawerOpen] = useState(false);
  const [newLoanDrawerOpen, setNewLoanDrawerOpen] = useState(false);
  
  // Enable automatic loan status updates
  const { overdueSummary } = useLoanAutomation(profile?.agency_id, true);
  
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use real-time subscription for dashboard stats
  useEffect(() => {
    if (!profile?.agency_id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToDashboardStats(profile.agency_id, (newStats) => {
      setStats(newStats);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [profile?.agency_id]);

  // Fetch additional data for charts (cached, not real-time)
  const { data: chartData } = useQuery({
    queryKey: ['admin-dashboard-charts', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return { chartData: [], statusData: [], officerPerformance: [] };

      const [loansSnapshot, customersSnapshot, employeesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'agencies', profile.agency_id, 'loans'), orderBy('createdAt', 'desc'), limit(1000))),
        getDocs(collection(db, 'agencies', profile.agency_id, 'customers')),
        getDocs(collection(db, 'agencies', profile.agency_id, 'employees')),
      ]);

      const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeLoans = loans.filter((l: any) => l.status === 'active');
      const pendingLoans = loans.filter((l: any) => l.status === 'pending');
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get officer performance
      const officerPerformance = employees.map((emp: any) => {
        const officerLoans = loans.filter((l: any) => l.officerId === emp.userId);
        const activeOfficerLoans = officerLoans.filter((l: any) => l.status === 'active');
        return {
          name: emp.name || 'Unknown',
          totalLoans: officerLoans.length,
          activeLoans: activeOfficerLoans.length,
          totalAmount: activeOfficerLoans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
        };
      }).filter((p: any) => p.totalLoans > 0).slice(0, 5);

      // Chart data - last 6 months
      const chartDataArray = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthLoans = loans.filter((l: any) => {
          const disbursementDate = l.disbursementDate?.toDate?.() || l.disbursementDate;
          return disbursementDate && new Date(disbursementDate) >= monthStart && new Date(disbursementDate) <= monthEnd;
        });
        
        chartDataArray.push({
          name: date.toLocaleString('default', { month: 'short' }),
          amount: monthLoans.reduce((sum, l: any) => sum + Number(l.amount || 0), 0),
        });
      }

      // Status distribution for pie chart
      const statusData = [
        { name: 'Active', value: activeLoans.length, color: '#10b981' },
        { name: 'Pending', value: pendingLoans.length, color: '#f59e0b' },
        { name: 'Completed', value: loans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length, color: '#3b82f6' },
        { name: 'Defaulted', value: loans.filter((l: any) => l.status === 'defaulted').length, color: '#ef4444' },
      ];

      return { chartData: chartDataArray, statusData, officerPerformance };
    },
    enabled: !!profile?.agency_id,
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setInviteDrawerOpen(true);
              }}
              type="button"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Employee
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddCustomerDrawerOpen(true);
              }}
              variant="outline"
              type="button"
            >
              <Users className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setNewLoanDrawerOpen(true);
              }}
              variant="outline"
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Loan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Active Loans"
          value={stats?.totalActiveLoans || 0}
          change={`${formatCurrency((stats?.totalActiveLoans || 0) * 50000, 'ZMW')} portfolio`}
          trend="up"
          icon={DollarSign}
          onClick={() => window.location.href = '/admin/loans?status=active'}
        />
        <StatCard
          title="Disbursed This Month"
          value={formatCurrency(stats?.totalDisbursedThisMonth || 0, 'ZMW')}
          change="+8.2%"
          trend="up"
          icon={TrendingUp}
        />
        <StatCard
          title="Repayments Due"
          value={formatCurrency(stats?.repaymentsDue || 0, 'ZMW')}
          change={`${stats?.repaymentsDueCount || 0} payments`}
          trend="down"
          icon={Calendar}
          onClick={() => window.location.href = '/admin/loans?overdue=true'}
        />
        <StatCard
          title="Active Customers"
          value={stats?.totalCustomers || 0}
          change="+4.1%"
          trend="up"
          icon={Users}
          onClick={() => window.location.href = '/admin/customers'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Employees"
          value={stats?.totalEmployees || 0}
          change="+2"
          trend="up"
          icon={Users}
          onClick={() => window.location.href = '/admin/employees'}
        />
        <StatCard
          title="Approval Rate"
          value={`${(stats?.approvalRate || 0).toFixed(1)}%`}
          change="-1.2%"
          trend="down"
          icon={FileCheck}
        />
        <StatCard
          title="Overdue Loans"
          value={stats?.overdueLoans || 0}
          change={stats?.overdueLoans > 0 ? 'Action needed' : 'All good'}
          trend={stats?.overdueLoans > 0 ? 'down' : 'up'}
          icon={AlertTriangle}
          onClick={() => window.location.href = '/admin/loans?status=overdue'}
        />
        <StatCard
          title="Total Loans"
          value={stats?.totalActiveLoans || 0}
          change="Active"
          trend="up"
          icon={FileCheck}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Disbursement Overview (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `K${(value / 1000).toFixed(0)}`}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: any) => formatCurrency(value, 'ZMW')}
                />
                <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Loan Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData?.statusData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(chartData?.statusData || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Officer Performance */}
      {chartData?.officerPerformance && chartData.officerPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Officers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Officer</th>
                    <th className="px-4 py-3 text-right">Total Loans</th>
                    <th className="px-4 py-3 text-right">Active Loans</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.officerPerformance.map((officer: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{officer.name}</td>
                      <td className="px-4 py-3 text-right">{officer.totalLoans}</td>
                      <td className="px-4 py-3 text-right">{officer.activeLoans}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(officer.totalAmount, 'ZMW')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drawers */}
      <InviteEmployeeDrawer
        open={inviteDrawerOpen}
        onOpenChange={setInviteDrawerOpen}
        onSuccess={() => {
          // Refetch stats
        }}
      />

      <AddCustomerDrawer
        open={addCustomerDrawerOpen}
        onOpenChange={setAddCustomerDrawerOpen}
        onSuccess={() => {
          // Refetch stats
        }}
      />

      <NewLoanDrawer
        open={newLoanDrawerOpen}
        onOpenChange={setNewLoanDrawerOpen}
        onSuccess={() => {
          // Refetch stats
        }}
      />
    </div>
  );
}
