import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Calendar, FileText, Download, Filter, Search, Loader2, Upload, CheckCircle2, AlertCircle, FileCheck } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { parseBankStatementFile, matchBankTransactions, generateReconciliationReport } from '../../../lib/accounting/bank-reconciliation';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';

export function AccountingPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [reconciliationMatches, setReconciliationMatches] = useState<any[]>([]);
  const [reconciliationReport, setReconciliationReport] = useState<any>(null);
  const [processingReconciliation, setProcessingReconciliation] = useState(false);
  const bankStatementFileRef = useRef<HTMLInputElement>(null);

  // Get all loans for financial calculations
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['accounting-loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        disbursementDate: doc.data().disbursementDate?.toDate?.() || doc.data().disbursementDate,
      }));
    },
    enabled: !!profile?.agency_id,
  });

  // Get all repayments
  const { data: repayments, isLoading: repaymentsLoading } = useQuery({
    queryKey: ['accounting-repayments', profile?.agency_id, loans?.map((l: any) => l.id)],
    queryFn: async () => {
      if (!loans || loans.length === 0 || !profile?.agency_id) return [];

      const allRepayments: any[] = [];

      for (const loan of loans) {
        const repaymentsRef = collection(
          db,
          'agencies',
          profile.agency_id,
          'loans',
          loan.id,
          'repayments'
        );
        const snapshot = await getDocs(repaymentsRef);
        const loanRepayments = snapshot.docs.map(doc => ({
          id: doc.id,
          loanId: loan.id,
          customerId: loan.customerId,
          customerName: loan.customer?.fullName || loan.customerName || 'N/A',
          loanOfficerId: loan.loanOfficerId || loan.createdBy,
          loanOfficerName: loan.loanOfficer?.name || loan.loanOfficerName || 'N/A',
          ...doc.data(),
          dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate,
          paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
        }));
        allRepayments.push(...loanRepayments);
      }

      return allRepayments;
    },
    enabled: !!loans && loans.length > 0 && !!profile?.agency_id,
  });

  // Calculate financial metrics
  const financialData = loans ? (() => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const activeLoans = loans.filter((l: any) => l.status === 'active');
    const disbursedThisPeriod = loans.filter((l: any) => {
      const disbursementDate = l.disbursementDate;
      return disbursementDate && new Date(disbursementDate) >= startDate;
    });

    const totalDisbursed = disbursedThisPeriod.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
    const totalPortfolio = activeLoans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);

    // Calculate collections
    const paidRepayments = repayments?.filter((r: any) => r.status === 'paid' && r.paidAt && new Date(r.paidAt) >= startDate) || [];
    const totalCollections = paidRepayments.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0);

    // Calculate outstanding
    const pendingRepayments = repayments?.filter((r: any) => r.status === 'pending') || [];
    const totalOutstanding = pendingRepayments.reduce((sum: number, r: any) => sum + Number(r.amountDue || 0), 0);

    // Calculate interest income
    const interestIncome = paidRepayments.reduce((sum: number, r: any) => {
      const loan = loans.find((l: any) => l.id === r.loanId);
      if (loan && (loan as any).interestRate) {
        const interestPortion = Number(r.amountPaid || 0) - Number(r.amountPaid || 0) / (1 + Number((loan as any).interestRate || 0) / 100);
        return sum + interestPortion;
      }
      return sum;
    }, 0);

    // Calculate defaulted loans
    const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
    const defaultedAmount = defaultedLoans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);

    return {
      totalDisbursed,
      totalPortfolio,
      totalCollections,
      totalOutstanding,
      interestIncome,
      defaultedAmount,
      activeLoansCount: activeLoans.length,
      defaultedCount: defaultedLoans.length,
    };
  })() : null;

  // Monthly breakdown for chart
  const monthlyData = loans ? (() => {
    const months: Record<string, { disbursed: number; collected: number }> = {};
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      months[monthKey] = { disbursed: 0, collected: 0 };
    }

    loans.forEach((loan: any) => {
      const disbursementDate = loan.disbursementDate;
      if (disbursementDate) {
        const date = new Date(disbursementDate);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (months[monthKey]) {
          months[monthKey].disbursed += Number(loan.amount || 0);
        }
      }
    });

    repayments?.forEach((repayment: any) => {
      if (repayment.status === 'paid' && repayment.paidAt) {
        const date = new Date(repayment.paidAt);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (months[monthKey]) {
          months[monthKey].collected += Number(repayment.amountPaid || 0);
        }
      }
    });

    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
  })() : [];

  // Loan status distribution
  const statusData = loans ? [
    { name: 'Active', value: loans.filter((l: any) => l.status === 'active').length, color: '#10b981' },
    { name: 'Pending', value: loans.filter((l: any) => l.status === 'pending').length, color: '#f59e0b' },
    { name: 'Completed', value: loans.filter((l: any) => l.status === 'completed' || l.status === 'paid').length, color: '#3b82f6' },
    { name: 'Defaulted', value: loans.filter((l: any) => l.status === 'defaulted').length, color: '#ef4444' },
  ] : [];

  if (loansLoading || repaymentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Accounting & Finance</h2>
          <p className="text-slate-600">Financial overview and loan portfolio management</p>
        </div>
        <div className="flex gap-2">
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Portfolio</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(financialData?.totalPortfolio || 0, 'ZMW')}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Collections ({dateRange})</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(financialData?.totalCollections || 0, 'ZMW')}
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
                <p className="text-sm font-medium text-slate-500">Outstanding</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {formatCurrency(financialData?.totalOutstanding || 0, 'ZMW')}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Interest Income</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(financialData?.interestIncome || 0, 'ZMW')}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Disbursed ({dateRange})</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(financialData?.totalDisbursed || 0, 'ZMW')}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active Loans</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {financialData?.activeLoansCount || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Defaulted Amount</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(financialData?.defaultedAmount || 0, 'ZMW')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {financialData?.defaultedCount || 0} loans
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Disbursement vs Collections</CardTitle>
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
                <Bar dataKey="disbursed" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Disbursed" />
                <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Status Distribution</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Overview of loan portfolio by status
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={statusData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, value, percent }) => 
                    `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                  }
                  outerRadius={100}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const total = statusData.reduce((sum, d) => sum + d.value, 0);
                    return [
                      `${value} loans (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                      name
                    ];
                  }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: any) => {
                    const entry = statusData.find(d => d.name === value);
                    return (
                      <span style={{ color: entry?.color || '#000' }}>
                        {value} ({entry?.value || 0})
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-slate-600">
                    {entry.name}: <strong>{entry.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Reconciliation */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Bank Reconciliation</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Match bank statement transactions with repayments</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setReconciliationDialogOpen(true)}
            >
              <FileCheck className="mr-2 h-4 w-4" />
              Reconcile Bank Statement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <FileCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Upload a bank statement CSV to reconcile transactions</p>
            <p className="text-xs mt-2">Supports common CSV formats with date, description, and amount columns</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Reports */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Financial Reports</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                title="P&L Report generation coming soon"
              >
                <FileText className="mr-2 h-4 w-4" />
                P&L Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Trial Balance generation coming soon"
              >
                <FileText className="mr-2 h-4 w-4" />
                Trial Balance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (repayments && repayments.length > 0) {
                    const csv = [
                      ['Date', 'Type', 'Loan ID', 'Amount', 'Status', 'Payment Method'],
                      ...repayments.map((r: any) => [
                        formatDateSafe(r.paidAt || r.dueDate),
                        r.status === 'paid' ? 'Collection' : 'Due Payment',
                        r.loanId || '',
                        Number(r.amountPaid || r.amountDue || 0).toFixed(2),
                        r.status || 'pending',
                        r.paymentMethod || 'N/A',
                      ]),
                    ].map(row => row.join(',')).join('\n');
                    
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transactions-${Date.now()}.csv`;
                    a.click();
                    toast.success('Transactions exported successfully');
                  } else {
                    toast.error('No transactions to export');
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Total Income</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(financialData?.interestIncome || 0, 'ZMW')}
              </p>
              <p className="text-xs text-slate-500 mt-1">Interest + Principal</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Collections</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(financialData?.totalCollections || 0, 'ZMW')}
              </p>
              <p className="text-xs text-slate-500 mt-1">This period</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(financialData?.totalOutstanding || 0, 'ZMW')}
              </p>
              <p className="text-xs text-slate-500 mt-1">Pending payments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search transactions..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Loan ID</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Loan Officer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {repayments
                  ?.filter((r: any) => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      r.loanId?.toLowerCase().includes(search) ||
                      r.id?.toLowerCase().includes(search) ||
                      r.type?.toLowerCase().includes(search) ||
                      r.description?.toLowerCase().includes(search) ||
                      String(r.amount || '').includes(search)
                    );
                  })
                  .sort((a: any, b: any) => {
                    const aDate = a.paidAt || a.dueDate;
                    const bDate = b.paidAt || b.dueDate;
                    return bDate?.getTime() - aDate?.getTime();
                  })
                  .slice(0, 20)
                  .map((repayment: any) => (
                    <tr key={`${repayment.loanId}-${repayment.id}`} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {formatDateSafe(repayment.paidAt || repayment.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        {repayment.status === 'paid' ? 'Collection' : 'Due Payment'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{repayment.loanId?.substring(0, 8)}</td>
                      <td className="px-4 py-3">
                        {repayment.customerName || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {repayment.loanOfficerName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(Number(repayment.amountPaid || repayment.amountDue || 0), 'ZMW')}
                      </td>
                      <td className="px-4 py-3">
                        {repayment.status === 'paid' ? (
                          <Badge variant="success">Paid</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bank Reconciliation Dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bank Reconciliation</DialogTitle>
            <DialogDescription>
              Upload your bank statement CSV to automatically match transactions with repayments
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Upload Bank Statement</label>
              <input
                ref={bankStatementFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !repayments) return;

                  setProcessingReconciliation(true);
                  try {
                    const bankTransactions = await parseBankStatementFile(file);
                    if (bankTransactions.length === 0) {
                      toast.error('No valid transactions found in the file');
                      setProcessingReconciliation(false);
                      return;
                    }
                    
                    const matches = matchBankTransactions(bankTransactions, repayments);
                    const report = generateReconciliationReport(matches);
                    
                    setReconciliationMatches(matches);
                    setReconciliationReport(report);
                    toast.success(`Processed ${bankTransactions.length} transactions. ${report.matched} matched, ${report.unmatched} unmatched.`);
                  } catch (error: any) {
                    console.error('Reconciliation error:', error);
                    toast.error('Failed to process bank statement: ' + error.message);
                  } finally {
                    setProcessingReconciliation(false);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => bankStatementFileRef.current?.click()}
                disabled={processingReconciliation}
                className="w-full"
              >
                {processingReconciliation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Select File (CSV/Excel)
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                File should contain: Date, Description, Amount columns (Reference optional). Supports CSV, XLSX, and XLS formats.
              </p>
            </div>

            {reconciliationReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-600">Total Transactions</p>
                    <p className="text-lg font-bold">{reconciliationReport.totalTransactions}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(reconciliationReport.totalAmount, 'ZMW')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Matched</p>
                    <p className="text-lg font-bold text-green-600">{reconciliationReport.matched}</p>
                    <p className="text-xs text-green-600">{formatCurrency(reconciliationReport.matchedAmount, 'ZMW')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Unmatched</p>
                    <p className="text-lg font-bold text-red-600">{reconciliationReport.unmatched}</p>
                    <p className="text-xs text-red-600">{formatCurrency(reconciliationReport.unmatchedAmount, 'ZMW')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Match Rate</p>
                    <p className="text-lg font-bold">{reconciliationReport.matchRate.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">
                      {reconciliationReport.highConfidence} high, {reconciliationReport.mediumConfidence} medium
                    </p>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Match</th>
                        <th className="px-4 py-2 text-left">Confidence</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationMatches.map((match, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-4 py-2">{match.bankTransaction.date}</td>
                          <td className="px-4 py-2">{match.bankTransaction.description}</td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {formatCurrency(match.bankTransaction.amount, 'ZMW')}
                          </td>
                          <td className="px-4 py-2">
                            {match.repayment ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-mono">
                                  {match.repayment.loanId?.substring(0, 8)}
                                </span>
                              </div>
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <Badge
                              variant={
                                match.matchConfidence === 'high' ? 'success' :
                                match.matchConfidence === 'medium' ? 'warning' : 'outline'
                              }
                            >
                              {match.matchConfidence}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">
                            {match.matchReason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReconciliationDialogOpen(false);
                setReconciliationMatches([]);
                setReconciliationReport(null);
              }}
            >
              Close
            </Button>
            {reconciliationReport && (
              <Button
                onClick={async () => {
                  try {
                    // Get matches with high or medium confidence
                    const matchesToApply = reconciliationMatches.filter(
                      m => m.repayment && (m.matchConfidence === 'high' || m.matchConfidence === 'medium')
                    );
                    
                    if (matchesToApply.length === 0) {
                      toast.error('No matches to apply. Only high/medium confidence matches can be applied.');
                      return;
                    }
                    
                    setProcessingReconciliation(true);
                    
                    // Import Firestore functions
                    const { doc, updateDoc, serverTimestamp, Timestamp } = await import('firebase/firestore');
                    
                    let applied = 0;
                    let failed = 0;
                    
                    for (const match of matchesToApply) {
                      try {
                        const repayment = match.repayment;
                        const bankTx = match.bankTransaction;
                        
                        // Update repayment status to paid
                        const repaymentRef = doc(
                          db,
                          'agencies',
                          profile!.agency_id,
                          'loans',
                          repayment.loanId,
                          'repayments',
                          repayment.id
                        );
                        
                        await updateDoc(repaymentRef, {
                          status: 'paid',
                          amountPaid: bankTx.amount,
                          paidAt: bankTx.date ? Timestamp.fromDate(new Date(bankTx.date)) : serverTimestamp(),
                          paymentMethod: 'bank_transfer',
                          notes: `Reconciled from bank statement: ${bankTx.description}`,
                          reconciledAt: serverTimestamp(),
                          reconciledBy: profile!.id,
                          transactionId: bankTx.reference || bankTx.account || undefined,
                          updatedAt: serverTimestamp(),
                        });
                        
                        // Update loan summary after payment
                        const { updateLoanAfterPayment } = await import('../../../lib/firebase/repayment-helpers');
                        await updateLoanAfterPayment(profile!.agency_id, repayment.loanId);
                        
                        applied++;
                      } catch (error: any) {
                        console.error('Error applying match:', error);
                        failed++;
                      }
                    }
                    
                    // Invalidate queries to refresh data
                    queryClient.invalidateQueries({ queryKey: ['accounting-repayments'] });
                    queryClient.invalidateQueries({ queryKey: ['accounting-loans'] });
                    
                    if (applied > 0) {
                      toast.success(`Successfully reconciled ${applied} repayment${applied > 1 ? 's' : ''}`);
                    }
                    if (failed > 0) {
                      toast.error(`Failed to reconcile ${failed} repayment${failed > 1 ? 's' : ''}`);
                    }
                    
                    setReconciliationDialogOpen(false);
                    setReconciliationMatches([]);
                    setReconciliationReport(null);
                  } catch (error: any) {
                    console.error('Error applying reconciliation:', error);
                    toast.error('Failed to apply reconciliation: ' + error.message);
                  } finally {
                    setProcessingReconciliation(false);
                  }
                }}
                disabled={processingReconciliation}
                className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
              >
                {processingReconciliation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-4 w-4" />
                    Apply Matches ({reconciliationMatches.filter(m => m.repayment && (m.matchConfidence === 'high' || m.matchConfidence === 'medium')).length})
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

