import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { Upload, Download, FileText, Loader2, CheckCircle2, XCircle, AlertCircle, Sparkles, History, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { exportLoans, exportCustomers, exportEmployees } from '../../../lib/data-export';
import { importCustomersFromCSV, importLoansFromCSV, findCustomerByIdentifier } from '../../../lib/data-import';
import { createCustomer } from '../../../lib/firebase/firestore-helpers';
import { createLoanTransaction } from '../../../lib/firebase/loan-transactions';
import { BulkImportWizard } from '../components/BulkImportWizard';
import { getImportHistory } from '../../../lib/data-import/bulk-import-service';
import { syncAllCustomerStats } from '../../../lib/firebase/customer-stats-sync';

export function DataManagementPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'customers' | 'loans' | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [syncingStats, setSyncingStats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data for export
  const { data: loans } = useQuery({
    queryKey: ['all-loans-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  const { data: customers } = useQuery({
    queryKey: ['all-customers-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  const { data: employees } = useQuery({
    queryKey: ['all-employees-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const snapshot = await getDocs(employeesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  const handleExport = (type: 'loans' | 'customers' | 'employees') => {
    if (type === 'loans' && loans) {
      exportLoans(loans);
      toast.success('Loans exported successfully');
    } else if (type === 'customers' && customers) {
      exportCustomers(customers);
      toast.success('Customers exported successfully');
    } else if (type === 'employees' && employees) {
      exportEmployees(employees);
      toast.success('Employees exported successfully');
    } else {
      toast.error('No data available to export');
    }
  };

  const handleImport = async (type: 'customers' | 'loans') => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!profile?.agency_id || !user?.id) {
      toast.error('Agency information not available');
      return;
    }

    setImporting(true);
    setImportType(type);
    setImportResult(null);

    try {
      if (type === 'customers') {
        const result = await importCustomersFromCSV(
          file,
          profile.agency_id,
          user.id,
          async (agencyId, data) => {
            await createCustomer(agencyId, data);
          }
        );
        setImportResult(result);
        
        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} customers`);
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} customers`);
        }
      } else if (type === 'loans') {
        const result = await importLoansFromCSV(
          file,
          profile.agency_id,
          user.id,
          async (agencyId, data) => {
            const loanResult = await createLoanTransaction({
              agencyId,
              customerId: data.customerId,
              officerId: data.officerId,
              amount: data.amount,
              interestRate: data.interestRate,
              durationMonths: data.durationMonths,
              loanType: data.loanType,
              disbursementDate: data.disbursementDate,
            });
            if (!loanResult.success) {
              throw new Error(loanResult.error || 'Failed to create loan');
            }
          },
          findCustomerByIdentifier
        );
        setImportResult(result);
        
        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} loans`);
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} loans`);
        }
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import data');
      setImportResult({ success: 0, failed: 0, errors: [error.message || 'Unknown error'] });
    } finally {
      setImporting(false);
    }
  };

  // Fetch import history
  const { data: importHistory } = useQuery({
    queryKey: ['import-history', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      return await getImportHistory(profile.agency_id, 10);
    },
    enabled: !!profile?.agency_id,
  });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Data Management</h1>
        <p className="helper-text">Import and export your data with smart assistance</p>
      </motion.div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Bulk Import
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Bulk Import */}
        <TabsContent value="import">
          <Card className="border-2 border-neutral-200 dark:border-neutral-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#006BFF]" />
                Bulk Import
              </CardTitle>
              <CardDescription>
                Import customers and loans from Excel or CSV files with intelligent column mapping, data cleaning, and match suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BulkImportWizard
                onComplete={() => {
                  toast.success('Import completed successfully!');
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Section */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Download your data as CSV files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col py-6"
                  onClick={() => handleExport('loans')}
                  disabled={!loans || loans.length === 0}
                >
                  <Download className="w-8 h-8 mb-2 text-[#006BFF]" />
                  <span className="font-semibold">Export Loans</span>
                  <span className="text-xs text-neutral-500 mt-1">
                    {loans?.length || 0} loans
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto flex-col py-6"
                  onClick={() => handleExport('customers')}
                  disabled={!customers || customers.length === 0}
                >
                  <Download className="w-8 h-8 mb-2 text-[#006BFF]" />
                  <span className="font-semibold">Export Customers</span>
                  <span className="text-xs text-neutral-500 mt-1">
                    {customers?.length || 0} customers
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto flex-col py-6"
                  onClick={() => handleExport('employees')}
                  disabled={!employees || employees.length === 0}
                >
                  <Download className="w-8 h-8 mb-2 text-[#006BFF]" />
                  <span className="font-semibold">Export Employees</span>
                  <span className="text-xs text-neutral-500 mt-1">
                    {employees?.length || 0} employees
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Legacy Import (Simple) */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Simple Import (Legacy)</CardTitle>
              <CardDescription>Quick import with basic mapping</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Select file to import</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-neutral-800 dark:file:text-neutral-300"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleImport('customers')}
                  disabled={importing}
                  variant="outline"
                >
                  {importing && importType === 'customers' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Customers
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleImport('loans')}
                  disabled={importing}
                  variant="outline"
                >
                  {importing && importType === 'loans' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Loans
                    </>
                  )}
                </Button>
              </div>

              {importResult && (
                <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.success > 0 && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {importResult.failed > 0 && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-semibold">Import Results</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-emerald-600">✓ Successfully imported: {importResult.success}</p>
                    {importResult.failed > 0 && (
                      <p className="text-red-600">✗ Failed: {importResult.failed}</p>
                    )}
                    {importResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                          View errors ({importResult.errors.length})
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400 list-disc list-inside">
                          {importResult.errors.slice(0, 10).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {importResult.errors.length > 10 && (
                            <li>... and {importResult.errors.length - 10} more errors</li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair/Sync Tools */}
          <Card className="mt-6 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-5 h-5" />
                Data Repair Tools
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                Fix data inconsistencies and sync customer statistics with actual loan data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Sync Customer Stats
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Recalculates and updates customer statistics (Total Loans, Active Loans, Total Borrowed) 
                  from actual loan data. Use this if customer profiles show incorrect loan counts.
                </p>
                <Button
                  onClick={async () => {
                    if (!profile?.agency_id) {
                      toast.error('Agency ID not found');
                      return;
                    }

                    setSyncingStats(true);
                    try {
                      const result = await syncAllCustomerStats(profile.agency_id);
                      
                      if (result.success) {
                        toast.success(
                          `Stats sync completed! ${result.customersUpdated} customers updated, ${result.customersSkipped} skipped.`,
                          { duration: 5000 }
                        );
                        // Invalidate queries to refresh UI
                        queryClient.invalidateQueries({ queryKey: ['customers'] });
                        queryClient.invalidateQueries({ queryKey: ['all-customers-export'] });
                      } else {
                        toast.error(`Sync failed: ${result.errors.join(', ')}`);
                      }
                    } catch (error: any) {
                      console.error('Error syncing customer stats:', error);
                      toast.error(error.message || 'Failed to sync customer stats');
                    } finally {
                      setSyncingStats(false);
                    }
                  }}
                  disabled={syncingStats || !profile?.agency_id}
                  variant="outline"
                  className="w-full"
                >
                  {syncingStats ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing Customer Stats...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Customer Stats
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Fix Ghost Customers
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Updates all customers missing required fields (agencyId, status) to make them visible 
                  in the Customers table. This fixes customers that appear in dropdowns but not in the main list.
                </p>
                <Button
                  onClick={async () => {
                    if (!profile?.agency_id) {
                      toast.error('Agency ID not found');
                      return;
                    }

                    if (!confirm(
                      'This will update all customers missing required fields. Continue?'
                    )) {
                      return;
                    }

                    setSyncingStats(true);
                    try {
                      const { collection, getDocs, doc, updateDoc, serverTimestamp, writeBatch } = await import('firebase/firestore');
                      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
                      const snapshot = await getDocs(customersRef);
                      
                      const customers = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                      }));

                      // Find customers missing required fields
                      const customersToFix = customers.filter((customer: any) => 
                        !customer.status || !customer.agencyId || customer.totalLoans === undefined
                      );

                      if (customersToFix.length === 0) {
                        toast.success('All customers are properly configured!');
                        setSyncingStats(false);
                        return;
                      }

                      // Update in batches (Firestore batch limit is 500)
                      const batchSize = 400;
                      let totalUpdated = 0;
                      
                      for (let i = 0; i < customersToFix.length; i += batchSize) {
                        const batch = writeBatch(db);
                        const batchCustomers = customersToFix.slice(i, i + batchSize);
                        
                        for (const customer of batchCustomers) {
                          const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customer.id);
                          const updates: any = {
                            updatedAt: serverTimestamp(),
                          };
                          
                          if (!customer.agencyId) {
                            updates.agencyId = profile.agency_id;
                          }
                          if (!customer.status) {
                            updates.status = 'active';
                          }
                          if (customer.totalLoans === undefined || customer.totalLoans === null) {
                            updates.totalLoans = 0;
                            updates.activeLoans = 0;
                            updates.totalBorrowed = 0;
                          }
                          
                          batch.update(customerRef, updates);
                        }
                        
                        await batch.commit();
                        totalUpdated += batchCustomers.length;
                      }

                      toast.success(`Fixed ${totalUpdated} ghost customers! They should now appear in the Customers table.`);
                      
                      // Invalidate queries to refresh UI
                      queryClient.invalidateQueries({ queryKey: ['customers'] });
                      queryClient.invalidateQueries({ queryKey: ['all-customers-export'] });
                    } catch (error: any) {
                      console.error('Error fixing ghost customers:', error);
                      toast.error(error.message || 'Failed to fix ghost customers');
                    } finally {
                      setSyncingStats(false);
                    }
                  }}
                  disabled={syncingStats || !profile?.agency_id}
                  variant="outline"
                  className="w-full"
                >
                  {syncingStats ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fixing Ghost Customers...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Fix Ghost Customers
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>View past import operations and their results</CardDescription>
            </CardHeader>
            <CardContent>
              {importHistory && importHistory.length > 0 ? (
                <div className="space-y-4">
                  {importHistory.map((importLog: any) => (
                    <div
                      key={importLog.id}
                      className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {importLog.fileName}
                        </div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {importLog.timestamp?.toDate?.()?.toLocaleString() || 'Unknown date'}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-neutral-600 dark:text-neutral-400">Success</div>
                          <div className="font-semibold text-emerald-600">
                            {importLog.result?.success || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-600 dark:text-neutral-400">Failed</div>
                          <div className="font-semibold text-red-600">
                            {importLog.result?.failed || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-600 dark:text-neutral-400">Created</div>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {importLog.result?.created?.customers || 0} customers, {importLog.result?.created?.loans || 0} loans
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-600 dark:text-neutral-400">File Size</div>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {(importLog.fileSize / 1024).toFixed(2)} KB
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-600 dark:text-neutral-400">
                  No import history yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

