import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Send,
  Edit,
  DollarSign,
  FileText,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';

export function BulkOperationsPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('active');
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState<string>('');
  const [bulkPaymentDate, setBulkPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch loans
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((loan: any) => !loan.deleted);
    },
    enabled: !!profile?.agency_id,
  });

  // Fetch customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  // Bulk status update
  const bulkStatusUpdate = useMutation({
    mutationFn: async (loanIds: string[]) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      
      const batch = writeBatch(db);
      loanIds.forEach(loanId => {
        const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
        batch.update(loanRef, {
          status: bulkStatus,
          updatedAt: serverTimestamp(),
        });
      });
      
      await batch.commit();
      
      // Create audit logs
      for (const loanId of loanIds) {
        await createAuditLog(profile.agency_id, {
          actorId: user?.id || 'system',
          action: 'bulk_status_update',
          targetCollection: 'loans',
          targetId: loanId,
          metadata: { newStatus: bulkStatus, bulkOperation: true },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success(`Updated ${selectedLoans.size} loan(s) status to ${bulkStatus}`);
      setSelectedLoans(new Set());
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update loans');
    },
  });

  // Bulk payment recording
  const bulkPaymentRecord = useMutation({
    mutationFn: async (loanIds: string[]) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      if (!bulkPaymentAmount) throw new Error('Payment amount is required');
      
      const amount = parseFloat(bulkPaymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid payment amount');
      
      const batch = writeBatch(db);
      const paymentDate = new Date(bulkPaymentDate);
      
      for (const loanId of loanIds) {
        // Get loan to find next repayment
        const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
        const loanSnap = await getDocs(collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments'));
        
        // Find next pending repayment
        const repayments = loanSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status === 'pending')
          .sort((a: any, b: any) => {
            const aDate = a.dueDate?.toDate?.() || new Date(a.dueDate);
            const bDate = b.dueDate?.toDate?.() || new Date(b.dueDate);
            return aDate.getTime() - bDate.getTime();
          });
        
        if (repayments.length > 0) {
          const repayment = repayments[0];
          const repaymentRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments', repayment.id);
          
          const amountPaid = (repayment.amountPaid || 0) + amount;
          const isFullyPaid = amountPaid >= repayment.amountDue;
          
          batch.update(repaymentRef, {
            amountPaid,
            status: isFullyPaid ? 'paid' : 'partial',
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      
      await batch.commit();
      
      // Create audit logs
      for (const loanId of loanIds) {
        await createAuditLog(profile.agency_id, {
          actorId: user?.id || 'system',
          action: 'bulk_payment_recorded',
          targetCollection: 'loans',
          targetId: loanId,
          metadata: { amount, paymentDate: bulkPaymentDate, bulkOperation: true },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success(`Recorded payments for ${selectedLoans.size} loan(s)`);
      setSelectedLoans(new Set());
      setBulkPaymentAmount('');
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payments');
    },
  });

  // CSV Import handler
  const handleCSVImport = async (file: File) => {
    setProcessing(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Parse CSV and create loans
      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());
          const loanData: any = {};
          
          headers.forEach((header, index) => {
            loanData[header] = values[index] || '';
          });
          
          // Create loan document
          const loanId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const loanRef = doc(db, 'agencies', profile!.agency_id, 'loans', loanId);
          
          batch.set(loanRef, {
            id: loanId,
            ...loanData,
            status: loanData.status || 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            deleted: false,
          });
          
          successCount++;
        } catch (error) {
          console.error(`Error processing row ${i}:`, error);
          errorCount++;
        }
      }
      
      await batch.commit();
      toast.success(`Imported ${successCount} loan(s). ${errorCount} error(s).`);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    } catch (error: any) {
      toast.error(`CSV import failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleLoanSelection = (loanId: string) => {
    const newSelection = new Set(selectedLoans);
    if (newSelection.has(loanId)) {
      newSelection.delete(loanId);
    } else {
      newSelection.add(loanId);
    }
    setSelectedLoans(newSelection);
  };

  const toggleAllLoans = () => {
    if (selectedLoans.size === loans?.length) {
      setSelectedLoans(new Set());
    } else {
      setSelectedLoans(new Set(loans?.map((l: any) => l.id) || []));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-[#006BFF]" />
          Bulk Operations
        </h1>
        <p className="text-neutral-600 mt-2">Perform bulk actions on loans and customers</p>
      </div>

      <Tabs defaultValue="loans" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="loans">Bulk Loans</TabsTrigger>
          <TabsTrigger value="payments">Bulk Payments</TabsTrigger>
          <TabsTrigger value="import">CSV Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Bulk Loans Operations */}
        <TabsContent value="loans" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Status Update</CardTitle>
              <CardDescription>Select loans and update their status in bulk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="bulkStatus">New Status:</Label>
                <select
                  id="bulkStatus"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active</option>
                  <option value="settled">Settled</option>
                  <option value="defaulted">Defaulted</option>
                </select>
                <Button
                  onClick={() => {
                    if (selectedLoans.size === 0) {
                      toast.error('Please select at least one loan');
                      return;
                    }
                    bulkStatusUpdate.mutate(Array.from(selectedLoans));
                  }}
                  disabled={bulkStatusUpdate.isPending || selectedLoans.size === 0}
                >
                  {bulkStatusUpdate.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Update {selectedLoans.size} Loan(s)
                    </>
                  )}
                </Button>
              </div>

              {loansLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#006BFF]" />
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedLoans.size === loans?.length && loans.length > 0}
                            onCheckedChange={toggleAllLoans}
                          />
                        </TableHead>
                        <TableHead>Loan ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans?.map((loan: any) => (
                        <TableRow key={loan.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLoans.has(loan.id)}
                              onCheckedChange={() => toggleLoanSelection(loan.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{loan.id.substring(0, 12)}...</TableCell>
                          <TableCell>{loan.customerId?.substring(0, 8) || 'N/A'}...</TableCell>
                          <TableCell>{formatCurrency(Number(loan.amount || 0))}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              loan.status === 'active' ? 'bg-green-100 text-green-700' :
                              loan.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              loan.status === 'defaulted' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {loan.status || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>{formatDateSafe(loan.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Payments */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Payment Recording</CardTitle>
              <CardDescription>Record payments for multiple loans at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    value={bulkPaymentAmount}
                    onChange={(e) => setBulkPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={bulkPaymentDate}
                    onChange={(e) => setBulkPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  if (selectedLoans.size === 0) {
                    toast.error('Please select at least one loan');
                    return;
                  }
                  if (!bulkPaymentAmount) {
                    toast.error('Please enter payment amount');
                    return;
                  }
                  bulkPaymentRecord.mutate(Array.from(selectedLoans));
                }}
                disabled={bulkPaymentRecord.isPending || selectedLoans.size === 0}
                className="w-full"
              >
                {bulkPaymentRecord.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording Payments...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Record Payment for {selectedLoans.size} Loan(s)
                  </>
                )}
              </Button>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLoans.size === loans?.length && loans.length > 0}
                          onCheckedChange={toggleAllLoans}
                        />
                      </TableHead>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans?.map((loan: any) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLoans.has(loan.id)}
                            onCheckedChange={() => toggleLoanSelection(loan.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{loan.id.substring(0, 12)}...</TableCell>
                        <TableCell>{formatCurrency(Number(loan.amount || 0))}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            loan.status === 'active' ? 'bg-green-100 text-green-700' :
                            loan.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {loan.status || 'N/A'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Import */}
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Loans from CSV</CardTitle>
              <CardDescription>Upload a CSV file to bulk import loans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                <p className="text-sm text-neutral-600 mb-4">
                  Upload a CSV file with loan data
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCSVImport(file);
                  }}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose CSV File
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">CSV Format:</h4>
                <p className="text-sm text-blue-800">
                  Required columns: customerId, amount, interestRate, durationMonths, loanType, status
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Export loans, customers, or other data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (loans && loans.length > 0) {
                      const csv = [
                        ['Loan ID', 'Customer ID', 'Amount', 'Status', 'Created'],
                        ...loans.map((loan: any) => [
                          loan.id,
                          loan.customerId || '',
                          loan.amount || 0,
                          loan.status || '',
                          loan.createdAt ? new Date(loan.createdAt).toISOString() : '',
                        ]),
                      ].map(row => row.join(',')).join('\n');
                      
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `loans-export-${Date.now()}.csv`;
                      a.click();
                      toast.success('Loans exported successfully');
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Loans
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (customers && customers.length > 0) {
                      const csv = [
                        ['Customer ID', 'Name', 'Email', 'Phone', 'NRC'],
                        ...customers.map((cust: any) => [
                          cust.id,
                          cust.fullName || cust.name || '',
                          cust.email || '',
                          cust.phone || '',
                          cust.nrcNumber || cust.nrc || '',
                        ]),
                      ].map(row => row.join(',')).join('\n');
                      
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `customers-export-${Date.now()}.csv`;
                      a.click();
                      toast.success('Customers exported successfully');
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Customers
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    // Export all data
                    const allData = {
                      loans: loans || [],
                      customers: customers || [],
                      exportedAt: new Date().toISOString(),
                    };
                    
                    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `full-export-${Date.now()}.json`;
                    a.click();
                    toast.success('Full data exported successfully');
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

