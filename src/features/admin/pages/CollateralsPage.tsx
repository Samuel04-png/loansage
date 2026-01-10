import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, writeBatch, doc as firestoreDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
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
import { Search, Loader2, Download, FileText, Image as ImageIcon, Plus, DollarSign, TrendingUp, Shield, BarChart3, Clock, Trash2, CheckCircle2, X } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AddCollateralDrawer } from '../components/AddCollateralDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';

export function CollateralsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  // Fetch all collateral from top-level registry
  const { data: collaterals, isLoading } = useQuery({
    queryKey: ['collaterals', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      try {
        // Fetch from top-level collateral registry
        const collateralRef = collection(db, 'agencies', profile.agency_id, 'collateral');
        const collateralSnapshot = await getDocs(collateralRef);
        
        const allCollaterals = collateralSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Also fetch from loan subcollections for backward compatibility
        const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
        const loansSnapshot = await getDocs(loansRef);
        const loans = loansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch loan details for each collateral
        const collateralsWithLoanDetails = await Promise.all(
          allCollaterals.map(async (coll: any) => {
            if (coll.loanId) {
              try {
                const loanRef = firestoreDoc(db, 'agencies', profile.agency_id, 'loans', coll.loanId);
                const loanSnap = await getDoc(loanRef);
                if (loanSnap.exists()) {
                  const loanData = loanSnap.data();
                  coll.loan = { id: loanSnap.id, ...loanData } as any;
                  
                  // Calculate loan coverage ratio
                  const loanAmount = Number((coll.loan as any).amount || 0);
                  const collateralValue = Number(coll.estimatedValue || coll.value || 0);
                  coll.loanCoverageRatio = loanAmount > 0 ? (collateralValue / loanAmount) * 100 : 0;
                }
              } catch (error) {
                console.warn(`Failed to fetch loan for collateral ${coll.id}:`, error);
              }
            }
            return coll;
          })
        );

        for (const loan of loans) {
          try {
            const loanCollateralRef = collection(
              db,
              'agencies',
              profile.agency_id,
              'loans',
              loan.id,
              'collateral'
            );
            const loanCollateralSnapshot = await getDocs(loanCollateralRef);
            
            loanCollateralSnapshot.docs.forEach(docItem => {
              const existing = collateralsWithLoanDetails.find(c => c.id === docItem.id);
              if (!existing) {
                const collateralDocData = docItem.data();
                const collateralData: any = { id: docItem.id, loanId: loan.id, loan: loan as any, ...collateralDocData };
                const loanAmount = Number((loan as any).amount || 0);
                const collateralValue = Number(collateralData.estimatedValue || collateralData.value || 0);
                collateralData.loanCoverageRatio = loanAmount > 0 ? (collateralValue / loanAmount) * 100 : 0;
                collateralsWithLoanDetails.push(collateralData as any);
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch collateral for loan ${loan.id}:`, error);
          }
        }

        return collateralsWithLoanDetails;
      } catch (error) {
        console.error('Error fetching collaterals:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id,
  });

  const filteredCollaterals = collaterals?.filter((coll: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      coll.type?.toLowerCase().includes(search) ||
      coll.description?.toLowerCase().includes(search) ||
      coll.loanId?.toLowerCase().includes(search) ||
      coll.id?.toLowerCase().includes(search) ||
      coll.serialNumber?.toLowerCase().includes(search) ||
      coll.brand?.toLowerCase().includes(search) ||
      coll.model?.toLowerCase().includes(search) ||
      String(coll.estimatedValue || '').includes(search)
    );
  }) || [];

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCollaterals.map((c: any) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const isAllSelected = filteredCollaterals.length > 0 && selectedIds.size === filteredCollaterals.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredCollaterals.length;

  // Bulk verify mutation
  const bulkVerifyMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.agency_id) throw new Error('No agency ID');
      
      const batch = writeBatch(db);
      
      for (const id of ids) {
        // Try top-level registry first
        const registryRef = firestoreDoc(db, 'agencies', profile.agency_id, 'collateral', id);
        batch.update(registryRef, {
          verificationStatus: 'verified',
          status: 'VERIFIED',
          verifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      await batch.commit();
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} collateral(s) verified successfully`);
      setSelectedIds(new Set());
      setVerifyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['collaterals'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify collaterals');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile?.agency_id) throw new Error('No agency ID');
      
      const batch = writeBatch(db);
      
      for (const id of ids) {
        const registryRef = firestoreDoc(db, 'agencies', profile.agency_id, 'collateral', id);
        batch.delete(registryRef);
      }
      
      await batch.commit();
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} collateral(s) deleted successfully`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['collaterals'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete collaterals');
    },
  });

  // Export selected collaterals
  const exportSelectedCollaterals = () => {
    const selectedCollaterals = collaterals?.filter((c: any) => selectedIds.has(c.id)) || [];
    if (selectedCollaterals.length === 0) {
      toast.error('No collaterals selected');
      return;
    }
    exportCollateralsToCSV(selectedCollaterals);
    toast.success(`Exported ${selectedCollaterals.length} collateral(s)`);
  };

  const exportCollateralsToCSV = (data: any[]) => {
    const headers = [
      'Collateral ID',
      'Loan ID',
      'Type',
      'Description',
      'Estimated Value',
      'Currency',
      'Verification Status',
      'Created Date',
    ];

    const rows = data.map((coll: any) => ({
      'Collateral ID': coll.id,
      'Loan ID': coll.loanId || 'N/A',
      'Type': coll.type || 'N/A',
      'Description': coll.description || 'N/A',
      'Estimated Value': coll.estimatedValue || coll.value || 0,
      'Currency': coll.currency || 'ZMW',
      'Verification Status': coll.verificationStatus || coll.status || 'N/A',
      'Created Date': coll.createdAt?.toDate?.()?.toLocaleDateString() || coll.createdAt || 'N/A',
    }));

    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    rows.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    });
    
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `collaterals-export-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCollaterals = () => {
    if (!collaterals || collaterals.length === 0) {
      toast.error('No collaterals to export');
      return;
    }

    const headers = [
      'Collateral ID',
      'Loan ID',
      'Type',
      'Description',
      'Estimated Value',
      'Currency',
      'Verification Status',
      'Created Date',
    ];

    const data = collaterals.map((coll: any) => ({
      'Collateral ID': coll.id,
      'Loan ID': coll.loanId || 'N/A',
      'Type': coll.type || 'N/A',
      'Description': coll.description || 'N/A',
      'Estimated Value': coll.estimatedValue || coll.value || 0,
      'Currency': coll.currency || 'ZMW',
      'Verification Status': coll.verificationStatus || coll.status || 'N/A',
      'Created Date': coll.createdAt?.toDate?.()?.toLocaleDateString() || coll.createdAt || 'N/A',
    }));

    // Convert to CSV format manually since exportData is not exported
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    });
    
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `collaterals-export-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Collaterals exported successfully');
  };

  // Calculate summary statistics
  const totalValue = collaterals?.reduce((sum: number, c: any) => 
    sum + Number(c.estimatedValue || c.value || 0), 0) || 0;
  const verifiedCount = collaterals?.filter((c: any) => 
    c.verificationStatus === 'verified' || c.status === 'VERIFIED').length || 0;
  const pendingCount = collaterals?.filter((c: any) => 
    c.verificationStatus === 'pending' || c.status === 'PENDING').length || 0;
  const avgCoverageRatio = collaterals && collaterals.length > 0
    ? collaterals.reduce((sum: number, c: any) => sum + (c.loanCoverageRatio || 0), 0) / collaterals.length
    : 0;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div>
          <h1 className="page-title text-neutral-900 dark:text-neutral-100 mb-1">Collaterals</h1>
          <p className="helper-text">Manage all loan collaterals and their valuations</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={exportCollaterals} className="rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setAddDrawerOpen(true)} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Add Collateral
          </Button>
        </div>
      </motion.div>

      {/* Summary Statistics */}
      {collaterals && collaterals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Total Value
                  </p>
                  <p className="text-xl font-bold text-neutral-900">
                    {formatCurrency(totalValue, 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {collaterals.length} items
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
                    Verified
                  </p>
                  <p className="text-xl font-bold text-[#22C55E]">
                    {verifiedCount}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {collaterals.length > 0 ? ((verifiedCount / collaterals.length) * 100).toFixed(0) : 0}% verified
                  </p>
                </div>
                <div className="p-3 bg-[#22C55E]/10 rounded-lg">
                  <Shield className="w-6 h-6 text-[#22C55E]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Pending
                  </p>
                  <p className="text-xl font-bold text-[#FACC15]">
                    {pendingCount}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Awaiting verification
                  </p>
                </div>
                <div className="p-3 bg-[#FACC15]/10 rounded-lg">
                  <Clock className="w-6 h-6 text-[#FACC15]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Avg Coverage
                  </p>
                  <p className="text-xl font-bold text-[#8B5CF6]">
                    {avgCoverageRatio.toFixed(1)}%
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Loan coverage ratio
                  </p>
                </div>
                <div className="p-3 bg-[#8B5CF6]/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-[#8B5CF6]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 px-4 py-3">
              <div className="flex items-center gap-2 pr-3 border-r border-neutral-200">
                <span className="text-sm font-semibold text-[#006BFF]">{selectedIds.size}</span>
                <span className="text-sm text-neutral-600">selected</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSelectedCollaterals}
                className="rounded-lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerifyDialogOpen(true)}
                className="rounded-lg text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/10"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Verify Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="rounded-lg text-[#EF4444] border-[#EF4444]/30 hover:bg-[#EF4444]/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by type, description, or loan ID..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-16 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredCollaterals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all"
                        className={isPartiallySelected ? 'opacity-50' : ''}
                      />
                    </TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Collateral Details</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Loan Information</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Type & Specs</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Estimated Value</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Loan Amount</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Coverage Ratio</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Condition</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Location</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Status</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300">Created</TableHead>
                    <TableHead className="font-semibold text-neutral-700 dark:text-neutral-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollaterals.map((coll: any, index: number) => {
                    const collateralValue = Number(coll.estimatedValue || coll.value || 0);
                    const loanAmount = Number(coll.loan?.amount || 0);
                    const coverageRatio = coll.loanCoverageRatio || (loanAmount > 0 ? (collateralValue / loanAmount) * 100 : 0);

                    return (
                      <motion.tr
                        key={coll.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors",
                          selectedIds.has(coll.id) && "bg-[#006BFF]/5"
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(coll.id)}
                            onCheckedChange={(checked) => handleSelectOne(coll.id, !!checked)}
                            aria-label={`Select ${coll.description || coll.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {coll.photos && coll.photos.length > 0 ? (
                              <ImageIcon className="w-8 h-8 text-neutral-400" />
                            ) : (
                              <FileText className="w-8 h-8 text-neutral-400" />
                            )}
                            <div>
                              <div className="font-medium text-neutral-900 text-sm">
                                {coll.description?.substring(0, 40) || 'No description'}
                                {coll.description && coll.description.length > 40 ? '...' : ''}
                              </div>
                              <div className="text-xs text-neutral-500 font-mono mt-1">
                                {coll.id.substring(0, 12)}...
                              </div>
                              {coll.serialNumber && (
                                <div className="text-xs text-neutral-500 mt-1">
                                  SN: {coll.serialNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {coll.loanId ? (
                            <div>
                              <Link to={`/admin/loans/${coll.loanId}`}>
                                <div className="font-medium text-[#006BFF] hover:underline text-sm">
                                  {coll.loanId.substring(0, 12)}...
                                </div>
                              </Link>
                              {coll.loan?.customer && (
                                <div className="text-xs text-neutral-500 mt-1">
                                  {coll.loan.customer.fullName || 'N/A'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-sm">No loan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="capitalize font-medium text-neutral-900">
                              {coll.type?.replace('_', ' ') || 'N/A'}
                            </div>
                            {coll.brand && (
                              <div className="text-xs text-neutral-600">
                                {coll.brand} {coll.model || ''}
                              </div>
                            )}
                            {coll.year && (
                              <div className="text-xs text-neutral-500">
                                Year: {coll.year}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-neutral-900">
                            {formatCurrency(collateralValue, coll.currency || 'ZMW')}
                          </div>
                          {coll.marketValue && (
                            <div className="text-xs text-[#22C55E] mt-1">
                              Market: {formatCurrency(Number(coll.marketValue), coll.currency || 'ZMW')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {loanAmount > 0 ? (
                            <div className="font-semibold text-neutral-700">
                              {formatCurrency(loanAmount, 'ZMW')}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {coverageRatio > 0 ? (
                            <div>
                              <div className={cn(
                                "font-bold",
                                coverageRatio >= 150 ? "text-[#22C55E]" :
                                coverageRatio >= 100 ? "text-[#FACC15]" :
                                "text-[#EF4444]"
                              )}>
                                {coverageRatio.toFixed(1)}%
                              </div>
                              <div className="text-xs text-neutral-500 mt-1">
                                {coverageRatio >= 150 ? "Excellent" :
                                 coverageRatio >= 100 ? "Good" :
                                 "Low"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {coll.condition ? (
                            <Badge variant="outline" className="capitalize">
                              {coll.condition}
                            </Badge>
                          ) : (
                            <span className="text-neutral-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {coll.location ? (
                            <div className="text-sm text-neutral-700">
                              {coll.location}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = (coll.verificationStatus || coll.status || 'pending').toLowerCase();
                            const statusMap: Record<string, { label: string; className: string }> = {
                              'verified': { label: 'Verified', className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300' },
                              'in_custody': { label: 'In Custody', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300' },
                              'liquidated': { label: 'Liquidated', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300' },
                              'released': { label: 'Released', className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300' },
                              'pending': { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300' },
                              'pending_verification': { label: 'Pending Verification', className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300' },
                            };
                            const statusInfo = statusMap[status] || statusMap['pending'];
                            return (
                              <Badge variant="outline" className={cn('border', statusInfo.className)}>
                                {statusInfo.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-neutral-600 text-sm">
                          {formatDateSafe(coll.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {coll.loanId ? (
                            <Link to={`/admin/loans/${coll.loanId}/collateral/${coll.id}`}>
                              <Button variant="outline" size="sm" className="rounded-lg">
                                View Details
                              </Button>
                            </Link>
                          ) : (
                            <Link to={`/admin/collateral/${coll.id}`}>
                              <Button variant="outline" size="sm" className="rounded-lg">
                                View Details
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12">
              <EmptyState
                icon={<FileText />}
                title="No collaterals found"
                description={searchTerm 
                  ? "Try adjusting your search to find collaterals."
                  : "Start by adding collateral to secure your loans."}
                action={!searchTerm ? {
                  label: 'Add Collateral',
                  onClick: () => setAddDrawerOpen(true),
                } : undefined}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <AddCollateralDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['collaterals'] });
        }}
      />

      {/* Verify Confirmation Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Verify Selected Collaterals</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark {selectedIds.size} collateral(s) as verified?
              This will update their status to "Verified".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkVerifyMutation.mutate(Array.from(selectedIds))}
              disabled={bulkVerifyMutation.isPending}
              className="bg-[#22C55E] hover:bg-[#16A34A]"
            >
              {bulkVerifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Selected Collaterals</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} collateral(s)?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

