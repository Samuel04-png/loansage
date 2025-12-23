import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
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
import { Search, Loader2, Download, FileText, Image as ImageIcon, Plus, DollarSign, TrendingUp, Shield, BarChart3, Clock } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AddCollateralDrawer } from '../components/AddCollateralDrawer';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { doc, getDoc } from 'firebase/firestore';

export function CollateralsPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

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
                const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', coll.loanId);
                const loanSnap = await getDoc(loanRef);
                if (loanSnap.exists()) {
                  coll.loan = { id: loanSnap.id, ...loanSnap.data() };
                  
                  // Calculate loan coverage ratio
                  const loanAmount = Number(coll.loan.amount || 0);
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
            
            loanCollateralSnapshot.docs.forEach(doc => {
              const existing = collateralsWithLoanDetails.find(c => c.id === doc.id);
              if (!existing) {
                const collateralData = { id: doc.id, loanId: loan.id, loan: loan, ...doc.data() };
                const loanAmount = Number(loan.amount || 0);
                const collateralValue = Number(collateralData.estimatedValue || collateralData.value || 0);
                collateralData.loanCoverageRatio = loanAmount > 0 ? (collateralValue / loanAmount) * 100 : 0;
                collateralsWithLoanDetails.push(collateralData);
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
          <h2 className="text-2xl font-bold text-neutral-900">Collaterals</h2>
          <p className="text-sm text-neutral-600">Manage all loan collaterals and their valuations</p>
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
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredCollaterals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-neutral-200 dark:border-neutral-800">
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
                        className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
                      >
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
                          {coll.verificationStatus === 'verified' || coll.status === 'VERIFIED' ? (
                            <Badge className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20">Verified</Badge>
                          ) : coll.verificationStatus === 'pending' || coll.status === 'PENDING' ? (
                            <Badge className="bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20">Pending</Badge>
                          ) : (
                            <Badge variant="outline">{coll.verificationStatus || coll.status || 'N/A'}</Badge>
                          )}
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
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No collaterals found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCollateralDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onSuccess={() => {
          // Refetch collaterals
          window.location.reload();
        }}
      />
    </div>
  );
}

