/**
 * Tenga Marketplace - Public "Find a Lender" Page
 * Borrowers can browse and apply to lenders
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { getApp } from 'firebase/app';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Select } from '../../../components/ui/select';
import { 
  Search, 
  Building2, 
  TrendingUp, 
  Clock, 
  Shield, 
  Star,
  ArrowRight,
  Filter,
  X,
  Percent,
  DollarSign,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketplaceApplicationModal } from '../components/MarketplaceApplicationModal';
import { LenderDetailsModal } from '../components/LenderDetailsModal';
import { formatCurrency } from '../../../lib/utils';

interface MarketplaceProfile {
  id: string;
  agencyId: string;
  agencyName: string;
  description?: string;
  minInterestRate: number;
  maxInterestRate: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  trustBadge: 'enterprise' | 'professional' | 'starter' | null;
  isActive: boolean;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  loanTypes?: string[];
  requirements?: string[];
}

// Loan type options
const LOAN_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'business', label: 'Business Loan' },
  { value: 'sme', label: 'SME Loan' },
  { value: 'civil_servant', label: 'Civil Servant Loan' },
  { value: 'agricultural', label: 'Agricultural Loan' },
  { value: 'education', label: 'Education Loan' },
];

// Amount brackets
const AMOUNT_BRACKETS = [
  { value: 'all', label: 'Any Amount' },
  { value: '1000-5000', label: 'K1,000 - K5,000' },
  { value: '5000-10000', label: 'K5,000 - K10,000' },
  { value: '10000-25000', label: 'K10,000 - K25,000' },
  { value: '25000-50000', label: 'K25,000 - K50,000' },
  { value: '50000-100000', label: 'K50,000 - K100,000' },
  { value: '100000+', label: 'K100,000+' },
];

// Duration options
const DURATION_OPTIONS = [
  { value: 'all', label: 'Any Duration' },
  { value: '1-3', label: '1-3 Months' },
  { value: '3-6', label: '3-6 Months' },
  { value: '6-12', label: '6-12 Months' },
  { value: '12-24', label: '12-24 Months' },
  { value: '24-36', label: '24-36 Months' },
  { value: '36+', label: '36+ Months' },
];

export function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    loanType: 'all',
    amountBracket: 'all',
    duration: 'all',
  });
  const [selectedLender, setSelectedLender] = useState<MarketplaceProfile | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLender, setDetailsLender] = useState<MarketplaceProfile | null>(null);

  // Parse amount bracket to min/max
  const getAmountRange = (bracket: string) => {
    if (bracket === 'all') return { min: undefined, max: undefined };
    if (bracket === '100000+') return { min: 100000, max: undefined };
    const [min, max] = bracket.split('-').map(Number);
    return { min, max };
  };

  // Parse duration bracket to min/max months
  const getDurationRange = (duration: string) => {
    if (duration === 'all') return { min: undefined, max: undefined };
    if (duration === '36+') return { min: 36, max: undefined };
    const [min, max] = duration.split('-').map(Number);
    return { min, max };
  };

  // Get the function URL
  const getFunctionUrl = () => {
    try {
      const app = getApp();
      const projectId = app.options.projectId || 'digital-bible-e3122';
      const region = 'us-central1';
      return `https://${region}-${projectId}.cloudfunctions.net/getMarketplaceProfiles`;
    } catch {
      // Fallback if app not initialized
      return 'https://us-central1-digital-bible-e3122.cloudfunctions.net/getMarketplaceProfiles';
    }
  };

  // Fetch marketplace profiles from Cloud Function (REST endpoint)
  const { data: marketplaceProfiles = [], isLoading: isLoadingMarketplace } = useQuery({
    queryKey: ['marketplaceProfiles', filters],
    queryFn: async () => {
      try {
        const amountRange = getAmountRange(filters.amountBracket);
        const durationRange = getDurationRange(filters.duration);
        
        const response = await fetch(getFunctionUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              minAmount: amountRange.min,
              maxAmount: amountRange.max,
              minTermMonths: durationRange.min,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return (result.profiles || []) as MarketplaceProfile[];
      } catch (error) {
        console.error('Error fetching marketplace profiles:', error);
        return [];
      }
    },
  });

  // Fallback: Fetch all active agencies if no marketplace profiles exist
  const { data: agenciesData = [], isLoading: isLoadingAgencies } = useQuery({
    queryKey: ['allAgencies'],
    queryFn: async () => {
      try {
        const agenciesRef = collection(db, 'agencies');
        const q = query(agenciesRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          agencyId: doc.id,
          agencyName: doc.data().name || 'Unknown Agency',
          description: doc.data().description || 'A trusted lending partner',
          minInterestRate: 10,
          maxInterestRate: 30,
          minLoanAmount: 1000,
          maxLoanAmount: 100000,
          minTermMonths: 3,
          maxTermMonths: 36,
          trustBadge: (doc.data().plan as 'enterprise' | 'professional' | 'starter') || 'starter',
          isActive: true,
          logoUrl: doc.data().logoUrl,
          websiteUrl: doc.data().websiteUrl,
          contactEmail: doc.data().email,
          contactPhone: doc.data().phone,
        })) as MarketplaceProfile[];
      } catch (error) {
        console.error('Error fetching agencies:', error);
        return [];
      }
    },
    enabled: marketplaceProfiles.length === 0 && !isLoadingMarketplace,
  });

  // Use marketplace profiles if available, otherwise use agencies
  const profiles = marketplaceProfiles.length > 0 ? marketplaceProfiles : agenciesData;
  const isLoading = isLoadingMarketplace || (marketplaceProfiles.length === 0 && isLoadingAgencies);

  // Filter by search term, loan type, and sort by trust badge and interest rate
  const filteredProfiles = profiles
    .filter((profile) => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          profile.agencyName.toLowerCase().includes(searchLower) ||
          profile.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Loan type filter - check if profile supports the selected loan type
      if (filters.loanType !== 'all') {
        const profileLoanTypes = profile.loanTypes || [];
        // Use array-contains logic: profile must have the selected loan type
        if (!profileLoanTypes.includes(filters.loanType)) return false;
      }

      // Amount bracket filter - check if user's requested range overlaps with lender's range
      if (filters.amountBracket !== 'all') {
        const amountRange = getAmountRange(filters.amountBracket);
        // User wants: amountRange.min to amountRange.max
        // Lender offers: profile.minLoanAmount to profile.maxLoanAmount
        // They overlap if: userMin <= lenderMax AND userMax >= lenderMin
        if (amountRange.min !== undefined && profile.maxLoanAmount < amountRange.min) return false;
        if (amountRange.max !== undefined && profile.minLoanAmount > amountRange.max) return false;
        // Also check if user's max is within lender's range (if user specified a max)
        if (amountRange.min !== undefined && amountRange.max === undefined) {
          // User wants "100000+" - lender must support at least 100000
          if (profile.maxLoanAmount < amountRange.min) return false;
        }
      }

      // Duration filter - check if user's requested range overlaps with lender's range
      if (filters.duration !== 'all') {
        const durationRange = getDurationRange(filters.duration);
        // User wants: durationRange.min to durationRange.max months
        // Lender offers: profile.minTermMonths to profile.maxTermMonths
        // They overlap if: userMin <= lenderMax AND userMax >= lenderMin
        if (durationRange.min !== undefined && profile.maxTermMonths < durationRange.min) return false;
        if (durationRange.max !== undefined && profile.minTermMonths > durationRange.max) return false;
        // Also check if user's max is within lender's range (if user specified a max)
        if (durationRange.min !== undefined && durationRange.max === undefined) {
          // User wants "36+" - lender must support at least 36 months
          if (profile.maxTermMonths < durationRange.min) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by trust badge first (enterprise > professional > starter)
      const badgeOrder = { enterprise: 3, professional: 2, starter: 1 };
      const aBadge = badgeOrder[a.trustBadge || 'starter'] || 0;
      const bBadge = badgeOrder[b.trustBadge || 'starter'] || 0;
      if (aBadge !== bBadge) return bBadge - aBadge;
      
      // Then by minimum interest rate (lower is better)
      return a.minInterestRate - b.minInterestRate;
    });

  const getTrustBadgeColor = (badge: string | null) => {
    switch (badge) {
      case 'enterprise':
        return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 shadow-md';
      case 'professional':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const handleCardClick = (profile: MarketplaceProfile) => {
    setDetailsLender(profile);
    setShowDetailsModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Premium Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Verified Lenders</span>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Find Your Perfect Lender
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
              Compare rates, terms, and trust badges from verified lenders. Apply once, get matched instantly.
            </p>
            
            {/* Stats */}
            {profiles.length > 0 && (
              <div className="flex items-center justify-center gap-8 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {profiles.length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Active Lenders
                  </div>
                </div>
                <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {profiles.filter(p => p.trustBadge === 'enterprise').length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Enterprise Partners
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters - Premium Design */}
        <Card className="mb-8 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search lenders by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-14 text-base bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>

              {/* Structured Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Loan Type
                  </label>
                  <Select
                    value={filters.loanType}
                    onChange={(e) => setFilters({ ...filters, loanType: e.target.value })}
                    className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {LOAN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Amount Needed
                  </label>
                  <Select
                    value={filters.amountBracket}
                    onChange={(e) => setFilters({ ...filters, amountBracket: e.target.value })}
                    className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {AMOUNT_BRACKETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Duration
                  </label>
                  <Select
                    value={filters.duration}
                    onChange={(e) => setFilters({ ...filters, duration: e.target.value })}
                    className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(filters.loanType !== 'all' || filters.amountBracket !== 'all' || filters.duration !== 'all' || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilters({ loanType: 'all', amountBracket: 'all', duration: 'all' });
                    setSearchTerm('');
                  }}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white"></div>
            <p className="mt-6 text-slate-600 dark:text-slate-400 font-medium">Loading lenders...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                No lenders found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                {searchTerm || filters.loanType !== 'all' || filters.amountBracket !== 'all' || filters.duration !== 'all'
                  ? 'No exact matches found. Try adjusting your filters or search terms to see more results.'
                  : 'No active lenders are currently available. Please check back later.'}
              </p>
              {(searchTerm || filters.loanType !== 'all' || filters.amountBracket !== 'all' || filters.duration !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ loanType: 'all', amountBracket: 'all', duration: 'all' });
                  }}
                  className="rounded-xl"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredProfiles.length}</span> lender{filteredProfiles.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Lender Cards - Premium Design */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProfiles.map((profile, idx) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="h-full"
                >
                  <Card 
                    className="h-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 overflow-hidden cursor-pointer"
                    onClick={() => handleCardClick(profile)}
                  >
                    {/* Trust Badge Header */}
                    {profile.trustBadge === 'enterprise' && (
                      <div className="h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
                    )}
                    {profile.trustBadge === 'professional' && (
                      <div className="h-1 bg-blue-500" />
                    )}

                    <CardHeader className="pb-4 pt-6">
                      <div className="flex items-start gap-4 mb-4">
                        {profile.logoUrl ? (
                          <img
                            src={profile.logoUrl}
                            alt={profile.agencyName}
                            className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-8 h-8 text-white dark:text-slate-900" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                            {profile.agencyName}
                          </CardTitle>
                          {profile.trustBadge && (
                            <Badge
                              className={`text-xs font-medium ${getTrustBadgeColor(profile.trustBadge)}`}
                            >
                              {profile.trustBadge === 'enterprise' && <Star className="w-3 h-3 mr-1 fill-current" />}
                              {profile.trustBadge === 'professional' && <Shield className="w-3 h-3 mr-1" />}
                              {profile.trustBadge.charAt(0).toUpperCase() + profile.trustBadge.slice(1)} Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                      {profile.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {profile.description}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-5 pt-0">
                      {/* Loan Details - Premium Layout */}
                      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Percent className="w-4 h-4" />
                            <span className="text-sm">Interest Rate</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            {profile.minInterestRate}% - {profile.maxInterestRate}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-sm">Loan Amount</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            {formatCurrency(profile.minLoanAmount)} - {formatCurrency(profile.maxLoanAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Term</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            {profile.minTermMonths} - {profile.maxTermMonths} months
                          </span>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span>Verified</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span>Fast Approval</span>
                        </div>
                        {profile.trustBadge === 'enterprise' && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span>Premium Support</span>
                          </div>
                        )}
                      </div>

                      {/* Apply Button */}
                      <Button
                        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          setSelectedLender(profile);
                          setShowApplicationModal(true);
                        }}
                      >
                        Apply Now
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lender Details Modal */}
      <LenderDetailsModal
        lender={detailsLender}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />

      {/* Application Modal */}
      <AnimatePresence>
        {showApplicationModal && selectedLender && (
          <MarketplaceApplicationModal
            lender={selectedLender}
            onClose={() => {
              setShowApplicationModal(false);
              setSelectedLender(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
