import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Plus, Search, ChevronRight, Loader2, Users, Download, Upload } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { exportCustomers } from '../../../lib/data-export';
import { importCustomersFromCSV } from '../../../lib/data-import';
import { createCustomer } from '../../../lib/firebase/firestore-helpers';
import toast from 'react-hot-toast';

export function CustomersPage() {
  const { profile, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [addCustomerDrawerOpen, setAddCustomerDrawerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  const filteredCustomers = customers?.filter((cust: any) =>
    cust.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cust.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cust.nrc?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
          <p className="text-slate-600">Manage your agency customers</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (customers && customers.length > 0) {
                exportCustomers(customers);
                toast.success('Customers exported successfully');
              } else {
                toast.error('No customers to export');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !profile?.agency_id || !user?.id) return;
                
                setImporting(true);
                try {
                  const result = await importCustomersFromCSV(
                    file,
                    profile.agency_id,
                    user.id,
                    async (agencyId, data) => {
                      await createCustomer(agencyId, data);
                    }
                  );
                  
                  if (result.success > 0) {
                    toast.success(`Successfully imported ${result.success} customers`);
                  }
                  if (result.failed > 0) {
                    toast.error(`Failed to import ${result.failed} customers`);
                  }
                  refetch();
                } catch (error: any) {
                  toast.error(error.message || 'Failed to import customers');
                } finally {
                  setImporting(false);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
          <Button onClick={() => setAddCustomerDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by name, ID, or NRC..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">NRC</th>
                    <th className="px-6 py-3">Risk Score</th>
                    <th className="px-6 py-3">KYC Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust: any) => (
                    <tr
                      key={cust.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-slate-600">
                              {cust.fullName?.charAt(0) || 'C'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {cust.fullName || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">{cust.email || cust.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{cust.id}</td>
                      <td className="px-6 py-4">{cust.nrc || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full mr-2 bg-emerald-500"></div>
                          <span className="font-medium">-</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cust.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="warning">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/admin/customers/${cust.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No customers found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCustomerDrawer
        open={addCustomerDrawerOpen}
        onOpenChange={setAddCustomerDrawerOpen}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}

