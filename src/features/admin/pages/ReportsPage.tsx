import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../components/providers/ThemeProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Download, Calendar, TrendingUp, DollarSign, Users, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { exportLoans, exportCustomers, exportRepayments } from '../../../lib/data-export';
import toast from 'react-hot-toast';
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
  Filler,
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
  Legend,
  Filler
);

export function ReportsPage() {
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  // Calculate date range for filtering
  const dateRangeFilter = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { startDate, endDate: now };
  }, [dateRange]);

  const { data: stats, isLoading, error: queryError } = useQuery({
    queryKey: ['reports', profile?.agency_id, dateRange],
    queryFn: async () => {
      if (!profile?.agency_id) return { loans: [], customers: [], repayments: [] };

      try {
        // Fetch loans
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const loansSnapshot = await getDocs(loansRef);
        const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch customers
        const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
        const customersSnapshot = await getDocs(customersRef);
        const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch repayments from all loans
        const allRepayments: any[] = [];
        for (const loan of loans) {
          try {
            const repaymentsRef = collection(
              db,
              'agencies',
              profile.agency_id,
              'loans',
              loan.id,
              'repayments'
            );
            const repaymentsSnapshot = await getDocs(repaymentsRef);
            const loanRepayments = repaymentsSnapshot.docs.map(doc => ({
              id: doc.id,
              loanId: loan.id,
              ...doc.data(),
            }));
            allRepayments.push(...loanRepayments);
          } catch (error) {
            console.warn(`Failed to fetch repayments for loan ${loan.id}:`, error);
          }
        }

        return { loans, customers, repayments: allRepayments };
      } catch (error: any) {
        console.error('Error fetching report data:', error);
        toast.error('Failed to load report data. Please try again.');
        throw error;
      }
    },
    enabled: !!profile?.agency_id,
    retry: 1,
  });

  // Helper function to convert various timestamp formats to Date
  const convertToDate = (value: any): Date | null => {
    if (!value) return null;
    
    // Handle Firestore Timestamp
    if (value?.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    
    // Handle Date object
    if (value instanceof Date) {
      return value;
    }
    
    // Handle timestamp numbers
    if (typeof value === 'number') {
      return new Date(value);
    }
    
    // Handle date strings
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
  };

  // Filter data by date range (but include all data if dateRange is not filtering or no dates found)
  const filteredData = useMemo(() => {
    if (!stats) return { loans: [], customers: [], repayments: [] };
    
    // If we have no date filtering preference, show all data
    // But if user selects a range, filter by that range
    const filterByDate = (item: any) => {
      const itemDate = convertToDate(item.createdAt);
      
      // Include items without valid dates to show all available data
      // This ensures graphs show data even if createdAt is missing
      if (!itemDate || isNaN(itemDate.getTime())) {
        // Include items without dates when no specific filtering is needed
        return true;
      }
      
      return itemDate >= dateRangeFilter.startDate && itemDate <= dateRangeFilter.endDate;
    };
    
    const filteredLoans = stats.loans.filter(filterByDate);
    const filteredCustomers = stats.customers.filter(filterByDate);
    const filteredRepayments = stats.repayments.filter(filterByDate);
    
    // If filtering resulted in empty arrays but we have stats, show all data instead
    // This handles cases where dates might not be set properly
    return {
      loans: filteredLoans.length > 0 || stats.loans.length === 0 ? filteredLoans : stats.loans,
      customers: filteredCustomers.length > 0 || stats.customers.length === 0 ? filteredCustomers : stats.customers,
      repayments: filteredRepayments.length > 0 || stats.repayments.length === 0 ? filteredRepayments : stats.repayments,
    };
  }, [stats, dateRangeFilter]);

  // Chart options for theming and responsiveness
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: resolvedTheme === 'dark' ? '#1F2937' : '#FFFFFF',
        titleColor: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
        bodyColor: resolvedTheme === 'dark' ? '#D1D5DB' : '#374151',
        borderColor: resolvedTheme === 'dark' ? '#374151' : '#E5E7EB',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
  }), [resolvedTheme]);

  const pieChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'bottom' as const,
      },
    },
  }), [chartOptions]);

  // Memoize loan status data to ensure it updates when filteredData changes
  const loanStatusData = useMemo(() => {
    if (!filteredData?.loans?.length) {
      return {
        labels: ['Active', 'Pending', 'Approved', 'Closed', 'Overdue', 'Rejected'],
        datasets: [{
          label: 'Loans by Status',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(156, 163, 175, 0.8)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(156, 163, 175, 1)',
          ],
          borderWidth: 2,
        }],
      };
    }

    // Count loans by status (case-insensitive)
    const statusCounts = {
      active: filteredData.loans.filter((l: any) => String(l.status || '').toLowerCase() === 'active').length,
      pending: filteredData.loans.filter((l: any) => String(l.status || '').toLowerCase() === 'pending').length,
      approved: filteredData.loans.filter((l: any) => String(l.status || '').toLowerCase() === 'approved').length,
      closed: filteredData.loans.filter((l: any) => ['closed', 'paid'].includes(String(l.status || '').toLowerCase())).length,
      overdue: filteredData.loans.filter((l: any) => ['overdue', 'defaulted'].includes(String(l.status || '').toLowerCase())).length,
      rejected: filteredData.loans.filter((l: any) => String(l.status || '').toLowerCase() === 'rejected').length,
    };

    return {
      labels: ['Active', 'Pending', 'Approved', 'Closed', 'Overdue', 'Rejected'],
      datasets: [{
        label: 'Loans by Status',
        data: [
          statusCounts.active,
          statusCounts.pending,
          statusCounts.approved,
          statusCounts.closed,
          statusCounts.overdue,
          statusCounts.rejected,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)',
        ],
        borderWidth: 2,
      }],
    };
  }, [filteredData]);

  // Prepare loan trends data (by month)
  const loanTrendsData = useMemo(() => {
    if (!filteredData?.loans?.length) return null;
    
    const monthlyData: { [key: string]: { amount: number; count: number } } = {};
    
    filteredData.loans.forEach((loan: any) => {
      const loanDate = convertToDate(loan.createdAt);
      
      if (!loanDate || isNaN(loanDate.getTime())) return;
      
      const monthKey = `${loanDate.getFullYear()}-${String(loanDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { amount: 0, count: 0 };
      }
      monthlyData[monthKey].amount += Number(loan.amount || 0);
      monthlyData[monthKey].count += 1;
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
      labels: sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Loan Amount',
          data: sortedMonths.map(m => monthlyData[m].amount),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Loan Count',
          data: sortedMonths.map(m => monthlyData[m].count),
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        },
      ],
    };
  }, [filteredData]);

  const totalLoanAmount = filteredData?.loans?.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0) || 0;
  const totalRepayments = filteredData?.repayments?.filter((r: any) => r.status === 'paid' || r.status === 'completed').reduce((sum: number, r: any) => sum + Number(r.amountPaid || r.amount || 0), 0) || 0;

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32 mb-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state if query failed
  if (queryError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Reports & Analytics</h1>
            <p className="helper-text">Comprehensive insights into your loan portfolio</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="Unable to load reports"
              description={queryError instanceof Error ? queryError.message : 'An error occurred while loading report data. Please try refreshing the page.'}
              action={{
                label: 'Refresh Page',
                onClick: () => window.location.reload(),
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData = filteredData && (filteredData.loans?.length > 0 || filteredData.customers?.length > 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div>
          <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Reports & Analytics</h1>
          <p className="helper-text">Comprehensive insights into your loan portfolio</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="w-auto min-w-[140px]"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </Select>
          <Button 
            variant="outline"
            onClick={() => {
              if (!filteredData || filteredData.loans.length === 0) {
                toast.error('No data to export for the selected period');
                return;
              }
              
              // Export filtered data (loans, customers, repayments)
              try {
                exportLoans(filteredData.loans, { format: 'xlsx', filename: `loans-report-${dateRange}-${Date.now()}.xlsx` });
                if (filteredData.customers.length > 0) {
                  setTimeout(() => {
                    exportCustomers(filteredData.customers, { format: 'xlsx', filename: `customers-report-${dateRange}-${Date.now()}.xlsx` });
                  }, 500);
                }
                if (filteredData.repayments.length > 0) {
                  setTimeout(() => {
                    exportRepayments(filteredData.repayments, { format: 'xlsx', filename: `repayments-report-${dateRange}-${Date.now()}.xlsx` });
                  }, 1000);
                }
                toast.success('Export started! Multiple files will download.');
              } catch (error: any) {
                console.error('Export error:', error);
                toast.error('Failed to export data');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-neutral-400">Total Loans</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{filteredData?.loans?.length || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-neutral-400">Total Portfolio</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{formatCurrency(totalLoanAmount, 'ZMW')}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-neutral-400">Total Repayments</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{formatCurrency(totalRepayments, 'ZMW')}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-neutral-400">Active Customers</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{filteredData?.customers?.length || 0}</p>
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
            {filteredData?.loans?.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No loan data available"
                description={`No loans found for the selected ${dateRange} period. Try selecting a different time range.`}
              />
            ) : (
              <div style={{ height: '300px', position: 'relative' }}>
                <Pie data={loanStatusData} options={pieChartOptions} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData?.loans?.length === 0 ? (
              <EmptyState
                icon={<TrendingUp />}
                title="No performance data"
                description={`No loan data available for the selected ${dateRange} period to calculate performance metrics.`}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                  <span className="font-medium text-slate-900 dark:text-neutral-100">Approval Rate</span>
                  <Badge variant="success">
                    {filteredData?.loans?.length
                      ? Math.round(
                          ((filteredData.loans.filter((l: any) => {
                            const status = String(l.status || '').toLowerCase();
                            return status === 'approved' || status === 'active' || status === 'disbursed';
                          }).length /
                            filteredData.loans.length) *
                            100) as number
                        )
                      : 0}
                    %
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                  <span className="font-medium text-slate-900 dark:text-neutral-100">Default Rate</span>
                  <Badge variant="destructive">
                    {filteredData?.loans?.length
                      ? Math.round(
                          ((filteredData.loans.filter((l: any) => {
                            const status = String(l.status || '').toLowerCase();
                            return status === 'defaulted' || status === 'overdue';
                          }).length /
                            filteredData.loans.length) *
                            100) as number
                        )
                      : 0}
                    %
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                  <span className="font-medium text-slate-900 dark:text-neutral-100">Collection Rate</span>
                  <Badge variant="default">
                    {totalLoanAmount > 0
                      ? Math.round(((totalRepayments / totalLoanAmount) * 100) as number)
                      : 0}
                    %
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loan Trends Chart */}
      {loanTrendsData && loanTrendsData.labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Loan Trends Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full" style={{ height: '400px', position: 'relative' }}>
              <Line 
                data={loanTrendsData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                      labels: {
                        color: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
                        padding: 15,
                        font: {
                          size: 12,
                        },
                      },
                    },
                    tooltip: {
                      backgroundColor: resolvedTheme === 'dark' ? '#1F2937' : '#FFFFFF',
                      titleColor: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
                      bodyColor: resolvedTheme === 'dark' ? '#D1D5DB' : '#374151',
                      borderColor: resolvedTheme === 'dark' ? '#374151' : '#E5E7EB',
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 8,
                      callbacks: {
                        label: function(context: any) {
                          if (context.datasetIndex === 0) {
                            // Loan Amount
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y, 'ZMW')}`;
                          } else {
                            // Loan Count
                            return `${context.dataset.label}: ${context.parsed.y}`;
                          }
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      position: 'left' as const,
                      ticks: {
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280',
                        callback: function(value: any) {
                          return 'K' + (value / 1000).toFixed(0);
                        },
                        font: {
                          size: 11,
                        },
                      },
                      grid: {
                        color: resolvedTheme === 'dark' ? '#374151' : '#E5E7EB',
                      },
                      title: {
                        display: true,
                        text: 'Loan Amount (ZMW)',
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280',
                        font: {
                          size: 12,
                        },
                      },
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      beginAtZero: true,
                      ticks: {
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280',
                        font: {
                          size: 11,
                        },
                        stepSize: 1,
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                      title: {
                        display: true,
                        text: 'Loan Count',
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280',
                        font: {
                          size: 12,
                        },
                      },
                    },
                    x: {
                      ticks: {
                        color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280',
                        font: {
                          size: 11,
                        },
                        maxRotation: 45,
                        minRotation: 45,
                      },
                      grid: {
                        color: resolvedTheme === 'dark' ? '#374151' : '#E5E7EB',
                      },
                    },
                  },
                }} 
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

