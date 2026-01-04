/**
 * Collateral Tracking Page - Employee Portal
 * Allows Loan Officers to view and manage collateral assets
 * Features: Gallery View + List View, filtering, search
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectionGroup, getDocs, query as firestoreQuery, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Grid3X3, 
  List, 
  Package, 
  Car, 
  Home, 
  Smartphone, 
  Gem, 
  FileText,
  ChevronRight,
  DollarSign,
  User,
  Link2
} from 'lucide-react';

// Asset type icons
const assetIcons: Record<string, any> = {
  vehicle: Car,
  car: Car,
  property: Home,
  house: Home,
  real_estate: Home,
  electronics: Smartphone,
  jewelry: Gem,
  document: FileText,
  other: Package,
};

const getAssetIcon = (type: string) => {
  const normalizedType = type?.toLowerCase().replace(/[_\s]/g, '_') || 'other';
  return assetIcons[normalizedType] || Package;
};

const getAssetColor = (type: string) => {
  const colors: Record<string, string> = {
    vehicle: 'from-blue-500 to-blue-600',
    car: 'from-blue-500 to-blue-600',
    property: 'from-emerald-500 to-emerald-600',
    house: 'from-emerald-500 to-emerald-600',
    real_estate: 'from-emerald-500 to-emerald-600',
    electronics: 'from-purple-500 to-purple-600',
    jewelry: 'from-amber-500 to-amber-600',
    document: 'from-slate-500 to-slate-600',
  };
  const normalizedType = type?.toLowerCase().replace(/[_\s]/g, '_') || 'other';
  return colors[normalizedType] || 'from-neutral-500 to-neutral-600';
};

export function CollateralPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');

  // Fetch all collateral in the agency using collection group query
  const { data: collateralItems, isLoading } = useQuery({
    queryKey: ['agency-collateral', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      try {
        // Collection group query to get all collateral across all loans
        const collateralRef = collectionGroup(db, 'collateral');
        const snapshot = await getDocs(collateralRef);
        
        // Filter by agency (collection group queries return all docs, need to filter)
        const items: any[] = [];
        
        for (const doc of snapshot.docs) {
          // Get parent path to extract agencyId and loanId
          const pathParts = doc.ref.path.split('/');
          const agencyIdIndex = pathParts.indexOf('agencies');
          const loanIdIndex = pathParts.indexOf('loans');
          
          if (agencyIdIndex !== -1 && pathParts[agencyIdIndex + 1] === profile.agency_id) {
            const loanId = loanIdIndex !== -1 ? pathParts[loanIdIndex + 1] : null;
            
            items.push({
              id: doc.id,
              loanId,
              ...doc.data(),
            });
          }
        }

        // Get loan and customer info for each collateral item
        const enrichedItems = await Promise.all(items.map(async (item) => {
          if (item.loanId) {
            try {
              const { getDoc, doc: firestoreDoc, collection } = await import('firebase/firestore');
              const loanRef = firestoreDoc(db, 'agencies', profile.agency_id, 'loans', item.loanId);
              const loanSnap = await getDoc(loanRef);
              
              if (loanSnap.exists()) {
                const loanData = loanSnap.data();
                let customerName = loanData.customerName || 'Unknown';
                
                // If no customer name, try to fetch it
                if (customerName === 'Unknown' && loanData.customerId) {
                  try {
                    const customerRef = firestoreDoc(db, 'agencies', profile.agency_id, 'customers', loanData.customerId);
                    const customerSnap = await getDoc(customerRef);
                    if (customerSnap.exists()) {
                      customerName = customerSnap.data().fullName || customerSnap.data().name || 'Unknown';
                    }
                  } catch (e) {
                    // Ignore customer fetch errors
                  }
                }
                
                return {
                  ...item,
                  loanNumber: loanData.loanNumber || item.loanId,
                  customerName,
                  loanStatus: loanData.status,
                };
              }
            } catch (e) {
              console.warn('Failed to fetch loan info:', e);
            }
          }
          return item;
        }));

        return enrichedItems;
      } catch (error: any) {
        console.error('Error fetching collateral:', error);
        
        // Fallback: Iterate through loans collection
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
          const loansSnapshot = await getDocs(loansRef);
          
          const allCollateral: any[] = [];
          
          for (const loanDoc of loansSnapshot.docs) {
            const loanData = loanDoc.data();
            const collateralRef = collection(db, 'agencies', profile.agency_id, 'loans', loanDoc.id, 'collateral');
            const collateralSnapshot = await getDocs(collateralRef);
            
            collateralSnapshot.docs.forEach(colDoc => {
              allCollateral.push({
                id: colDoc.id,
                loanId: loanDoc.id,
                loanNumber: loanData.loanNumber || loanDoc.id,
                customerName: loanData.customerName || 'Unknown',
                loanStatus: loanData.status,
                ...colDoc.data(),
              });
            });
          }
          
          return allCollateral;
        } catch (fallbackError) {
          console.error('Fallback collateral fetch failed:', fallbackError);
          return [];
        }
      }
    },
    enabled: !!profile?.agency_id,
  });

  // Filter collateral
  const filteredCollateral = collateralItems?.filter((item: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.name?.toLowerCase().includes(search) ||
      item.type?.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.customerName?.toLowerCase().includes(search) ||
      item.loanNumber?.toLowerCase().includes(search)
    );
  }) || [];

  // Calculate totals
  const totalValue = filteredCollateral.reduce((sum: number, item: any) => sum + (item.estimatedValue || 0), 0);

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
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">Collateral Assets</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Track and manage collateral across all loans
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'gallery' 
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <Card className="bg-gradient-to-br from-[#006BFF] to-[#4F46E5] text-white rounded-2xl border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Assets</p>
                <p className="text-3xl font-bold mt-1">{filteredCollateral.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Value</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue, 'ZMW')}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Unique Owners</p>
                <p className="text-3xl font-bold mt-1">
                  {new Set(filteredCollateral.map((item: any) => item.customerName)).size}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          <CardHeader className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="Search by asset name, type, or owner..."
                className="pl-9 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className={viewMode === 'gallery' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className={viewMode === 'gallery' ? 'h-48' : 'h-20'} />
                ))}
              </div>
            ) : filteredCollateral.length > 0 ? (
              viewMode === 'gallery' ? (
                /* Gallery View - Cards with photos/icons */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCollateral.map((item: any, index: number) => {
                    const Icon = getAssetIcon(item.type);
                    const colorClass = getAssetColor(item.type);
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative bg-neutral-50 dark:bg-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300"
                      >
                        {/* Photo or Icon Header */}
                        <div className={`h-32 bg-gradient-to-br ${colorClass} relative`}>
                          {item.photos && item.photos.length > 0 ? (
                            <img 
                              src={item.photos[0]} 
                              alt={item.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon className="w-16 h-16 text-white/80" />
                            </div>
                          )}
                          {/* Type Badge */}
                          <div className="absolute top-3 left-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm text-white">
                              {item.type || 'Other'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-4">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {item.name || 'Unnamed Asset'}
                          </h3>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                            {item.description || 'No description'}
                          </p>
                          
                          <div className="flex items-center justify-between mt-4">
                            <div>
                              <p className="text-xs text-neutral-400">Estimated Value</p>
                              <p className="font-bold text-neutral-900 dark:text-neutral-100">
                                {formatCurrency(item.estimatedValue || 0, 'ZMW')}
                              </p>
                            </div>
                            <Link 
                              to={`/employee/loans/${item.loanId}`}
                              className="flex items-center gap-1 text-xs text-[#006BFF] hover:underline"
                            >
                              <Link2 className="w-3 h-3" />
                              View Loan
                            </Link>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                            <User className="w-3 h-3 text-neutral-400" />
                            <span className="text-xs text-neutral-500 truncate">
                              {item.customerName || 'Unknown Owner'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* List View - Detailed table */
                <div className="space-y-2">
                  {filteredCollateral.map((item: any, index: number) => {
                    const Icon = getAssetIcon(item.type);
                    const colorClass = getAssetColor(item.type);
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        {/* Icon */}
                        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                              {item.name || 'Unnamed Asset'}
                            </p>
                            <p className="text-xs text-neutral-500">{item.type || 'Other'}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-xs text-neutral-400">Owner</p>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                              {item.customerName || 'Unknown'}
                            </p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-xs text-neutral-400">Loan</p>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 font-mono">
                              {item.loanNumber?.slice(0, 12) || '-'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-neutral-400">Value</p>
                            <p className="font-bold text-neutral-900 dark:text-neutral-100">
                              {formatCurrency(item.estimatedValue || 0, 'ZMW')}
                            </p>
                          </div>
                        </div>
                        
                        {/* Action */}
                        <Link 
                          to={`/employee/loans/${item.loanId}`}
                          className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : (
              <EmptyState
                icon={
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                    <Package className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                  </div>
                }
                title="No Collateral Assets Recorded"
                description={searchTerm 
                  ? "No assets match your search criteria. Try adjusting your search."
                  : "Collateral assets will appear here when they are added to loan applications."
                }
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
