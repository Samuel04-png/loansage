import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, User, Download, FileSpreadsheet, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { calculateLoanFinancials } from '../../../lib/firebase/loan-calculations';

export function OutstandingBorrowersPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: borrowers = [], isLoading } = useQuery({
    queryKey: ['outstanding-borrowers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      // Get all active loans
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = query(loansRef, where('status', 'in', ['active', 'approved']));
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
          
          // Fetch repayments
          try {
            const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loan.id, 'repayments');
            const repaymentsSnapshot = await getDocs(repaymentsRef);
            loan.repayments = repaymentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            
            // Calculate outstanding balance
            const principal = Number(loan.amount || 0);
            const interestRate = Number(loan.interestRate || 0);
            const durationMonths = Number(loan.durationMonths || 0);
            
            let totalPayable = principal;
            if (principal > 0 && interestRate > 0 && durationMonths > 0) {
              const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
              totalPayable = financials.totalAmount;
            }
            
            const totalPaid = loan.repayments.reduce((sum: number, r: any) => 
              sum + Number(r.amountPaid || 0), 0);
            
            loan.outstandingBalance = Math.max(0, totalPayable - totalPaid);
            loan.totalPaid = totalPaid;
            loan.totalPayable = totalPayable;
          } catch (error) {
            loan.repayments = [];
            loan.outstandingBalance = Number(loan.amount || 0);
            loan.totalPaid = 0;
          }
          
          return loan;
        })
      );

      // Group by customer and calculate totals
      const customerMap = new Map();
      loans.forEach((loan: any) => {
        if (!loan.customerId) return;
        
        const customerId = loan.customerId;
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer: loan.customer,
            customerId,
            loans: [],
            totalOutstanding: 0,
            totalLoans: 0,
          });
        }
        
        const borrower = customerMap.get(customerId);
        borrower.loans.push(loan);
        borrower.totalOutstanding += loan.outstandingBalance || 0;
        borrower.totalLoans += 1;
      });

      return Array.from(customerMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    },
    enabled: !!profile?.agency_id,
  });

  const totalOutstanding = borrowers.reduce((sum: number, b: any) => sum + b.totalOutstanding, 0);
  const totalBorrowers = borrowers.length;

  const handleExport = async () => {
    try {
      // Flatten borrowers data for export
      const exportData = borrowers.flatMap((borrower: any) =>
        borrower.loans.map((loan: any) => ({
          'Customer Name': borrower.customer?.fullName || borrower.customer?.name || 'Unknown',
          'Loan Number': loan.loanNumber || loan.id,
          'Loan Amount': loan.amount || 0,
          'Outstanding Balance': loan.outstandingBalance || 0,
          'Total Paid': loan.totalPaid || 0,
          'Status': loan.status,
          'Interest Rate': loan.interestRate || 0,
          'Duration': loan.durationMonths || 0,
        }))
      );
      
      // Use existing export function
      const { exportLoans } = await import('../../../lib/data-export');
      await exportLoans(exportData, 'outstanding-borrowers');
      toast.success('Exported to Excel successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export');
    }
  };

  const filteredBorrowers = borrowers.filter((borrower: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      borrower.customer?.fullName?.toLowerCase().includes(search) ||
      borrower.customer?.name?.toLowerCase().includes(search) ||
      String(borrower.totalOutstanding || '').includes(search)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-[#006BFF]" />
            Outstanding Borrowers
          </h1>
          <p className="text-neutral-600 mt-2">View borrowers with outstanding loan balances</p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Total Borrowers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{totalBorrowers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-500">Average Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">
              {totalBorrowers > 0 ? formatCurrency(totalOutstanding / totalBorrowers) : formatCurrency(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Input
            placeholder="Search borrowers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            icon={Search}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-neutral-500">Loading borrowers...</div>
          ) : filteredBorrowers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No outstanding borrowers</h3>
              <p className="text-neutral-500">All loans have been fully paid</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBorrowers.map((borrower: any) => (
                <Card key={borrower.customerId} className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 text-lg">
                            {borrower.customer?.fullName || borrower.customer?.name || 'Unknown Customer'}
                          </h3>
                          <p className="text-sm text-neutral-500">
                            {borrower.totalLoans} active loan{borrower.totalLoans !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(borrower.totalOutstanding)}
                        </p>
                        <p className="text-xs text-neutral-500">Total Outstanding</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {borrower.loans.map((loan: any) => (
                        <div
                          key={loan.id}
                          className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-neutral-400" />
                            <div>
                              <p className="font-medium text-neutral-900">
                                {loan.loanNumber || `Loan #${loan.id.slice(0, 8)}`}
                              </p>
                              <p className="text-xs text-neutral-500">
                                Original: {formatCurrency(loan.amount || 0)} • 
                                Paid: {formatCurrency(loan.totalPaid || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-neutral-900">
                                {formatCurrency(loan.outstandingBalance || 0)}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {loan.status}
                              </Badge>
                            </div>
                            <Link 
                              to={`/admin/loans/${loan.id}`}
                              className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-10 md:h-9 px-3 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 transition-all duration-300"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

