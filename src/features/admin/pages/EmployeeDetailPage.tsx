import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
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
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp, TrendingDown, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { profile } = useAuth();

  // Fetch employee details
  const { data: employee, isLoading: employeeLoading, error: employeeError } = useQuery({
    queryKey: ['employee', profile?.agency_id, employeeId],
    queryFn: async () => {
      if (!profile?.agency_id || !employeeId) {
        console.warn('Missing agency_id or employeeId', { agency_id: profile?.agency_id, employeeId });
        return null;
      }

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const employeeRef = doc(db, 'agencies', profile.agency_id, 'employees', employeeId);
        const employeeSnap = await getDoc(employeeRef);
        
        if (!employeeSnap.exists()) {
          console.warn('Employee document does not exist', { employeeId, agency_id: profile.agency_id });
          return null;
        }
        
        const empData = { id: employeeSnap.id, ...employeeSnap.data() };
        console.log('Employee data fetched:', empData);
        
        // Fetch user details if userId exists
        if (empData.userId) {
          try {
            const userRef = doc(db, 'users', empData.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              empData.user = { id: userSnap.id, ...userSnap.data() };
            }
          } catch (error) {
            console.warn('Failed to fetch user details:', error);
          }
        }
        
        return empData;
      } catch (error) {
        console.error('Error fetching employee:', error);
        throw error;
      }
    },
    enabled: !!profile?.agency_id && !!employeeId,
  });

  // Fetch employee's loans
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['employee-loans', profile?.agency_id, employee?.userId],
    queryFn: async () => {
      if (!profile?.agency_id || !employee?.userId) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = firestoreQuery(loansRef, where('officerId', '==', employee.userId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch customer data for each loan
      const loansWithCustomers = await Promise.all(
        loansData.map(async (loan: any) => {
          if (loan.customerId) {
            try {
              const { doc, getDoc } = await import('firebase/firestore');
              const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
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
      
      return loansWithCustomers;
    },
    enabled: !!profile?.agency_id && !!employee?.userId,
  });

  // Calculate employee statistics
  const stats = loans ? (() => {
    const activeLoans = loans.filter((l: any) => l.status === 'active');
    const pendingLoans = loans.filter((l: any) => l.status === 'pending');
    const completedLoans = loans.filter((l: any) => l.status === 'completed' || l.status === 'paid');
    const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
    
    const totalPortfolio = activeLoans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
    const totalDisbursed = loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
    
    // Calculate risk score (0-100, lower is better)
    const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0;
    const overdueCount = activeLoans.filter((l: any) => {
      // Check if loan has overdue repayments (simplified)
      return false; // Would need to check repayments
    }).length;
    
    const riskScore = Math.min(100, Math.max(0, defaultRate * 2 + overdueCount * 5));
    
    return {
      totalLoans: loans.length,
      activeLoans: activeLoans.length,
      pendingLoans: pendingLoans.length,
      completedLoans: completedLoans.length,
      defaultedLoans: defaultedLoans.length,
      totalPortfolio,
      totalDisbursed,
      riskScore: Math.round(riskScore),
      defaultRate: Math.round(defaultRate * 10) / 10,
    };
  })() : null;

  // Monthly performance chart
  const monthlyData = loans ? (() => {
    const months: Record<string, { loans: number; amount: number }> = {};
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      months[monthKey] = { loans: 0, amount: 0 };
    }

    loans.forEach((loan: any) => {
      const createdAt = loan.createdAt?.toDate?.() || loan.createdAt;
      if (createdAt) {
        const date = new Date(createdAt);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (months[monthKey]) {
          months[monthKey].loans += 1;
          months[monthKey].amount += Number(loan.amount || 0);
        }
      }
    });

    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
  })() : [];

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'E';
  };

  if (employeeLoading || loansLoading) {
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

  if (employeeError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[#EF4444]" />
        <p className="text-lg font-semibold text-neutral-900 mb-2">Error loading employee</p>
        <p className="text-sm text-neutral-600 mb-6">{employeeError.message || 'Unknown error'}</p>
        <Link to="/admin/employees">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </motion.div>
    );
  }

  if (!employee && !employeeLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
        <p className="text-lg font-semibold text-neutral-900 mb-2">Employee not found</p>
        <p className="text-sm text-neutral-600 mb-6">Employee ID: {employeeId}</p>
        <Link to="/admin/employees">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </motion.div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-4"
      >
        <Link to="/admin/employees">
          <Button variant="outline" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-neutral-200">
            <AvatarImage src={employee.user?.profilePhotoURL} />
            <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-lg font-semibold">
              {getInitials(employee.name || employee.user?.full_name || 'Employee')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">{employee.name || employee.user?.full_name || 'Employee'}</h2>
            <p className="text-sm text-neutral-600">{employee.email || employee.user?.email || 'No contact info'}</p>
          </div>
        </div>
      </motion.div>

      {/* Employee Info Card - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900">Employee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Full Name</p>
                    <p className="text-base font-semibold text-neutral-900">{employee.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-neutral-400" />
                      {employee.email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Role</p>
                    <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200 mt-1">
                      {employee.role?.replace('_', ' ') || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Status</p>
                    {employee.status === 'active' ? (
                      <Badge className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 mt-1">Active</Badge>
                    ) : (
                      <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 mt-1">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Employee ID</p>
                    <p className="font-mono text-sm text-neutral-700">{employee.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">User ID</p>
                    <p className="font-mono text-sm text-neutral-700">{employee.userId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Joined</p>
                    <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      {formatDateSafe(employee.createdAt)}
                    </p>
                  </div>
                  {employee.user?.phone && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-base font-medium text-neutral-700 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-neutral-400" />
                        {employee.user.phone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Statistics - Reference Style */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Loans', value: stats.totalLoans, icon: FileText, color: 'text-[#006BFF]' },
            { label: 'Active Portfolio', value: formatCurrency(stats.totalPortfolio, 'ZMW'), icon: TrendingUp, color: 'text-[#22C55E]' },
            { label: 'Default Rate', value: `${stats.defaultRate}%`, icon: TrendingDown, color: 'text-[#EF4444]' },
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
                      <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
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
            transition={{ delay: 0.25 }}
          >
            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white hover:shadow-[0_12px_40px_rgb(0,0,0,0.1)] transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Risk Score</p>
                    <p className="text-2xl font-bold text-neutral-900">{stats.riskScore}/100</p>
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

      {/* Performance Chart - Reference Style */}
      {monthlyData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-neutral-900">Monthly Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `K${(value / 1000).toFixed(0)}`}
                  />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 8px 30px rgb(0,0,0,0.06)',
                      backgroundColor: 'white',
                    }}
                    formatter={(value: any) => formatCurrency(value, 'ZMW')}
                />
                <Bar dataKey="amount" fill="#006BFF" radius={[4, 4, 0, 0]} name="Amount Disbursed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Loan History - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
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
                  <TableRow className="hover:bg-transparent border-b border-neutral-200">
                    <TableHead className="font-semibold text-neutral-700">Loan ID</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Customer</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Type</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any, index: number) => (
                    <motion.tr
                      key={loan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.03 }}
                      className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-neutral-700">{loan.id.substring(0, 8)}</TableCell>
                      <TableCell className="text-neutral-900">{loan.customer?.fullName || 'N/A'}</TableCell>
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
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-600 font-medium">No loans found for this employee</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

