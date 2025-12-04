import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, FileText, Loader2, Edit, Download, Upload, Eye } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { exportLoans } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

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
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' },
      pending: { label: 'Pending', className: 'bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20' },
      approved: { label: 'Approved', className: 'bg-[#006BFF]/10 text-[#006BFF] border-[#006BFF]/20' },
      rejected: { label: 'Rejected', className: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
      paid: { label: 'Paid', className: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' },
      defaulted: { label: 'Defaulted', className: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    return <Badge className={cn('border', config.className)}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">Loan Portfolio</h2>
          <p className="text-sm text-neutral-600">Manage all loans in your agency</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
            className="rounded-xl border-neutral-200 hover:bg-neutral-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            onClick={() => setNewLoanDrawerOpen(true)}
            className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </motion.div>

      {/* Search, Filter, and Table - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-4 border-b border-neutral-200/50">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search by loan number or customer..."
                  className="pl-9 rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="flex h-10 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] transition-all"
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
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredLoans.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200">
                    <TableHead className="font-semibold text-neutral-700">Loan Number</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Customer</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Amount</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Type</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Duration</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Created</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan: any, index: number) => (
                    <motion.tr
                      key={loan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                    >
                      <TableCell className="font-medium text-neutral-900">{loan.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold text-neutral-900">
                            {loan.customer?.fullName || 'N/A'}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {loan.customer?.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-neutral-900">
                        {formatCurrency(Number(loan.amount), 'ZMW')}
                      </TableCell>
                      <TableCell className="capitalize text-neutral-700">{loan.loanType || '-'}</TableCell>
                      <TableCell className="text-neutral-700">{loan.durationMonths || '-'} months</TableCell>
                      <TableCell>{getStatusBadge(loan.status)}</TableCell>
                      <TableCell className="text-neutral-600 text-sm">
                        {formatDateSafe(loan.createdAt?.toDate?.() || loan.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/loans/${loan.id}`} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedLoan({ id: loan.id, status: loan.status });
                                setStatusDialogOpen(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Change Status
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-16 text-neutral-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <p className="text-lg font-medium mb-2">No loans found</p>
                <p className="text-sm text-neutral-400 mb-6">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Get started by creating your first loan'}
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button
                    onClick={() => setNewLoanDrawerOpen(true)}
                    className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Loan
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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

