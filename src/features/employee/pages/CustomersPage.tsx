import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { Search, Users, Loader2, UserPlus, Edit, Trash2, MoreVertical } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { EditCustomerDrawer } from '../components/EditCustomerDrawer';
import { deleteCustomer } from '../../../lib/firebase/customer-helpers';
import toast from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export function EmployeeCustomersPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Find employee by user ID
  const { data: employee } = useQuery({
    queryKey: ['employee-by-user', user?.id, profile?.agency_id],
    queryFn: async () => {
      if (!user?.id || !profile?.agency_id) return null;

      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const q = firestoreQuery(employeesRef, where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },
    enabled: !!user?.id && !!profile?.agency_id,
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['employee-customers', employee?.id, profile?.agency_id],
    queryFn: async () => {
      if (!employee?.id || !profile?.agency_id) return [];

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const q = firestoreQuery(
        customersRef,
        where('officerId', '==', user?.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    },
    enabled: !!employee?.id && !!profile?.agency_id,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Not authenticated');
      }
      await deleteCustomer(profile.agency_id, customerId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-customers'] });
      toast.success('Customer deleted successfully');
      setDeleteCustomerId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const filteredCustomers = customers?.filter((cust: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cust.fullName?.toLowerCase().includes(search) ||
      cust.name?.toLowerCase().includes(search) ||
      cust.customerId?.toLowerCase().includes(search) ||
      cust.id?.toLowerCase().includes(search) ||
      cust.nrcNumber?.toLowerCase().includes(search) ||
      cust.nrc?.toLowerCase().includes(search) ||
      cust.email?.toLowerCase().includes(search) ||
      cust.phone?.toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Customers</h2>
          <p className="text-slate-600">Manage your assigned customers</p>
        </div>
        <Button onClick={() => setAddCustomerOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 dark:text-neutral-300 uppercase bg-slate-50 dark:bg-neutral-800/50 border-b border-slate-100 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">NRC</th>
                    <th className="px-6 py-3">Risk Score</th>
                    <th className="px-6 py-3">KYC Status</th>
                    <th className="px-6 py-3">Assigned</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust: any) => (
                    <tr
                      key={cust.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-slate-600">
                              {cust?.fullName?.charAt(0) || cust?.name?.charAt(0) || 'C'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {cust?.fullName || cust?.name || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">{cust?.email || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{cust?.customerId || cust?.id || '-'}</td>
                      <td className="px-6 py-4">{cust?.nrcNumber || cust?.nrc || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full mr-2 ${
                              (cust?.riskScore || 50) >= 80
                                ? 'bg-emerald-500'
                                : (cust?.riskScore || 50) >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          ></div>
                          <span className="font-medium">{cust?.riskScore || 50}/100</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cust?.kycStatus === 'verified' || cust?.kycVerified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : cust?.kycStatus === 'pending' ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDateSafe(cust?.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setEditCustomerOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteCustomerId(cust.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-12 h-12 mx-auto text-muted-foreground" />}
              title="No customers found"
              description={searchTerm 
                ? "No customers match your search criteria. Try adjusting your search."
                : "You don't have any customers assigned to you yet. Customers will appear here once they're assigned."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Add Customer Drawer */}
      <AddCustomerDrawer
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employee-customers'] });
        }}
      />

      {/* Edit Customer Drawer */}
      <EditCustomerDrawer
        open={editCustomerOpen}
        onOpenChange={setEditCustomerOpen}
        customerId={selectedCustomerId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employee-customers'] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCustomerId} onOpenChange={(open) => !open && setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone.
              The customer will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCustomerId) {
                  deleteCustomerMutation.mutate(deleteCustomerId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
