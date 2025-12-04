import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, MoreVertical, FileText, Loader2, Edit, Download, Upload } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { exportLoans } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export function LoansPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newLoanDrawerOpen, setNewLoanDrawerOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<{ id: string; status: string } | null>(null);

  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ['loans', profile?.agency_id, statusFilter],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      let q = firestoreQuery(loansRef);
      
      if (statusFilter !== 'all') {
        q = firestoreQuery(loansRef, where('status', '==', statusFilter));
      }

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
              } else {
                // Customer not found - set to null so we can show N/A
                loan.customer = null;
              }
            } catch (error) {
              console.warn('Failed to fetch customer:', error);
              loan.customer = null;
            }
          } else {
            loan.customer = null;
          }
          return loan;
        })
      );

      return loansWithCustomers;
    },
    enabled: !!profile?.agency_id,
  });

  const filteredLoans = loans?.filter((loan: any) =>
    loan.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.customer?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.customer?.id?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'defaulted':
        return <Badge variant="destructive">Defaulted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Loan Portfolio</h2>
          <p className="text-slate-600">Manage all loans in your agency</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (loans && loans.length > 0) {
                exportLoans(loans);
                toast.success('Loans exported successfully');
              } else {
                toast.error('No loans to export');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setNewLoanDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by loan number or customer..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Loan Number</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.map((loan: any) => (
                    <tr
                      key={loan.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-medium">{loan.id}</td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900">
                            {loan.customer?.fullName || 'N/A'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {loan.customer?.id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {formatCurrency(Number(loan.amount), 'ZMW')}
                      </td>
                      <td className="px-6 py-4 capitalize">{loan.loanType}</td>
                      <td className="px-6 py-4">{loan.durationMonths} months</td>
                      <td className="px-6 py-4">{getStatusBadge(loan.status)}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDateSafe(loan.createdAt?.toDate?.() || loan.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLoan({ id: loan.id, status: loan.status });
                              setStatusDialogOpen(true);
                            }}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Status
                          </Button>
                          <Link to={`/admin/loans/${loan.id}`}>
                            <Button variant="outline" size="sm">View Details</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No loans found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <NewLoanDrawer
        open={newLoanDrawerOpen}
        onOpenChange={setNewLoanDrawerOpen}
        onSuccess={() => {
          refetch();
        }}
      />

      {selectedLoan && (
        <LoanStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          loanId={selectedLoan.id}
          currentStatus={selectedLoan.status}
          agencyId={profile?.agency_id || ''}
        />
      )}
    </div>
  );
}

