import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { ArrowLeft, Mail, Phone, Calendar, MapPin, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp, Plus, Edit } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { EditCustomerDrawer } from '../components/EditCustomerDrawer';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { FinancialHealthDashboard } from '../../../components/customer/FinancialHealthDashboard';

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newLoanDrawerOpen, setNewLoanDrawerOpen] = useState(false);
  const [editCustomerDrawerOpen, setEditCustomerDrawerOpen] = useState(false);

  // Fetch customer details
  const { data: customer, isLoading: customerLoading, error: customerError } = useQuery({
    queryKey: ['customer', profile?.agency_id, customerId],
    queryFn: async () => {
      if (!profile?.agency_id || !customerId) {
        console.warn('Missing agency_id or customerId', { agency_id: profile?.agency_id, customerId });
        return null;
      }

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);
        
        if (!customerSnap.exists()) {
          console.warn('Customer document does not exist', { customerId, agency_id: profile.agency_id });
          return null;
        }
        
        return { id: customerSnap.id, ...customerSnap.data() };
      } catch (error) {
        console.error('Error fetching customer:', error);
        throw error;
      }
    },
    enabled: !!profile?.agency_id && !!customerId,
  });

  // Fetch customer's loans using optimized helper
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['customer-loans', profile?.agency_id, customerId],
    queryFn: async () => {
      if (!profile?.agency_id || !customerId) return [];

      try {
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const allLoans: any[] = [];
        const loanIds = new Set<string>();
        
        // Query 1: customerId field
        try {
          const q1 = firestoreQuery(loansRef, where('customerId', '==', customerId));
          const snap1 = await getDocs(q1);
          snap1.docs.forEach(doc => {
            if (!loanIds.has(doc.id)) {
              loanIds.add(doc.id);
              allLoans.push({ id: doc.id, ...doc.data() });
            }
          });
        } catch (err) {
          console.warn('Query 1 failed:', err);
        }
        
        // Query 2: customer_id field
        try {
          const q2 = firestoreQuery(loansRef, where('customer_id', '==', customerId));
          const snap2 = await getDocs(q2);
          snap2.docs.forEach(doc => {
            if (!loanIds.has(doc.id)) {
              loanIds.add(doc.id);
              allLoans.push({ id: doc.id, ...doc.data() });
            }
          });
        } catch (err) {
          console.warn('Query 2 failed:', err);
        }
        
        // Query 3: Get all loans and filter client-side (fallback)
        if (allLoans.length === 0) {
          const allLoansSnapshot = await getDocs(loansRef);
          allLoansSnapshot.docs.forEach(doc => {
            const loanData = doc.data();
            if (
              loanData.customerId === customerId ||
              loanData.customer_id === customerId ||
              loanData.customer?.id === customerId ||
              loanData.customer === customerId
            ) {
              if (!loanIds.has(doc.id)) {
                loanIds.add(doc.id);
                allLoans.push({ id: doc.id, ...loanData });
              }
            }
          });
        }
        
        // Fetch repayments for each loan
        const loansWithRepayments = await Promise.all(
          allLoans.map(async (loan: any) => {
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
              loan.repayments = repaymentsSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
                paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
              }));
            } catch (error) {
              console.warn('Failed to fetch repayments:', error);
              loan.repayments = [];
            }
            return loan;
          })
        );
        
        // Sort by creation date (newest first)
        return loansWithRepayments.sort((a: any, b: any) => {
          const aDate = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bDate = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      } catch (error) {
        console.error('Error fetching customer loans:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id && !!customerId,
  });

  // Calculate customer statistics
  const stats = loans ? (() => {
    const activeLoans = loans.filter((l: any) => l.status === 'active');
    const completedLoans = loans.filter((l: any) => l.status === 'completed' || l.status === 'paid');
    const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
    
    const totalBorrowed = loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
    const totalOutstanding = activeLoans.reduce((sum: number, l: any) => {
      const paid = l.repayments?.filter((r: any) => r.status === 'paid')
        .reduce((s: number, r: any) => s + Number(r.amountPaid || 0), 0) || 0;
      return sum + (Number(l.amount || 0) - paid);
    }, 0);
    
    // Calculate risk score
    const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0;
    const overdueCount = activeLoans.filter((l: any) => {
      const now = new Date();
      return l.repayments?.some((r: any) => {
        const dueDate = r.dueDate?.toDate?.() || r.dueDate;
        return r.status === 'pending' && dueDate && new Date(dueDate) < now;
      });
    }).length;
    
    const riskScore = Math.min(100, Math.max(0, defaultRate * 3 + overdueCount * 10));
    
    return {
      totalLoans: loans.length,
      activeLoans: activeLoans.length,
      completedLoans: completedLoans.length,
      defaultedLoans: defaultedLoans.length,
      totalBorrowed,
      totalOutstanding,
      riskScore: Math.round(riskScore),
      defaultRate: Math.round(defaultRate * 10) / 10,
    };
  })() : null;

  // Loan status distribution with brand colors
  const statusData = loans ? [
    { name: 'Active', value: loans.filter((l: any) => l.status === 'active').length, color: '#22C55E' },
    { name: 'Completed', value: loans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length, color: '#006BFF' },
    { name: 'Pending', value: loans.filter((l: any) => l.status === 'pending').length, color: '#FACC15' },
    { name: 'Defaulted', value: loans.filter((l: any) => l.status === 'defaulted').length, color: '#EF4444' },
  ].filter(item => item.value > 0) : [];

  // Loan history data for area chart (monthly loan amounts)
  const loanHistoryData = loans ? (() => {
    const monthlyData: { [key: string]: { month: string; amount: number; count: number } } = {};
    
    loans.forEach((loan: any) => {
      const date = loan.createdAt?.toDate?.() || loan.createdAt;
      if (date) {
        const monthKey = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, amount: 0, count: 0 };
        }
        monthlyData[monthKey].amount += Number(loan.amount || 0);
        monthlyData[monthKey].count += 1;
      }
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    }).slice(-6); // Last 6 months
  })() : [];

  const totalLoansCount = statusData.reduce((sum, item) => sum + item.value, 0);

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'C';
  };

  if (customerLoading || loansLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (customerError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[#EF4444]" />
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Error loading customer</p>
        <p className="text-sm text-neutral-600 mb-6">
          {customerError instanceof Error ? customerError.message : 'Unknown error'}
        </p>
        <Link to="/admin/customers">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </Link>
      </motion.div>
    );
  }

  if (!customer) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
        <p className="text-lg font-semibold text-neutral-900 mb-2">Customer not found</p>
        <p className="text-sm text-neutral-600 mb-6">Customer ID: {customerId}</p>
        <Link to="/admin/customers">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Link to="/admin/customers">
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-4 border-neutral-200 dark:border-neutral-700">
              <AvatarImage src={customer.profilePhotoURL} />
              <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-lg font-semibold">
                {getInitials(customer.fullName || 'Customer')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{customer.fullName || 'Customer'}</h2>
              <p className="text-sm text-neutral-600">{customer.email || customer.phone || 'No contact info'}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setEditCustomerDrawerOpen(true)}
            variant="outline"
            className="rounded-xl"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
          <Button 
            onClick={() => setNewLoanDrawerOpen(true)} 
            className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Loan
          </Button>
        </div>
      </motion.div>

      {/* Customer Info Card - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Full Name</p>
                    <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{customer.fullName || 'N/A'}</p>
                  </div>
                  {customer.email && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        {customer.email}
                      </p>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-neutral-400" />
                        {customer.phone}
                      </p>
                    </div>
                  )}
                  {customer.nrc && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">NRC/ID Number</p>
                      <p className="font-mono text-sm text-neutral-900 dark:text-neutral-100">{customer.nrc}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="space-y-5">
                  {customer.address && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Address</p>
                      <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-neutral-400" />
                        {customer.address}
                      </p>
                    </div>
                  )}
                  {customer.employer && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Employer</p>
                      <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{customer.employer}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Customer ID</p>
                    <p className="font-mono text-sm text-neutral-700">{customer.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Registered</p>
                    <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      {formatDateSafe(customer.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Financial Health Dashboard */}
      {customer && loans && loans.length > 0 && profile?.agency_id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <FinancialHealthDashboard
            customerId={customerId!}
            agencyId={profile.agency_id}
            customer={customer}
            loans={loans}
          />
        </motion.div>
      )}

      {/* Statistics - Reference Style */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Loans', value: stats.totalLoans, icon: FileText, color: 'text-[#006BFF]' },
            { label: 'Active Loans', value: stats.activeLoans, icon: TrendingUp, color: 'text-[#22C55E]' },
            { label: 'Total Borrowed', value: formatCurrency(stats.totalBorrowed, 'ZMW'), icon: DollarSign, color: 'text-[#006BFF]' },
            { label: 'Outstanding', value: formatCurrency(stats.totalOutstanding, 'ZMW'), icon: AlertTriangle, color: 'text-[#FACC15]' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stat.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-xl bg-neutral-50", stat.color)}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Risk Score</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.riskScore}/100</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {stats.riskScore < 30 ? 'Low Risk' : stats.riskScore < 70 ? 'Medium Risk' : 'High Risk'}
                    </p>
                  </div>
                  <div className={cn(
                    "p-3 rounded-xl",
                    stats.riskScore < 30 ? "bg-[#22C55E]/10" : stats.riskScore < 70 ? "bg-[#FACC15]/10" : "bg-[#EF4444]/10"
                  )}>
                    {stats.riskScore < 30 ? (
                      <CheckCircle2 className={cn("h-5 w-5", stats.riskScore < 30 ? "text-[#22C55E]" : "")} />
                    ) : stats.riskScore < 70 ? (
                      <Clock className="h-5 w-5 text-[#FACC15]" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Charts - Modern Style with Gradients */}
      {(statusData.length > 0 || loanHistoryData.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {/* Loan Status Distribution - Doughnut Chart */}
          {statusData.length > 0 && (
            <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B] hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Loan Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                        </filter>
                        {statusData.map((entry, index) => (
                          <linearGradient key={`gradient-${index}`} id={`gradient-${entry.name}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                            <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        filter="url(#shadow)"
                      >
                        {statusData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#gradient-${entry.name})`}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xl p-3">
                                <p className="font-semibold text-neutral-900 dark:text-neutral-100">{data.name}</p>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                  {data.value} loan{data.value !== 1 ? 's' : ''} ({((data.value / totalLoansCount) * 100).toFixed(0)}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry: any) => (
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ marginTop: '-18px' }}>
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{totalLoansCount}</p>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Loans</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loan Amount History - Area Chart with Gradient */}
          {loanHistoryData.length > 0 && (
            <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B] hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Loan Amount Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={loanHistoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006BFF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#006BFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      tickFormatter={(value) => `K${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xl p-3">
                              <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{label}</p>
                              <p className="text-sm text-[#006BFF]">
                                Amount: {formatCurrency(payload[0].value as number, 'ZMW')}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {payload[0].payload.count} loan{payload[0].payload.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#006BFF"
                      strokeWidth={3}
                      fill="url(#colorAmount)"
                      dot={{ fill: '#006BFF', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#006BFF', stroke: 'white', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Loan History - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900">Loan History</CardTitle>
          </CardHeader>
          <CardContent>
            {loansLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#006BFF]" />
              </div>
            ) : loans && loans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Loan ID</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Type</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Created</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any, index: number) => (
                    <motion.tr
                      key={loan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-neutral-700">{loan.id.substring(0, 8)}</TableCell>
                      <TableCell className="text-right font-semibold text-neutral-900">
                        {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                      </TableCell>
                      <TableCell className="capitalize text-neutral-700">{loan.loanType || '-'}</TableCell>
                      <TableCell>
                        {loan.status === 'active' ? (
                          <Badge className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20">Active</Badge>
                        ) : loan.status === 'pending' ? (
                          <Badge className="bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20">Pending</Badge>
                        ) : loan.status === 'defaulted' ? (
                          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20">Defaulted</Badge>
                        ) : (
                          <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200">{loan.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-600 text-sm">
                        {formatDateSafe(loan.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/loans/${loan.id}`}>
                          <Button variant="outline" size="sm" className="rounded-lg">View</Button>
                        </Link>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-600 font-medium">No loans found for this customer</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <NewLoanDrawer
        open={newLoanDrawerOpen}
        onOpenChange={setNewLoanDrawerOpen}
        preselectedCustomerId={customerId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-loans', profile?.agency_id, customerId] });
          queryClient.invalidateQueries({ queryKey: ['customer', profile?.agency_id, customerId] });
        }}
      />

      {customer && (
        <EditCustomerDrawer
          open={editCustomerDrawerOpen}
          onOpenChange={setEditCustomerDrawerOpen}
          customer={customer}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['customer', profile?.agency_id, customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers', profile?.agency_id] });
          }}
        />
      )}
    </div>
  );
}

