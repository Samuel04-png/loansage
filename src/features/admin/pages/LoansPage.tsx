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
import { Plus, Search, MoreVertical, FileText, Loader2, Edit, Download, Upload, Eye, DollarSign, TrendingUp, Percent, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { NewLoanDrawer } from '../components/NewLoanDrawer';
import { LoanStatusDialog } from '../components/LoanStatusDialog';
import { exportLoans } from '../../../lib/data-export';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { calculateLoanFinancials, calculateLoanProfit } from '../../../lib/firebase/loan-calculations';

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

      // Fetch customer data, repayments, and collateral for each loan
      const loansWithDetails = await Promise.all(
        loansData.map(async (loan: any) => {
          // Fetch customer
          if (loan.customerId) {
            try {
              const { doc, getDoc } = await import('firebase/firestore');
              const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
              const customerDoc = await getDoc(customerRef);
              if (customerDoc.exists()) {
                loan.customer = { id: customerDoc.id, ...customerDoc.data() };
              } else {
                loan.customer = null;
              }
            } catch (error) {
              console.warn('Failed to fetch customer:', error);
              loan.customer = null;
            }
          } else {
            loan.customer = null;
          }

          // Fetch repayments to calculate total paid
          try {
            const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'repayments');
            const repaymentsSnapshot = await getDocs(repaymentsRef);
            loan.repayments = repaymentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            
            // Calculate total paid
            const totalPaid = loan.repayments.reduce((sum: number, r: any) => 
              sum + Number(r.amountPaid || 0), 0);
            loan.totalPaid = totalPaid;
          } catch (error) {
            console.warn('Failed to fetch repayments:', error);
            loan.repayments = [];
            loan.totalPaid = 0;
          }

          // Fetch collateral to get market price
          try {
            const collateralRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'collateral');
            const collateralSnapshot = await getDocs(collateralRef);
            loan.collateral = collateralSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            
            // Calculate total collateral value (market price)
            const totalCollateralValue = loan.collateral.reduce((sum: number, c: any) => 
              sum + Number(c.estimatedValue || c.value || 0), 0);
            loan.totalCollateralValue = totalCollateralValue;
          } catch (error) {
            console.warn('Failed to fetch collateral:', error);
            loan.collateral = [];
            loan.totalCollateralValue = 0;
          }

          // Calculate financial metrics
          const principal = Number(loan.amount || 0);
          const interestRate = Number(loan.interestRate || 0);
          const durationMonths = Number(loan.durationMonths || 0);
          
          if (principal > 0 && interestRate > 0 && durationMonths > 0) {
            const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
            loan.financials = financials;
            
            // Calculate profit based on actual payments
            const totalInterest = financials.totalInterest;
            const totalAmountOwed = financials.totalAmount;
            const profitEarned = loan.totalPaid - principal;
            const remainingBalance = Math.max(0, totalAmountOwed - loan.totalPaid);
            
            loan.profitData = {
              profit: Math.max(0, profitEarned),
              profitMargin: principal > 0 ? (profitEarned / principal) * 100 : 0,
              remainingBalance,
              isProfitable: profitEarned > 0,
            };
            loan.remainingBalance = remainingBalance;
            loan.expectedProfit = totalInterest;
            loan.paymentProgress = totalAmountOwed > 0 ? (loan.totalPaid / totalAmountOwed) * 100 : 0;
          } else {
            loan.financials = null;
            loan.profitData = {
              profit: 0,
              profitMargin: 0,
              remainingBalance: principal,
              isProfitable: false,
            };
            loan.remainingBalance = principal;
            loan.expectedProfit = 0;
            loan.paymentProgress = 0;
          }

          return loan;
        })
      );

      return loansWithDetails;
    },
    enabled: !!profile?.agency_id,
  });

  const filteredLoans = loans?.filter((loan: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.id?.toLowerCase().includes(search) ||
      loan.loanNumber?.toLowerCase().includes(search) ||
      loan.customer?.fullName?.toLowerCase().includes(search) ||
      loan.customer?.name?.toLowerCase().includes(search) ||
      loan.customer?.id?.toLowerCase().includes(search) ||
      loan.customerId?.toLowerCase().includes(search) ||
      loan.loanType?.toLowerCase().includes(search) ||
      String(loan.amount || '').includes(search)
    );
  }) || [];

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

      {/* Portfolio Summary Cards */}
      {loans && loans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Total Portfolio
                  </p>
                  <p className="text-xl font-bold text-neutral-900">
                    {formatCurrency(
                      loans.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
                      'ZMW'
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {loans.length} active loans
                  </p>
                </div>
                <div className="p-3 bg-[#006BFF]/10 rounded-lg">
                  <DollarSign className="w-6 h-6 text-[#006BFF]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Total Collected
                  </p>
                  <p className="text-xl font-bold text-[#22C55E]">
                    {formatCurrency(
                      loans.reduce((sum: number, l: any) => sum + (l.totalPaid || 0), 0),
                      'ZMW'
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {loans.reduce((sum: number, l: any) => {
                      const progress = l.paymentProgress || 0;
                      return sum + (progress >= 100 ? 1 : 0);
                    }, 0)} fully paid
                  </p>
                </div>
                <div className="p-3 bg-[#22C55E]/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-[#22C55E]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Expected Profit
                  </p>
                  <p className="text-xl font-bold text-[#8B5CF6]">
                    {formatCurrency(
                      loans.reduce((sum: number, l: any) => sum + (l.expectedProfit || 0), 0),
                      'ZMW'
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {formatCurrency(
                      loans.reduce((sum: number, l: any) => sum + (l.profitData?.profit || 0), 0),
                      'ZMW'
                    )} earned
                  </p>
                </div>
                <div className="p-3 bg-[#8B5CF6]/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-[#8B5CF6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Outstanding Balance
                  </p>
                  <p className="text-xl font-bold text-[#EF4444]">
                    {formatCurrency(
                      loans.reduce((sum: number, l: any) => sum + (l.remainingBalance || 0), 0),
                      'ZMW'
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {loans.reduce((sum: number, l: any) => {
                      const balance = l.remainingBalance || 0;
                      return sum + (balance > 0 ? 1 : 0);
                    }, 0)} with balance
                  </p>
                </div>
                <div className="p-3 bg-[#EF4444]/10 rounded-lg">
                  <Percent className="w-6 h-6 text-[#EF4444]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                    <TableHead className="font-semibold text-neutral-700">Loan Details</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Customer</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Loan Amount</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Total Payable</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Paid</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Remaining</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Expected Profit</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Market Price</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Progress</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan: any, index: number) => {
                    const principal = Number(loan.amount || 0);
                    const interestRate = Number(loan.interestRate || 0);
                    const totalPaid = loan.totalPaid || 0;
                    const totalPayable = loan.financials?.totalAmount || principal;
                    const remainingBalance = loan.remainingBalance || totalPayable;
                    const expectedProfit = loan.expectedProfit || 0;
                    const marketPrice = loan.totalCollateralValue || 0;
                    const paymentProgress = loan.paymentProgress || 0;
                    const profitEarned = loan.profitData?.profit || 0;

                    return (
                      <motion.tr
                        key={loan.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-neutral-900 text-sm">
                              {loan.id.substring(0, 12)}...
                            </div>
                            <div className="text-xs text-neutral-500 capitalize">
                              {loan.loanType || 'N/A'}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {loan.durationMonths || '-'} months @ {interestRate}%
                            </div>
                            <div className="text-xs text-neutral-400">
                              {formatDateSafe(loan.createdAt?.toDate?.() || loan.createdAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold text-neutral-900 text-sm">
                              {loan.customer?.fullName || 'N/A'}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {loan.customer?.id || 'No customer'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-neutral-900">
                            {formatCurrency(principal, 'ZMW')}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            Principal
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-[#22C55E]">
                            {formatCurrency(totalPayable, 'ZMW')}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            {formatCurrency(loan.financials?.totalInterest || 0, 'ZMW')} interest
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-[#FACC15]">
                            {formatCurrency(totalPaid, 'ZMW')}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            {paymentProgress.toFixed(1)}% paid
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-[#EF4444]">
                            {formatCurrency(remainingBalance, 'ZMW')}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            Outstanding
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <div className="font-semibold text-[#006BFF]">
                              {formatCurrency(expectedProfit, 'ZMW')}
                            </div>
                            <div className="text-xs text-[#22C55E]">
                              Earned: {formatCurrency(profitEarned, 'ZMW')}
                            </div>
                            <div className="text-xs text-neutral-500">
                              Margin: {loan.financials?.profitMargin?.toFixed(1) || '0'}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {marketPrice > 0 ? (
                            <div>
                              <div className="font-semibold text-[#8B5CF6]">
                                {formatCurrency(marketPrice, 'ZMW')}
                              </div>
                              <div className="text-xs text-neutral-500 mt-1">
                                {loan.collateral?.length || 0} item(s)
                              </div>
                            </div>
                          ) : (
                            <div className="text-neutral-400 text-sm">No collateral</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="w-24 bg-neutral-200 rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all",
                                  paymentProgress >= 100 
                                    ? "bg-[#22C55E]" 
                                    : paymentProgress >= 50 
                                    ? "bg-[#FACC15]" 
                                    : "bg-[#EF4444]"
                                )}
                                style={{ width: `${Math.min(100, paymentProgress)}%` }}
                              />
                            </div>
                            <div className="text-xs text-neutral-600">
                              {paymentProgress.toFixed(1)}% complete
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(loan.status)}</TableCell>
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
                    );
                  })}
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

