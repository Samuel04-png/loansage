import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Upload, Download, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportLoans, exportCustomers, exportEmployees } from '../../../lib/data-export';
import { importCustomersFromCSV, importLoansFromCSV, findCustomerByIdentifier } from '../../../lib/data-import';
import { createCustomer } from '../../../lib/firebase/firestore-helpers';
import { createLoanTransaction } from '../../../lib/firebase/loan-transactions';

export function DataManagementPage() {
  const { profile, user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'customers' | 'loans' | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Data Management</h2>
        <p className="text-slate-600">Import and export your data</p>
      </div>

      {/* Export Section */}
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
              <Download className="w-8 h-8 mb-2 text-primary-600" />
              <span className="font-semibold">Export Loans</span>
              <span className="text-xs text-slate-500 mt-1">
                {loans?.length || 0} loans
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col py-6"
              onClick={() => handleExport('customers')}
              disabled={!customers || customers.length === 0}
            >
              <Download className="w-8 h-8 mb-2 text-primary-600" />
              <span className="font-semibold">Export Customers</span>
              <span className="text-xs text-slate-500 mt-1">
                {customers?.length || 0} customers
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col py-6"
              onClick={() => handleExport('employees')}
              disabled={!employees || employees.length === 0}
            >
              <Download className="w-8 h-8 mb-2 text-primary-600" />
              <span className="font-semibold">Export Employees</span>
              <span className="text-xs text-slate-500 mt-1">
                {employees?.length || 0} employees
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>Import customers or loans from CSV files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Select file to import</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
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
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
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
                    <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
                      View errors ({importResult.errors.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
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

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">CSV Format Requirements</p>
                <p className="mb-2">For Customers: Full Name, Email, Phone, NRC/ID, Address, Employer</p>
                <p>For Loans: Customer Name (or ID), Amount, Interest Rate, Duration (Months), Loan Type, Disbursement Date</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

