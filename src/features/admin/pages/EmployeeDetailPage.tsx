import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp, TrendingDown, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  if (employeeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (employeeError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Error loading employee</p>
        <p className="text-sm text-slate-400 mb-4">{employeeError.message || 'Unknown error'}</p>
        <Link to="/admin/employees">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  if (!employee && !employeeLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Employee not found</p>
        <p className="text-sm text-slate-400 mb-4">Employee ID: {employeeId}</p>
        <p className="text-xs text-slate-400 mb-4">Agency ID: {profile?.agency_id || 'N/A'}</p>
        <Link to="/admin/employees">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/employees">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{employee.name || 'Employee'}</h2>
            <p className="text-slate-600">{employee.email}</p>
          </div>
        </div>
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-semibold">{employee.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {employee.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Role</p>
                  <Badge variant="outline" className="mt-1">
                    {employee.role?.replace('_', ' ') || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  {employee.status === 'active' ? (
                    <Badge variant="success" className="mt-1">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-1">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Employee ID</p>
                  <p className="font-mono text-sm">{employee.id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">User ID</p>
                  <p className="font-mono text-sm">{employee.userId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Joined</p>
                  <p className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDateSafe(employee.createdAt)}
                  </p>
                </div>
                {employee.user?.phone && (
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {employee.user.phone}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Loans</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalLoans}</p>
                </div>
                <FileText className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Active Portfolio</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(stats.totalPortfolio, 'ZMW')}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Risk Score</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.riskScore}/100</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.riskScore < 30 ? 'Low Risk' : stats.riskScore < 70 ? 'Medium Risk' : 'High Risk'}
                  </p>
                </div>
                {stats.riskScore < 30 ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                ) : stats.riskScore < 70 ? (
                  <Clock className="h-8 w-8 text-amber-600" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Default Rate</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.defaultRate}%</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
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
                <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Amount Disbursed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Loan History */}
      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
        </CardHeader>
        <CardContent>
          {loansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : loans && loans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Loan ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan: any) => (
                    <tr key={loan.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{loan.id.substring(0, 8)}</td>
                      <td className="px-4 py-3">
                        {loan.customer?.fullName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(Number(loan.amount || 0), 'ZMW')}
                      </td>
                      <td className="px-4 py-3 capitalize">{loan.loanType || '-'}</td>
                      <td className="px-4 py-3">
                        {loan.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : loan.status === 'pending' ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : loan.status === 'defaulted' ? (
                          <Badge variant="destructive">Defaulted</Badge>
                        ) : (
                          <Badge variant="outline">{loan.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateSafe(loan.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No loans found for this employee
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

