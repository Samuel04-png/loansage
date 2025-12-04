import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, Loader2, Download, FileText, Image as ImageIcon, Plus } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AddCollateralDrawer } from '../components/AddCollateralDrawer';

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
              const existing = allCollaterals.find(c => c.id === doc.id);
              if (!existing) {
                allCollaterals.push({
                  id: doc.id,
                  loanId: loan.id,
                  loan: loan,
                  ...doc.data(),
                });
              }
            });
          } catch (error) {
            console.warn(`Failed to fetch collateral for loan ${loan.id}:`, error);
          }
        }

        return allCollaterals;
      } catch (error) {
        console.error('Error fetching collaterals:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id,
  });

  const filteredCollaterals = collaterals?.filter((coll: any) =>
    coll.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coll.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coll.loanId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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

    const { exportToCSV } = require('../../../lib/data-export');
    exportToCSV(data, headers, { filename: `collaterals-export-${Date.now()}.csv` });
    toast.success('Collaterals exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Collaterals</h2>
          <p className="text-slate-600">Manage all loan collaterals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCollaterals}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setAddDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Collateral
          </Button>
        </div>
      </div>

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
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Collateral</th>
                    <th className="px-6 py-3">Loan ID</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Value</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollaterals.map((coll: any) => (
                    <tr
                      key={coll.id}
                      className="bg-white border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {coll.photos && coll.photos.length > 0 ? (
                            <ImageIcon className="w-8 h-8 text-slate-400 mr-3" />
                          ) : (
                            <FileText className="w-8 h-8 text-slate-400 mr-3" />
                          )}
                          <div>
                            <div className="font-medium text-slate-900">
                              {coll.description?.substring(0, 50) || 'No description'}
                              {coll.description && coll.description.length > 50 ? '...' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{coll.loanId?.substring(0, 8) || 'N/A'}</td>
                      <td className="px-6 py-4 capitalize">{coll.type?.replace('_', ' ') || 'N/A'}</td>
                      <td className="px-6 py-4 font-semibold">
                        {formatCurrency(Number(coll.estimatedValue || coll.value || 0), coll.currency || 'ZMW')}
                      </td>
                      <td className="px-6 py-4">
                        {coll.verificationStatus === 'verified' || coll.status === 'VERIFIED' ? (
                          <Badge variant="success">Verified</Badge>
                        ) : coll.verificationStatus === 'pending' || coll.status === 'PENDING' ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <Badge variant="outline">{coll.verificationStatus || coll.status || 'N/A'}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDateSafe(coll.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {coll.loanId ? (
                          <Link to={`/admin/loans/${coll.loanId}/collateral/${coll.id}`}>
                            <Button variant="outline" size="sm">View Details</Button>
                          </Link>
                        ) : (
                          <Link to={`/admin/collateral/${coll.id}`}>
                            <Button variant="outline" size="sm">View Details</Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

