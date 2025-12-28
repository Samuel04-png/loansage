import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Select } from '../../../components/ui/select';
import { ArrowLeft, Image as ImageIcon, FileText, DollarSign, Calendar, CheckCircle2, Clock, XCircle, MapPin, Sparkles, TrendingUp, Shield, BarChart3, Percent, AlertTriangle, Info, Lock, Edit, Save, Scan, ExternalLink, Target } from 'lucide-react';
import { formatCurrency, formatDateSafe } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import * as React from 'react';
import { estimateCollateralPrice, calculateCollateralProfit } from '../../../lib/ai/collateral-pricing';
import { calculateLoanFinancials } from '../../../lib/firebase/loan-calculations';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useFeatureGate } from '../../../hooks/useFeatureGate';
import { UpgradeModal } from '../../../components/pricing/UpgradeModal';

export function CollateralDetailPage() {
  const { loanId, collateralId } = useParams<{ loanId?: string; collateralId: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { features, plan } = useFeatureGate();
  const [aiValuation, setAiValuation] = useState<any>(null);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [marketValue, setMarketValue] = useState<number | null>(null);
  const [loadingMarketValue, setLoadingMarketValue] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [aiVisionAnalysis, setAiVisionAnalysis] = useState<any>(null);
  const [loadingVisionAnalysis, setLoadingVisionAnalysis] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    estimatedValue: '',
    condition: '',
    verificationStatus: '',
    location: '',
    brand: '',
    model: '',
    year: '',
  });
  
  const hasCollateralValuation = features.collateralValuation;

  // AI Vision Analysis function
  const analyzeWithAI = async () => {
    if (!collateral || !profile?.agency_id) return;
    
    const photos = collateral.photos || [];
    if (photos.length === 0) {
      toast.error('No photos available to analyze. Please upload a photo first.');
      return;
    }

    if (!hasCollateralValuation) {
      setUpgradeModalOpen(true);
      return;
    }

    setLoadingVisionAnalysis(true);
    try {
      const analyzeCollateralVision = httpsCallable(functions, 'analyzeCollateralVision');
      const result = await analyzeCollateralVision({
        agencyId: profile.agency_id,
        collateralId: collateral.id,
        imageUrl: photos[0],
        type: collateral.type,
        description: collateral.description,
        location: collateral.location,
      });

      setAiVisionAnalysis(result.data);
      toast.success('AI analysis complete!');
      
      // Refresh collateral data
      queryClient.invalidateQueries({ queryKey: ['collateral', profile.agency_id, loanId, collateralId] });
    } catch (error: any) {
      console.error('AI Vision analysis error:', error);
      toast.error(error.message || 'Failed to analyze with AI');
    } finally {
      setLoadingVisionAnalysis(false);
    }
  };

  // Fetch loan details
  const { data: loan } = useQuery({
    queryKey: ['loan', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return null;
      const loanRef = doc(db, 'agencies', profile.agency_id, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) return null;
      return { id: loanSnap.id, ...loanSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Fetch collateral details - try top-level registry first, then loan subcollection
  const { data: collateral, isLoading } = useQuery({
    queryKey: ['collateral', profile?.agency_id, loanId, collateralId],
    queryFn: async () => {
      if (!profile?.agency_id || !collateralId) return null;

      // Try top-level collateral registry first
      try {
        const registryRef = doc(db, 'agencies', profile.agency_id, 'collateral', collateralId);
        const registrySnap = await getDoc(registryRef);
        
        if (registrySnap.exists()) {
          return { id: registrySnap.id, ...registrySnap.data() };
        }
      } catch (error) {
        console.warn('Failed to fetch from registry:', error);
      }

      // Fallback to loan subcollection if loanId provided
      if (loanId) {
        try {
          const collateralRef = doc(
            db,
            'agencies',
            profile.agency_id,
            'loans',
            loanId,
            'collateral',
            collateralId
          );
          const collateralSnap = await getDoc(collateralRef);
          
          if (collateralSnap.exists()) {
            return { id: collateralSnap.id, ...collateralSnap.data() };
          }
        } catch (error) {
          console.warn('Failed to fetch from loan subcollection:', error);
        }
      }

      return null;
    },
    enabled: !!profile?.agency_id && !!collateralId,
  });

  // Fetch customer details
  const { data: customer } = useQuery({
    queryKey: ['customer', profile?.agency_id, loan?.customerId],
    queryFn: async () => {
      if (!profile?.agency_id || !loan?.customerId) return null;
      const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', loan.customerId);
      const customerSnap = await getDoc(customerRef);
      if (!customerSnap.exists()) return null;
      return { id: customerSnap.id, ...customerSnap.data() };
    },
    enabled: !!profile?.agency_id && !!loan?.customerId,
  });

  // Fetch loan repayments to calculate loan status
  const { data: loanRepayments } = useQuery({
    queryKey: ['loan-repayments', profile?.agency_id, loanId],
    queryFn: async () => {
      if (!profile?.agency_id || !loanId) return [];
      try {
        const repaymentsRef = collection(db, 'agencies', profile.agency_id, 'loans', loanId, 'repayments');
        const repaymentsSnapshot = await getDocs(repaymentsRef);
        return repaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn('Failed to fetch repayments:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id && !!loanId,
  });

  // Initialize edit form when collateral loads
  React.useEffect(() => {
    if (collateral) {
      setEditForm({
        name: collateral.name || '',
        description: collateral.description || '',
        estimatedValue: String(collateral.estimatedValue || collateral.value || ''),
        condition: collateral.condition || '',
        verificationStatus: collateral.verificationStatus || collateral.status || '',
        location: collateral.location || '',
        brand: collateral.brand || '',
        model: collateral.model || '',
        year: collateral.year || '',
      });
    }
  }, [collateral]);

  // Update collateral mutation
  const updateCollateralMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      if (!profile?.agency_id || !collateralId) throw new Error('Missing required data');

      // Try top-level registry first
      const registryRef = doc(db, 'agencies', profile.agency_id, 'collateral', collateralId);
      const registrySnap = await getDoc(registryRef);
      
      const updateData = {
        name: data.name,
        description: data.description,
        estimatedValue: parseFloat(data.estimatedValue) || 0,
        value: parseFloat(data.estimatedValue) || 0,
        condition: data.condition,
        verificationStatus: data.verificationStatus,
        status: data.verificationStatus?.toUpperCase() || 'PENDING',
        location: data.location,
        brand: data.brand,
        model: data.model,
        year: data.year,
        updatedAt: serverTimestamp(),
      };

      if (registrySnap.exists()) {
        await updateDoc(registryRef, updateData);
      } else if (loanId) {
        // Fallback to loan subcollection
        const loanCollateralRef = doc(
          db,
          'agencies',
          profile.agency_id,
          'loans',
          loanId,
          'collateral',
          collateralId
        );
        await updateDoc(loanCollateralRef, updateData);
      }
    },
    onSuccess: () => {
      toast.success('Collateral updated successfully');
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['collateral', profile?.agency_id, loanId, collateralId] });
      queryClient.invalidateQueries({ queryKey: ['collaterals'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update collateral');
    },
  });

  // Fetch market value when collateral is loaded
  const fetchMarketValue = async () => {
    if (!collateral || loadingMarketValue) return;
    
    if (!hasCollateralValuation) {
      setUpgradeModalOpen(true);
      return;
    }
    
    setLoadingMarketValue(true);
    try {
      const { estimateCollateralPrice } = await import('../../../lib/ai/collateral-pricing');
      const pricingResult = await estimateCollateralPrice({
        agencyId: profile?.agency_id,
        type: collateral.type || 'other',
        name: collateral.name || '',
        description: collateral.description || '',
        brand: collateral.brand,
        model: collateral.model,
        year: collateral.year,
        condition: collateral.condition || 'good',
        location: collateral.location,
        estimatedValue: Number(collateral.estimatedValue || collateral.value || 0),
      });
      setMarketValue(pricingResult.estimatedMarketValue);
      setAiValuation(pricingResult);
    } catch (error) {
      console.error('Failed to fetch market value:', error);
      toast.error('Failed to fetch market value');
    } finally {
      setLoadingMarketValue(false);
    }
  };

  // Auto-fetch market value when collateral loads
  React.useEffect(() => {
    if (collateral && !marketValue && !loadingMarketValue) {
      fetchMarketValue();
    }
  }, [collateral]);

  // Calculate financial metrics
  const collateralValue = Number(collateral?.estimatedValue || collateral?.value || 0);
  const marketValueToUse = marketValue || collateralValue;
  const loanAmount = loan ? Number(loan.amount || 0) : 0;
  const loanCoverageRatio = loanAmount > 0 ? (marketValueToUse / loanAmount) * 100 : 0;
  const valueDifference = marketValue ? marketValue - collateralValue : 0;
  const valueDifferencePercent = collateralValue > 0 ? (valueDifference / collateralValue) * 100 : 0;
  const totalPaid = loanRepayments?.reduce((sum: number, r: any) => sum + Number(r.amountPaid || 0), 0) || 0;
  
  // Calculate remaining balance using proper amortization calculation
  let remainingBalance = 0;
  if (loan) {
    const principal = Number(loan.amount || 0);
    const interestRate = Number(loan.interestRate || 0);
    const durationMonths = Number(loan.durationMonths || 0);
    
    if (principal > 0 && interestRate > 0 && durationMonths > 0) {
      // Use calculateLoanFinancials to get the correct total amount (accounts for loan duration)
      const financials = calculateLoanFinancials(principal, interestRate, durationMonths);
      remainingBalance = Math.max(0, financials.totalAmount - totalPaid);
    } else {
      // Fallback for loans without proper duration/rate data
      const totalInterest = principal * (interestRate / 100) * (durationMonths || 12) / 12;
      remainingBalance = Math.max(0, (principal + totalInterest) - totalPaid);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!collateral) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Collateral not found</p>
        <Link to={loanId ? `/admin/loans/${loanId}` : '/admin/loans'}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loan
          </Button>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>;
      case 'pending':
        return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const photos = collateral.photos || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={loanId ? `/admin/loans/${loanId}` : '/admin/collateral'}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Collateral Details</h2>
            <p className="text-slate-600">{collateral.type?.replace('_', ' ').toUpperCase() || 'Collateral'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(collateral.verificationStatus || collateral.status)}
          <Button
            onClick={() => setEditDialogOpen(true)}
            variant="outline"
            className="rounded-xl"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Collateral
          </Button>
        </div>
      </div>

      {/* Financial Summary */}
      {loan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Collateral Value
                  </p>
                  <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(collateralValue, collateral.currency || 'ZMW')}
                  </p>
                </div>
                <div className="p-3 bg-[#006BFF]/10 rounded-lg">
                  <DollarSign className="w-6 h-6 text-[#006BFF]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Loan Amount
                  </p>
                  <p className="text-xl font-bold text-[#22C55E]">
                    {formatCurrency(loanAmount, 'ZMW')}
                  </p>
                </div>
                <div className="p-3 bg-[#22C55E]/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-[#22C55E]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Coverage Ratio
                  </p>
                  <p className={cn(
                    "text-xl font-bold",
                    loanCoverageRatio >= 150 ? "text-[#22C55E]" :
                    loanCoverageRatio >= 100 ? "text-[#FACC15]" :
                    "text-[#EF4444]"
                  )}>
                    {loanCoverageRatio.toFixed(1)}%
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {loanCoverageRatio >= 150 ? "Excellent" :
                     loanCoverageRatio >= 100 ? "Good" :
                     "Low coverage"}
                  </p>
                </div>
                <div className="p-3 bg-[#8B5CF6]/10 rounded-lg">
                  <Shield className="w-6 h-6 text-[#8B5CF6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                    Remaining Balance
                  </p>
                  <p className="text-xl font-bold text-[#EF4444]">
                    {formatCurrency(Math.max(0, remainingBalance), 'ZMW')}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {formatCurrency(totalPaid, 'ZMW')} paid
                  </p>
                </div>
                <div className="p-3 bg-[#EF4444]/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-[#EF4444]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Collateral Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardHeader>
              <CardTitle>Collateral Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {collateral.name && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Name</p>
                  <p className="font-semibold text-lg">{collateral.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Type</p>
                <p className="font-semibold capitalize">{collateral.type?.replace('_', ' ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Description</p>
                <p className="font-semibold">{collateral.description || 'No description provided'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Estimated Value</p>
                <p className="font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#006BFF]" />
                  {formatCurrency(collateralValue, collateral.currency || 'ZMW')}
                </p>
              </div>
              {collateral.brand && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Brand</p>
                  <p className="font-semibold">{collateral.brand}</p>
                </div>
              )}
              {collateral.model && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Model</p>
                  <p className="font-semibold">{collateral.model}</p>
                </div>
              )}
              {collateral.year && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Year</p>
                  <p className="font-semibold">{collateral.year}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Collateral ID</p>
                <p className="font-mono text-sm">{collateral.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Created</p>
                <p className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDateSafe(collateral.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardHeader>
              <CardTitle>Related Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loan && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Loan</p>
                  <Link to={`/admin/loans/${loan.id}`}>
                    <p className="font-semibold text-[#006BFF] hover:underline">{loan.id.substring(0, 12)}...</p>
                  </Link>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-neutral-600">
                      Amount: <span className="font-semibold">{formatCurrency(Number(loan.amount || 0), 'ZMW')}</span>
                    </p>
                    <p className="text-sm text-neutral-600">
                      Interest: <span className="font-semibold">{loan.interestRate || 0}%</span>
                    </p>
                    <p className="text-sm text-neutral-600">
                      Duration: <span className="font-semibold">{loan.durationMonths || 0} months</span>
                    </p>
                    <p className="text-sm text-neutral-600">
                      Status: <Badge variant={loan.status === 'active' ? 'success' : 'outline'}>{loan.status || 'N/A'}</Badge>
                    </p>
                  </div>
                </div>
              )}
              {customer && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Customer</p>
                  <Link to={`/admin/customers/${customer.id}`}>
                    <p className="font-semibold text-[#006BFF] hover:underline">{customer.fullName || 'N/A'}</p>
                  </Link>
                  <p className="text-xs text-neutral-500 mt-1">{customer.email || customer.phone || ''}</p>
                </div>
              )}
              {collateral.location && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Location</p>
                  <p className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {collateral.location}
                  </p>
                </div>
              )}
              {collateral.condition && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Condition</p>
                  <Badge variant="outline" className="capitalize">{collateral.condition}</Badge>
                </div>
              )}
              {collateral.serialNumber && (
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Serial Number</p>
                  <p className="font-mono text-sm">{collateral.serialNumber}</p>
                </div>
              )}
              {loanCoverageRatio > 0 && (
                <div className="pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Coverage Assessment</p>
                    <Info className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          loanCoverageRatio >= 150 ? "bg-[#22C55E]" :
                          loanCoverageRatio >= 100 ? "bg-[#FACC15]" :
                          "bg-[#EF4444]"
                        )}
                        style={{ width: `${Math.min(100, loanCoverageRatio)}%` }}
                      />
                    </div>
                    <p className="text-xs text-neutral-600">
                      {loanCoverageRatio >= 150 
                        ? "Excellent coverage - Collateral value significantly exceeds loan amount"
                        : loanCoverageRatio >= 100
                        ? "Good coverage - Collateral value covers the loan amount"
                        : "Low coverage - Collateral value is below loan amount"}
                    </p>
                    {loanCoverageRatio > 100 && (
                      <p className="text-xs text-neutral-500 italic">
                        Coverage: {loanCoverageRatio.toFixed(1)}% (exceeds 100% limit)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Market Valuation Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="rounded-xl border border-neutral-200/50 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#006BFF]" />
              Market Valuation & Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Estimated Value (Entered)
                  </p>
                  <p className="text-2xl font-bold text-[#006BFF]">
                    {formatCurrency(collateralValue, collateral.currency || 'ZMW')}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Value entered when creating collateral
                  </p>
                </div>
                {loadingMarketValue ? (
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Fetching market value...</span>
                  </div>
                ) : marketValue ? (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Market Value (AI Estimated)
                    </p>
                    <p className="text-2xl font-bold text-[#22C55E]">
                      {formatCurrency(marketValue, collateral.currency || 'ZMW')}
                    </p>
                    {valueDifference !== 0 && (
                      <p className={cn(
                        "text-sm mt-1 font-semibold",
                        valueDifference > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      )}>
                        {valueDifference > 0 ? '+' : ''}{formatCurrency(valueDifference, collateral.currency || 'ZMW')} 
                        ({valueDifferencePercent > 0 ? '+' : ''}{valueDifferencePercent.toFixed(1)}%)
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">
                      Based on {collateral.name || collateral.description} market analysis
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMarketValue}
                    disabled={loadingMarketValue}
                    className="mt-2"
                  >
                    {hasCollateralValuation ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Get Market Value
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Upgrade for Market Value
                      </>
                    )}
                  </Button>
                )}
                {loanCoverageRatio > 0 && (
                  <div className="pt-4 border-t border-neutral-200">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Risk Assessment
                    </p>
                    <div className="space-y-2">
                      {loanCoverageRatio >= 150 ? (
                        <div className="flex items-center gap-2 text-[#22C55E]">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-semibold">Low Risk - Excellent Coverage</span>
                        </div>
                      ) : loanCoverageRatio >= 100 ? (
                        <div className="flex items-center gap-2 text-[#FACC15]">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-semibold">Moderate Risk - Adequate Coverage</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#EF4444]">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-semibold">High Risk - Insufficient Coverage</span>
                        </div>
                      )}
                      <p className="text-sm text-neutral-600">
                        Collateral covers {loanCoverageRatio.toFixed(1)}% of the loan amount
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {loan && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Loan Protection
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Loan Amount:</span>
                        <span className="font-semibold">{formatCurrency(loanAmount, 'ZMW')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">Collateral Value:</span>
                        <span className="font-semibold text-[#22C55E]">{formatCurrency(collateralValue, collateral.currency || 'ZMW')}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-neutral-200">
                        <span className="text-sm font-semibold text-neutral-700">Coverage:</span>
                        <span className={cn(
                          "font-bold",
                          loanCoverageRatio >= 150 ? "text-[#22C55E]" :
                          loanCoverageRatio >= 100 ? "text-[#FACC15]" :
                          "text-[#EF4444]"
                        )}>
                          {loanCoverageRatio.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {collateral.specifications && Object.keys(collateral.specifications).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Specifications
                    </p>
                    <div className="space-y-1">
                      {Object.entries(collateral.specifications).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-neutral-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="font-semibold">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Photos */}
      {photos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Collateral Photos ({photos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo: string, index: number) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 hover:border-[#006BFF] transition-colors">
                    <img
                      src={photo}
                      alt={`Collateral photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Image+Not+Available';
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Documents */}
      {collateral.documents && collateral.documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm bg-white dark:bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Related Documents ({collateral.documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {collateral.documents.map((doc: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-neutral-400" />
                      <div>
                        <p className="font-medium text-neutral-900">{doc.name || `Document ${index + 1}`}</p>
                        <p className="text-xs text-neutral-500">{doc.type || 'Document'}</p>
                      </div>
                    </div>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="rounded-lg">View</Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Verification Notes */}
      {collateral.verificationNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 whitespace-pre-wrap">{collateral.verificationNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        feature="Collateral Market Valuation"
        currentPlan={plan}
        requiredPlan="professional"
      />

      {/* Edit Collateral Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-[#006BFF]" />
              Edit Collateral
            </DialogTitle>
            <DialogDescription>
              Update the collateral details below. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g., Toyota Corolla"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated Value (ZMW)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  value={editForm.estimatedValue}
                  onChange={(e) => setEditForm({ ...editForm, estimatedValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe the collateral item..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  id="condition"
                  value={editForm.condition}
                  onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                >
                  <option value="">Select condition</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verificationStatus">Status</Label>
                <Select
                  id="verificationStatus"
                  value={editForm.verificationStatus}
                  onChange={(e) => setEditForm({ ...editForm, verificationStatus: e.target.value })}
                >
                  <option value="">Select status</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={editForm.brand}
                  onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                  placeholder="e.g., Toyota"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                  placeholder="e.g., Corolla"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                  placeholder="e.g., 2020"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="e.g., Lusaka, Zambia"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateCollateralMutation.mutate(editForm)}
              disabled={updateCollateralMutation.isPending}
              className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
            >
              {updateCollateralMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

