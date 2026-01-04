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
import { Search, Users, Loader2, UserPlus, Edit, Trash2, MoreVertical, Eye, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateSafe, formatCurrency } from '../../../lib/utils';
import { StatusBadge } from '../../../components/ui/status-badge';
import { FilterChips } from '../../../components/ui/filter-chips';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { EditCustomerDrawer } from '../components/EditCustomerDrawer';
import { CustomerDetailsDrawer } from '../components/CustomerDetailsDrawer';
import { deleteCustomer } from '../../../lib/firebase/customer-helpers';
import toast from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

// Avatar color generator based on name
const getAvatarColor = (name: string): string => {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-cyan-500 to-blue-500',
    'from-fuchsia-500 to-pink-500',
  ];
  const index = name?.charCodeAt(0) % colors.length || 0;
  return colors[index];
};

export function EmployeeCustomersPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [viewCustomerOpen, setViewCustomerOpen] = useState(false);
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

  // UNIFIED DATA ACCESS: Show ALL agency customers (not just createdBy current user)
  // This ensures Admin-added customers are visible to Loan Officers and vice versa
  const { data: customers, isLoading } = useQuery({
    queryKey: ['employee-customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      try {
        const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
        // Query ALL customers in the agency - unified data access
        const q = firestoreQuery(
          customersRef,
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          // Add flag to indicate if current user created this customer
          isOwnCustomer: doc.data().createdBy === user?.id,
        }));
      } catch (error: any) {
        console.error('Error fetching agency customers:', error);
        // Fallback: get all customers without ordering
        try {
          const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
          const snapshot = await getDocs(customersRef);
          return snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
              isOwnCustomer: doc.data().createdBy === user?.id,
            }))
            .sort((a: any, b: any) => {
              const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
              const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime();
            });
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }
      }
    },
    enabled: !!profile?.agency_id,
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

  // Calculate status counts for filter chips
  const statusCounts = {
    all: customers?.length || 0,
    active: customers?.filter((c: any) => c.status === 'active').length || 0,
    inactive: customers?.filter((c: any) => c.status !== 'active').length || 0,
  };

  const filteredCustomers = customers?.filter((cust: any) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && cust.status !== 'active') return false;
      if (statusFilter === 'inactive' && cust.status === 'active') return false;
    }
    
    // Search filter
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

  const filterOptions = [
    { id: 'all', label: 'All', count: statusCounts.all },
    { id: 'active', label: 'Active', count: statusCounts.active },
    { id: 'inactive', label: 'Inactive', count: statusCounts.inactive },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Customers</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">View and manage all agency customers</p>
        </div>
        <Button 
          onClick={() => setAddCustomerOpen(true)}
          className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </motion.div>

      {/* Premium Control Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
          {/* Control Bar Header */}
          <div className="px-6 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Search Input */}
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input
                  placeholder="Search customers..."
                  className="pl-12 h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Filter Chips */}
              <FilterChips 
                options={filterOptions} 
                selected={statusFilter} 
                onChange={setStatusFilter}
              />
            </div>
          </div>
          {/* Table Content */}
          <div className="p-0">
          {isLoading ? (
            /* Premium Loading Skeleton */
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-5 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="hidden md:flex gap-8">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredCustomers.length > 0 ? (
            /* Premium Two-Line Table Layout */
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredCustomers.map((cust: any, index: number) => {
                const customerName = cust?.fullName || cust?.name || 'Unknown';
                const initials = customerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                const avatarColor = getAvatarColor(customerName);
                
                return (
                  <motion.div
                    key={cust.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15 }}
                    className="group px-6 py-5 hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer"
                    onClick={() => {
                      setSelectedCustomerId(cust.id);
                      setViewCustomerOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Column 1: Identity (Two-Line) */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Colored Initials Avatar */}
                        <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white dark:ring-neutral-800`}>
                          <span className="text-sm font-bold text-white tracking-tight">
                            {initials}
                          </span>
                        </div>
                        
                        {/* Name + Email (Two-Line) */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-slate-900 dark:text-neutral-100 font-semibold truncate text-[15px]">
                            {customerName}
                          </h3>
                          <p className="text-slate-500 dark:text-neutral-400 text-xs truncate mt-0.5">
                            {cust?.email || cust?.phone || 'No contact info'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Column 2: Financial Summary (Two-Line) - Hidden on mobile */}
                      <div className="hidden md:block w-28">
                        <p className="text-slate-900 dark:text-neutral-100 font-semibold text-sm">
                          {cust?.monthlyIncome ? formatCurrency(cust.monthlyIncome, 'ZMW') : '-'}
                        </p>
                        <p className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">
                          Monthly Income
                        </p>
                      </div>
                      
                      {/* Column 3: ID & NRC (Two-Line) - Hidden on mobile */}
                      <div className="hidden lg:block w-32">
                        <p className="text-slate-700 dark:text-neutral-300 font-mono text-sm truncate">
                          {cust?.nrc || cust?.nrcNumber || '-'}
                        </p>
                        <p className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">
                          NRC Number
                        </p>
                      </div>
                      
                      {/* Column 4: Risk Score (Two-Line) - Hidden on tablet */}
                      <div className="hidden xl:flex flex-col items-center w-20">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className={`w-4 h-4 ${
                            cust?.riskScore >= 80 ? 'text-emerald-500' : 
                            cust?.riskScore >= 60 ? 'text-amber-500' : 
                            cust?.riskScore != null ? 'text-rose-500' : 'text-slate-300'
                          }`} />
                          <span className="text-slate-900 dark:text-neutral-100 font-semibold text-sm">
                            {cust?.riskScore ?? '-'}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">
                          Risk Score
                        </p>
                      </div>
                      
                      {/* Column 5: Status Badge (Soft Pill) */}
                      <div className="w-24 flex justify-center">
                        <StatusBadge status={cust?.status || 'inactive'} />
                      </div>
                      
                      {/* Column 6: Actions Menu */}
                      <div 
                        className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-52 rounded-xl shadow-lg ring-1 ring-black/5"
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setViewCustomerOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomerId(cust.id);
                                setEditCustomerOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              destructive
                              onClick={() => setDeleteCustomerId(cust.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Premium Empty State */
            <div className="py-16 px-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-slate-100 to-neutral-100 dark:from-neutral-800 dark:to-slate-800 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-slate-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No customers found' : 'No customers yet'}
              </h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm max-w-md mx-auto mb-6">
                {searchTerm 
                  ? "No customers match your search criteria. Try adjusting your search or filters."
                  : "Start building your customer base by adding your first customer."
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button 
                  onClick={() => setAddCustomerOpen(true)}
                  className="bg-[#006BFF] hover:bg-[#0052CC] text-white rounded-xl"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add First Customer
                </Button>
              )}
            </div>
          )}
          </div>
        </Card>
      </motion.div>

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

      {/* View Customer Details Drawer */}
      <CustomerDetailsDrawer
        open={viewCustomerOpen}
        onOpenChange={setViewCustomerOpen}
        customerId={selectedCustomerId}
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
