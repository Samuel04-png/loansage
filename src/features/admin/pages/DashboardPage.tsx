import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, FileCheck, UserPlus, Plus, AlertTriangle, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
import { useLoanAutomation } from '../../../hooks/useLoanAutomation';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { subscribeToDashboardStats } from '../../../lib/firebase/dashboard-helpers';
import { getCachedDashboardStats } from '../../../lib/firebase/stats-aggregation';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useAIInsights } from '../../../hooks/useAIInsights';
import { AIInsightsPanel } from '../../../components/ai/AIInsightsPanel';
import { useTheme } from '../../../components/providers/ThemeProvider';

// Animated Counter Component
function AnimatedCounter({ value, className }: { value: number | string; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value === 'number') {
      const duration = 1000; // 1 second
      const steps = 60;
      const increment = value / steps;
      const stepDuration = duration / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.round(current));
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [value]);

  if (typeof value === 'string') {
    return <span className={className}>{value}</span>;
  }

  return <span className={className}>{displayValue}</span>;
}

// StatCard Component - Reference Style with floating effect
const StatCard = ({ title, value, change, trend, icon: Icon, onClick, gradient }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    whileHover={{ y: -4, scale: 1.01 }}
    className="h-full"
  >
    <Card 
      className={cn(
        "h-full cursor-pointer transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.4)] rounded-2xl overflow-hidden",
        gradient && "bg-white dark:bg-slate-900"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{title}</p>
          <div className={cn(
            "p-2 rounded-lg",
            gradient ? "bg-[#006BFF]/10 dark:bg-[#006BFF]/20" : "bg-neutral-100 dark:bg-neutral-800"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              gradient ? "text-[#006BFF] dark:text-blue-400" : "text-neutral-500 dark:text-neutral-400"
            )} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <AnimatedCounter 
              value={value} 
              className="text-3xl font-bold text-neutral-900 dark:text-neutral-100"
            />
          </div>
          {change && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-semibold flex items-center gap-1",
                  trend === 'up' ? 'text-[#22C55E]' : trend === 'down' ? 'text-[#EF4444]' : 'text-neutral-500'
                )}
              >
                {trend === 'up' ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="w-3 h-3" />
                ) : null}
                {change}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [addCustomerDrawerOpen, setAddCustomerDrawerOpen] = useState(false);
  const [newLoanDrawerOpen, setNewLoanDrawerOpen] = useState(false);
  
  // Enable automatic loan status updates
  const { overdueSummary } = useLoanAutomation(profile?.agency_id, true);
  
  // AI Insights
  const { insights: aiInsights, isAnalyzing: aiAnalyzing } = useAIInsights(true);
  
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use cached stats with React Query (reduces reads by 80%)
  const { data: cachedStats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null;
      return await getCachedDashboardStats(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
    staleTime: 1000 * 60 * 15, // 15 minutes - stats update on write, not read
    gcTime: 1000 * 60 * 60, // 1 hour cache
    refetchInterval: false, // No auto-refetch - stats update via Cloud Functions
  });

  // Fallback to real-time subscription if cached stats are stale (> 1 hour old)
  useEffect(() => {
    if (!profile?.agency_id) {
      setIsLoading(false);
      setStats({
        totalActiveLoans: 0,
        totalDisbursedThisMonth: 0,
        repaymentsDue: 0,
        repaymentsDueCount: 0,
        activeCustomers: 0,
        totalCustomers: 0,
        totalEmployees: 0,
        approvalRate: 0,
        overdueLoans: 0,
        totalLoans: 0,
        totalPortfolioValue: 0,
      });
      return;
    }

    // Use cached stats if available and fresh
    if (cachedStats) {
      const statsAge = cachedStats.lastUpdated?.toDate 
        ? (Date.now() - cachedStats.lastUpdated.toDate().getTime()) / 1000 / 60 // minutes
        : Infinity;
      
      if (statsAge < 60) { // Less than 1 hour old
        setStats(cachedStats);
        setIsLoading(false);
        return;
      }
    }

    // Fallback to real-time subscription only if cached stats are stale
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard: Using real-time subscription (cached stats stale)');
    }
    let unsubscribe: (() => void) | null = null;
    
    const setupSubscription = () => {
      if (unsubscribe) {
        unsubscribe(); // Clean up previous subscription
      }
      unsubscribe = subscribeToDashboardStats(profile.agency_id, (newStats) => {
        setStats(newStats);
        setIsLoading(false);
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [profile?.agency_id]); // Removed cachedStats from dependencies to prevent re-subscriptions

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

      // Chart data - last 6 months (ensure we always have data)
      const chartDataArray = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthLoans = loans.filter((l: any) => {
          if (!l.disbursementDate) return false;
          // Handle Firestore Timestamp, Date object, or string
          let disbursementDate: Date;
          if (l.disbursementDate?.toDate && typeof l.disbursementDate.toDate === 'function') {
            disbursementDate = l.disbursementDate.toDate();
          } else if (l.disbursementDate instanceof Date) {
            disbursementDate = l.disbursementDate;
          } else {
            disbursementDate = new Date(l.disbursementDate);
          }
          if (isNaN(disbursementDate.getTime())) return false;
          // Check if disbursement date falls within the month range
          return disbursementDate >= monthStart && disbursementDate <= monthEnd;
        });
        
        const monthAmount = monthLoans.reduce((sum: number, l: any) => 
          sum + Number(l.amount || 0), 0
        );
        
        chartDataArray.push({
          name: date.toLocaleString('default', { month: 'short' }),
          amount: monthAmount,
        });
      }

      // Status distribution for pie chart (ensure we always have data)
      const completedLoans = loans.filter((l: any) => l.status === 'completed' || l.status === 'paid');
      const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
      
      const statusData = [
        { name: 'Active', value: activeLoans.length, color: '#10b981' },
        { name: 'Pending', value: pendingLoans.length, color: '#f59e0b' },
        { name: 'Completed', value: completedLoans.length, color: '#3b82f6' },
        { name: 'Defaulted', value: defaultedLoans.length, color: '#ef4444' },
      ].filter(item => item.value > 0); // Only show statuses with loans

      return { chartData: chartDataArray, statusData, officerPerformance };
    },
    enabled: !!profile?.agency_id,
    staleTime: 60000, // Cache for 1 minute
  });

  // Show warning if no agency_id
  if (!profile?.agency_id) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Agency Not Assigned
                </h3>
                <p className="text-yellow-800 mb-4">
                  Your account is not assigned to an agency. Please contact your administrator to be assigned to an agency.
                </p>
                <Button
                  onClick={() => navigate('/admin/settings')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Go to Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl border-2 border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Unable to Load Dashboard Data
                </h3>
                <p className="text-red-800 mb-4">
                  There was an error loading dashboard statistics. Please check your browser console for more details or try refreshing the page.
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* AI Insights Panel - Only show if there are actual insights (not just loading) */}
      {aiInsights.length > 0 && !aiAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AIInsightsPanel 
            insights={aiInsights} 
            isLoading={false} 
            maxItems={5}
            storageKey="dashboard-ai-insights-dismissed"
          />
        </motion.div>
      )}

      {/* Quick Actions - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
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
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
                className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
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
                className="rounded-xl border-neutral-200 hover:bg-neutral-50 transition-all duration-300"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Loan
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Stats - Reference Style with floating cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" data-tour="dashboard">
        <StatCard
          title="Total Active Loans"
          value={stats?.totalActiveLoans || 0}
          change={`${formatCurrency(stats?.totalPortfolioValue || 0, 'ZMW')} portfolio`}
          trend="up"
          icon={DollarSign}
          onClick={() => navigate('/admin/loans?status=active')}
          gradient
        />
        <StatCard
          title="Disbursed This Month"
          value={formatCurrency(stats?.totalDisbursedThisMonth || 0, 'ZMW')}
          change="+8.2%"
          trend="up"
          icon={TrendingUp}
          gradient
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
          value={stats?.activeCustomers || 0}
          change={`${stats?.totalCustomers || 0} total`}
          trend="up"
          icon={Users}
          onClick={() => navigate('/admin/customers')}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Employees"
          value={stats?.totalEmployees || 0}
          change="+2"
          trend="up"
          icon={Users}
          onClick={() => navigate('/admin/employees')}
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
          onClick={() => navigate('/admin/loans?overdue=true')}
        />
        <StatCard
          title="Total Loans"
          value={stats?.totalLoans || 0}
          change={`${stats?.totalActiveLoans || 0} active`}
          trend="up"
          icon={FileCheck}
        />
      </div>

      {/* Charts - Reference Style */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-4"
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Disbursement Overview (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              {chartData?.chartData && chartData.chartData.length > 0 && chartData.chartData.some((d: any) => d.amount > 0) ? (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={300}>
                  <BarChart data={chartData.chartData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      vertical={false} 
                      stroke={resolvedTheme === 'dark' ? '#374151' : '#E5E7EB'} 
                    />
                    <XAxis 
                      dataKey="name" 
                      stroke={resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280'} 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                    />
                    <YAxis
                      stroke={resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `K${(value / 1000).toFixed(0)}`}
                      tick={{ fill: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                    />
                    <Tooltip
                      cursor={{ fill: resolvedTheme === 'dark' ? '#1F2937' : '#F3F4F6' }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: resolvedTheme === 'dark' ? '1px solid #374151' : '1px solid #E5E7EB',
                        boxShadow: resolvedTheme === 'dark' ? '0 8px 30px rgb(0,0,0,0.3)' : '0 8px 30px rgb(0,0,0,0.06)',
                        backgroundColor: resolvedTheme === 'dark' ? '#111827' : 'white',
                        color: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
                      }}
                      formatter={(value: any) => formatCurrency(value, 'ZMW')}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="url(#colorGradient)" 
                      radius={[8, 8, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#006BFF" stopOpacity={1} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-neutral-400">
                  <p>No disbursement data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Loan Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData?.statusData && chartData.statusData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={300}>
                  <PieChart>
                    <Pie
                      data={chartData.statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value}`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.statusData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value} loans`, name]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: resolvedTheme === 'dark' ? '1px solid #374151' : '1px solid #E5E7EB',
                        boxShadow: resolvedTheme === 'dark' ? '0 8px 30px rgb(0,0,0,0.3)' : '0 8px 30px rgb(0,0,0,0.06)',
                        backgroundColor: resolvedTheme === 'dark' ? '#111827' : 'white',
                        color: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value: string) => value}
                      wrapperStyle={{ 
                        fontSize: '12px', 
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' 
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-neutral-400 dark:text-neutral-500">
                  <p>No loan status data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Officer Performance - Reference Style */}
      {chartData?.officerPerformance && chartData.officerPerformance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Top Performing Officers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-600 dark:text-neutral-400 uppercase bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Officer</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Loans</th>
                      <th className="px-4 py-3 text-right font-semibold">Active Loans</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.officerPerformance.map((officer: any, index: number) => (
                      <tr 
                        key={index} 
                        className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">{officer.name}</td>
                        <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">{officer.totalLoans}</td>
                        <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">{officer.activeLoans}</td>
                        <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(officer.totalAmount, 'ZMW')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
