import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, DollarSign, Download, FileSpreadsheet, Calendar, User, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { exportLoans } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export function LoanDisbursementPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const { data: disbursements = [], isLoading } = useQuery({
    queryKey: ['loan-disbursements', profile?.agency_id, dateRange],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      let q = query(loansRef, where('status', 'in', ['approved', 'active']));
      
      const snapshot = await getDocs(q);
      const loans = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const loan = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Fetch customer
          if (loan.customerId) {
            try {
              const { doc: getDoc, getDoc: getDocData } = await import('firebase/firestore');
              const customerRef = getDoc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
              const customerDoc = await getDocData(customerRef);
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

      // Filter by date range
      const now = new Date();
      const filtered = loans.filter((loan: any) => {
        const disbursedDate = loan.disbursedAt?.toDate?.() || loan.startDate?.toDate?.() || loan.createdAt?.toDate?.();
        if (!disbursedDate) return false;
        
        if (dateRange === 'today') {
          return disbursedDate.toDateString() === now.toDateString();
        } else if (dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return disbursedDate >= weekAgo;
        } else if (dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return disbursedDate >= monthAgo;
        }
        return true;
      });

      return filtered;
    },
    enabled: !!profile?.agency_id,
  });

  const totalDisbursed = disbursements.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0);
  const totalCount = disbursements.length;

  const handleExport = async () => {
    try {
      await exportLoans(disbursements, 'loan-disbursements');
      toast.success('Exported to Excel successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export');
    }
  };

  const filteredDisbursements = disbursements.filter((loan: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.loanNumber?.toLowerCase().includes(search) ||
      loan.customer?.fullName?.toLowerCase().includes(search) ||
      String(loan.amount || '').includes(search)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-[#006BFF]" />
            Loan Disbursement
          </h1>
          <p className="text-neutral-600 mt-2">Track and manage loan disbursements</p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Total Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{formatCurrency(totalDisbursed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Average Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">
              {totalCount > 0 ? formatCurrency(totalDisbursed / totalCount) : formatCurrency(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search disbursements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
                icon={Search}
              />
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateRange(range)}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-neutral-500">Loading disbursements...</div>
          ) : filteredDisbursements.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No disbursements found</h3>
              <p className="text-neutral-500">No loans have been disbursed in the selected period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDisbursements.map((loan: any) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-neutral-900">
                          {loan.loanNumber || `Loan #${loan.id.slice(0, 8)}`}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {loan.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-neutral-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {loan.customer?.fullName || loan.customer?.name || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDateSafe(loan.disbursedAt?.toDate?.() || loan.startDate?.toDate?.() || loan.createdAt?.toDate?.())}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-neutral-900">{formatCurrency(loan.amount || 0)}</p>
                      <p className="text-xs text-neutral-500">{loan.interestRate || 0}% interest</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/loans/${loan.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

