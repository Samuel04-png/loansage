import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, Mail, Phone, Calendar, MapPin, FileText, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { profile } = useAuth();

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
        const { getCustomerLoans } = await import('../../../lib/firebase/dashboard-helpers');
        let loansData = await getCustomerLoans(profile.agency_id, customerId);
        
        // Fallback: try alternative field names if no results
        if (loansData.length === 0) {
          console.log('No loans found with customerId, trying alternative queries...');
          const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
          
          // Try with different field names
          const queries = [
            firestoreQuery(loansRef, where('customerId', '==', customerId)),
            firestoreQuery(loansRef, where('customer_id', '==', customerId)),
            firestoreQuery(loansRef, where('customer', '==', customerId)),
          ];
          
          for (const q of queries) {
            try {
              const snapshot = await getDocs(q);
              loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              if (loansData.length > 0) {
                console.log(`Found ${loansData.length} loans using alternative query`);
                break;
              }
            } catch (err) {
              console.warn('Query failed:', err);
            }
          }
        }
        
        // Fetch repayments for each loan
        const loansWithRepayments = await Promise.all(
          loansData.map(async (loan: any) => {
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
              loan.repayments = repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
              console.warn('Failed to fetch repayments:', error);
              loan.repayments = [];
            }
            return loan;
          })
        );
        
        console.log(`Customer ${customerId} has ${loansWithRepayments.length} loans`);
        return loansWithRepayments;
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

  // Loan status distribution
  const statusData = loans ? [
    { name: 'Active', value: loans.filter((l: any) => l.status === 'active').length, color: '#10b981' },
    { name: 'Completed', value: loans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length, color: '#3b82f6' },
    { name: 'Pending', value: loans.filter((l: any) => l.status === 'pending').length, color: '#f59e0b' },
    { name: 'Defaulted', value: loans.filter((l: any) => l.status === 'defaulted').length, color: '#ef4444' },
  ] : [];

  if (customerLoading || loansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (customerError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Error loading customer</p>
        <p className="text-sm text-slate-400 mb-4">
          {customerError instanceof Error ? customerError.message : 'Unknown error'}
        </p>
        <Link to="/admin/customers">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Customer not found</p>
        <p className="text-sm text-slate-400 mb-4">Customer ID: {customerId}</p>
        <p className="text-xs text-slate-400 mb-4">Agency ID: {profile?.agency_id || 'N/A'}</p>
        <Link to="/admin/customers">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/customers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{customer.fullName || 'Customer'}</h2>
            <p className="text-slate-600">{customer.email || customer.phone || 'No contact info'}</p>
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-semibold">{customer.fullName || 'N/A'}</p>
                </div>
                {customer.email && (
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </p>
                  </div>
                )}
                {customer.phone && (
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </p>
                  </div>
                )}
                {customer.nrc && (
                  <div>
                    <p className="text-sm text-slate-500">NRC/ID Number</p>
                    <p className="font-mono text-sm">{customer.nrc}</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="space-y-4">
                {customer.address && (
                  <div>
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {customer.address}
                    </p>
                  </div>
                )}
                {customer.employer && (
                  <div>
                    <p className="text-sm text-slate-500">Employer</p>
                    <p className="font-semibold">{customer.employer}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500">Customer ID</p>
                  <p className="font-mono text-sm">{customer.id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registered</p>
                  <p className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDateSafe(customer.createdAt)}
                  </p>
                </div>
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
                  <p className="text-sm font-medium text-slate-500">Total Borrowed</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(stats.totalBorrowed, 'ZMW')}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Outstanding</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatCurrency(stats.totalOutstanding, 'ZMW')}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-amber-600" />
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
        </div>
      )}

      {/* Charts */}
      {statusData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Loan Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
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
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan: any) => (
                    <tr key={loan.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{loan.id.substring(0, 8)}</td>
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
                      <td className="px-4 py-3 text-right">
                        <Link to={`/admin/loans/${loan.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No loans found for this customer
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

