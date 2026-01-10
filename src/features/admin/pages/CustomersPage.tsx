import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, writeBatch, query as firestoreQuery, where } from 'firebase/firestore';
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
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';
import { Plus, Search, ChevronRight, Loader2, Users, Download, Upload, MoreVertical, Trash2, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { EditCustomerDrawer } from '../components/EditCustomerDrawer';
import { exportCustomers } from '../../../lib/data-export';
import { importCustomersFromCSV } from '../../../lib/data-import';
import { createCustomer, updateCustomer } from '../../../lib/firebase/firestore-helpers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../../../components/ui/dropdown-menu';
import { TableCard, TableCardRow } from '../../../components/ui/responsive-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Breadcrumbs } from '../../../components/ui/breadcrumbs';
import { Edit, Archive, Trash2, Eye } from 'lucide-react';
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

export function CustomersPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [addCustomerDrawerOpen, setAddCustomerDrawerOpen] = useState(false);
  const [editCustomerDrawerOpen, setEditCustomerDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [customerToArchive, setCustomerToArchive] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const { query: firestoreQuery, where } = await import('firebase/firestore');
      // Filter out archived customers
      const q = firestoreQuery(customersRef, where('status', '!=', 'archived'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id,
  });

  // Archive customer mutation
  const archiveCustomer = useMutation({
    mutationFn: async (customerId: string) => {
      if (!profile?.agency_id || !user?.id) throw new Error('Not authenticated');
      
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
      await updateDoc(customerRef, {
        status: 'archived',
        archivedAt: serverTimestamp(),
        archivedBy: user.id,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer archived successfully');
      setArchiveDialogOpen(false);
      setCustomerToArchive(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to archive customer');
    },
  });

  // Check if customer has active loans
  const checkCustomerHasActiveLoans = async (customerId: string): Promise<boolean> => {
    if (!profile?.agency_id) return false;
    
    try {
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const q = firestoreQuery(
        loansRef,
        where('customerId', '==', customerId),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.length > 0;
    } catch (error) {
      console.error('Error checking customer loans:', error);
      return false;
    }
  };

  // Single customer delete mutation
  const deleteCustomer = useMutation({
    mutationFn: async (customerId: string) => {
      if (!profile?.agency_id) throw new Error('Not authenticated');
      
      // Check for active loans
      const hasActiveLoans = await checkCustomerHasActiveLoans(customerId);
      if (hasActiveLoans) {
        throw new Error('Cannot delete customer with active loans');
      }

      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
      await deleteDoc(customerRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted successfully');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  // Bulk customer delete mutation
  const bulkDeleteCustomers = useMutation({
    mutationFn: async (customerIds: string[]) => {
      if (!profile?.agency_id) throw new Error('Not authenticated');
      
      const batch = writeBatch(db);
      let deleted = 0;
      let skipped = 0;

      for (const customerId of customerIds) {
        const hasActiveLoans = await checkCustomerHasActiveLoans(customerId);
        if (!hasActiveLoans) {
          const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customerId);
          batch.delete(customerRef);
          deleted++;
        } else {
          skipped++;
        }
      }

      await batch.commit();
      return { deleted, skipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomerIds(new Set());
      setBulkDeleteDialogOpen(false);
      
      if (result.skipped > 0) {
        toast.success(
          `Successfully deleted ${result.deleted} customer${result.deleted !== 1 ? 's' : ''}. Skipped ${result.skipped} due to active loans.`
        );
      } else {
        toast.success(`Successfully deleted ${result.deleted} customer${result.deleted !== 1 ? 's' : ''}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customers');
    },
  });

  const filteredCustomers = customers?.filter((cust: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cust.fullName?.toLowerCase().includes(search) ||
      cust.name?.toLowerCase().includes(search) ||
      cust.id?.toLowerCase().includes(search) ||
      cust.customerId?.toLowerCase().includes(search) ||
      cust.nrc?.toLowerCase().includes(search) ||
      cust.nrcNumber?.toLowerCase().includes(search) ||
      cust.email?.toLowerCase().includes(search) ||
      cust.phone?.toLowerCase().includes(search)
    );
  }) || [];

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'C';
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs />
      
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Customers</h1>
          <p className="helper-text">Manage your agency customers</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
            className="rounded-xl border-neutral-200 hover:bg-neutral-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
              className="rounded-xl border-neutral-200 hover:bg-neutral-50"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
          <Button 
            onClick={() => setAddCustomerDrawerOpen(true)}
            className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </motion.div>

      {/* Search and Table - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-white dark:bg-[#1E293B]">
          <CardHeader className="pb-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex flex-col gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search by name, ID, or NRC..."
                  className="pl-9 rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {selectedCustomerIds.size > 0 && (
                <div className="flex items-center justify-between gap-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      {selectedCustomerIds.size} customer{selectedCustomerIds.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCustomerIds(new Set())}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-500/20"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      disabled={bulkDeleteCustomers.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCustomers.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCustomerIds(new Set(filteredCustomers.map((c: any) => c.id)));
                              } else {
                                setSelectedCustomerIds(new Set());
                              }
                            }}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Customer</TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">ID</TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">NRC</TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Risk Score</TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Status</TableHead>
                        <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((cust: any, index: number) => (
                        <motion.tr
                          key={cust.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-neutral-100 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedCustomerIds.has(cust.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newSelection = new Set(selectedCustomerIds);
                                if (e.target.checked) {
                                  newSelection.add(cust.id);
                                } else {
                                  newSelection.delete(cust.id);
                                }
                                setSelectedCustomerIds(newSelection);
                              }}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <Link to={`/admin/customers/${cust.id}`} className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-neutral-200">
                                <AvatarImage src={cust.profilePhotoURL} />
                                <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-xs font-semibold">
                                  {getInitials(cust.fullName || 'Customer')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                  {cust.fullName || 'N/A'}
                                </div>
                                <div className="text-xs text-neutral-500">{cust.email || cust.phone}</div>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium text-neutral-700 dark:text-neutral-300">{cust.id}</TableCell>
                          <TableCell className="text-neutral-600 dark:text-neutral-400">{cust.nrc || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#22C55E]"></div>
                              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">-</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {cust.status === 'active' ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="warning">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link to={`/admin/customers/${cust.id}`} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedCustomer(cust);
                                    setEditCustomerDrawerOpen(true);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Customer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCustomerToDelete(cust);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="cursor-pointer text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCustomerToArchive(cust);
                                    setArchiveDialogOpen(true);
                                  }}
                                  className="cursor-pointer text-amber-600 focus:text-amber-600"
                                  disabled={cust.status === 'archived'}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  {cust.status === 'archived' ? 'Archived' : 'Archive'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  {filteredCustomers.map((cust: any, index: number) => (
                    <motion.div
                      key={cust.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <TableCard
                        onClick={() => window.location.href = `/admin/customers/${cust.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <Link 
                            to={`/admin/customers/${cust.id}`}
                            className="flex items-center gap-3 flex-1 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Avatar className="h-12 w-12 border-2 border-neutral-200 dark:border-neutral-700 flex-shrink-0">
                              <AvatarImage src={cust.profilePhotoURL} />
                              <AvatarFallback className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white text-sm font-semibold">
                                {getInitials(cust.fullName || 'Customer')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                {cust.fullName || 'N/A'}
                              </div>
                              <div className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                                {cust.email || cust.phone}
                              </div>
                            </div>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0">
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/customers/${cust.id}`} className="cursor-pointer">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomer(cust);
                                  setEditCustomerDrawerOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Customer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomerToArchive(cust);
                                  setArchiveDialogOpen(true);
                                }}
                                className="cursor-pointer text-amber-600 focus:text-amber-600"
                                disabled={cust.status === 'archived'}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                {cust.status === 'archived' ? 'Archived' : 'Archive'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="space-y-2 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                          <TableCardRow 
                            label="Customer ID" 
                            value={<span className="font-medium text-neutral-900 dark:text-neutral-100">{cust.id}</span>}
                          />
                          {cust.nrc && (
                            <TableCardRow 
                              label="NRC" 
                              value={<span className="text-neutral-600 dark:text-neutral-400">{cust.nrc}</span>}
                            />
                          )}
                          <TableCardRow 
                            label="Status" 
                            value={
                              cust.status === 'active' ? (
                                <Badge className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20">Active</Badge>
                              ) : (
                                <Badge className="bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20">Inactive</Badge>
                              )
                            }
                          />
                        </div>
                      </TableCard>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Users}
                title="No customers found"
                description={
                  searchTerm 
                    ? 'Try adjusting your search terms to find customers'
                    : 'Get started by adding your first customer to the system'
                }
                action={
                  !searchTerm ? {
                    label: 'Add Customer',
                    onClick: () => setAddCustomerDrawerOpen(true),
                    icon: Plus,
                  } : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AddCustomerDrawer
        open={addCustomerDrawerOpen}
        onOpenChange={setAddCustomerDrawerOpen}
        onSuccess={() => {
          refetch();
        }}
      />

      {editCustomerDrawerOpen && selectedCustomer && (
        <EditCustomerDrawer
          open={editCustomerDrawerOpen}
          onOpenChange={setEditCustomerDrawerOpen}
          customer={selectedCustomer}
          onSuccess={() => {
            refetch();
            setSelectedCustomer(null);
          }}
        />
      )}

      {/* Archive Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{customerToArchive?.fullName}</strong>? They will no longer appear in active customer lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveCustomer.mutate(customerToArchive.id)}
              disabled={archiveCustomer.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {archiveCustomer.isPending ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{customerToDelete?.fullName}</strong>? This action cannot be undone. All associated data will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCustomer.mutate(customerToDelete.id)}
              disabled={deleteCustomer.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCustomer.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Customers</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selectedCustomerIds.size} customer{selectedCustomerIds.size !== 1 ? 's' : ''}</strong>? 
              This action cannot be undone. Customers with active loans will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteCustomers.mutate(Array.from(selectedCustomerIds))}
              disabled={bulkDeleteCustomers.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteCustomers.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

