/**
 * Marketplace Leads Page (Admin/Lender View)
 * View and accept/reject marketplace loan applications
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/config';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  User, 
  Mail, 
  Phone, 
  DollarSign, 
  Calendar, 
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Globe,
  Sparkles,
  RefreshCw,
  Edit,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../lib/utils';
import { CreateMarketplaceProfileWizard } from '../components/CreateMarketplaceProfileWizard';
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

interface MarketplaceLead {
  id: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  borrowerNRC?: string;
  loanAmount: number;
  loanPurpose: string;
  preferredTermMonths: number;
  targetAgencyId: string;
  targetAgencyName?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: any;
  acceptedAt?: any;
  acceptedBy?: string;
  notes?: string;
}

export function MarketplaceLeadsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [acceptingLeadId, setAcceptingLeadId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  // Fetch marketplace profile data (for editing)
  const { data: marketplaceProfileData, isLoading: checkingProfile } = useQuery({
    queryKey: ['marketplaceProfile', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null;
      const profileRef = doc(db, 'marketplace_profiles', profile.agency_id);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        return { exists: true, isActive: data?.isActive === true, data };
      }
      return { exists: false, isActive: false, data: null };
    },
    enabled: !!profile?.agency_id,
  });

  const hasProfile = marketplaceProfileData?.exists && marketplaceProfileData?.isActive === true;

  const getMarketplaceLeads = httpsCallable(functions, 'getMarketplaceLeads');
  const acceptMarketplaceLead = httpsCallable(functions, 'acceptMarketplaceLead');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['marketplaceLeads', profile?.agency_id, selectedStatus],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      
      const result = await getMarketplaceLeads({
        agencyId: profile.agency_id,
        status: selectedStatus,
      });
      
      return (result.data as { leads: MarketplaceLead[] }).leads;
    },
    enabled: !!profile?.agency_id,
  });

  const acceptMutation = useMutation({
    mutationFn: async (leadId: string) => {
      if (!profile?.agency_id) throw new Error('Agency ID not found');
      
      const result = await acceptMarketplaceLead({
        leadId,
        agencyId: profile.agency_id,
      });
      
      return result.data as { success: boolean; customerId: string; loanId: string; invitationToken: string };
    },
    onSuccess: (data, leadId) => {
      toast.success('Lead accepted! Customer and loan draft created.');
      queryClient.invalidateQueries({ queryKey: ['marketplaceLeads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setAcceptingLeadId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to accept lead');
      setAcceptingLeadId(null);
    },
  });

  const handleAcceptLead = async (lead: MarketplaceLead) => {
    if (!confirm(`Accept this application from ${lead.borrowerName}? This will create a customer and loan draft.`)) {
      return;
    }

    setAcceptingLeadId(lead.id);
    acceptMutation.mutate(lead.id);
  };

  const handleEditListing = () => {
    if (marketplaceProfileData?.data) {
      setEditingProfile(marketplaceProfileData.data);
      setWizardOpen(true);
    }
  };

  const handleRemoveListing = async () => {
    if (!profile?.agency_id) {
      toast.error('Agency ID not found');
      return;
    }

    try {
      const profileRef = doc(db, 'marketplace_profiles', profile.agency_id);
      await deleteDoc(profileRef);
      
      toast.success('Listing removed successfully');
      // Invalidate all marketplace-related queries to refresh public page
      queryClient.invalidateQueries({ queryKey: ['marketplaceProfile'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaceProfiles'] }); // Public page query
      queryClient.invalidateQueries({ queryKey: ['marketplaceLeads'] });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error removing listing:', error);
      toast.error(error.message || 'Failed to remove listing');
    }
  };

  const leads = data || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  // Show empty state if no profile exists
  if (!checkingProfile && !hasProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Marketplace Leads</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Review and accept loan applications from borrowers
          </p>
        </div>

        {/* Empty State CTA */}
        <Card className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-12 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md mx-auto"
            >
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                <Globe className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                You are not visible to borrowers yet
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Create your Public Listing to start receiving loan applications from borrowers on the marketplace.
              </p>
              <Button
                onClick={() => setWizardOpen(true)}
                size="lg"
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create Your Public Listing
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        <CreateMarketplaceProfileWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['marketplaceProfile'] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Marketplace Leads</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Review and accept loan applications from borrowers
          </p>
        </div>
        
        {/* Edit/Remove Listing Buttons */}
        {hasProfile && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleEditListing}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Listing
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove Listing
            </Button>
          </div>
        )}
      </div>

      {/* Status Filter and Refresh */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          {(['pending', 'accepted', 'rejected'] as const).map((status) => (
            <Button
              key={status}
              variant={selectedStatus === status ? 'default' : 'outline'}
              onClick={() => setSelectedStatus(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Leads List */}
      {isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading leads...</p>
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No {selectedStatus} leads
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {selectedStatus === 'pending' 
                ? 'New applications will appear here.'
                : `No ${selectedStatus} applications found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {leads.map((lead, idx) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                          {lead.borrowerName}
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {new Date(lead.createdAt?.toDate?.() || lead.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(lead.status)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Mail className="w-4 h-4" />
                      <span>{lead.borrowerEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Phone className="w-4 h-4" />
                      <span>{lead.borrowerPhone}</span>
                    </div>
                    {lead.borrowerNRC && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <FileText className="w-4 h-4" />
                        <span>NRC: {lead.borrowerNRC}</span>
                      </div>
                    )}
                  </div>

                  {/* Loan Details */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Loan Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(lead.loanAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Term</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {lead.preferredTermMonths} months
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Purpose</span>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {lead.loanPurpose}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {lead.status === 'pending' && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          // TODO: Implement reject functionality
                          toast('Reject functionality coming soon', { icon: 'ℹ️' });
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                        onClick={() => handleAcceptLead(lead)}
                        disabled={acceptingLeadId === lead.id}
                      >
                        {acceptingLeadId === lead.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Accept
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateMarketplaceProfileWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setEditingProfile(null);
          }
        }}
        initialValues={editingProfile}
        onSuccess={() => {
          // Invalidate all marketplace-related queries to refresh both admin and public pages
          queryClient.invalidateQueries({ queryKey: ['marketplaceProfile'] });
          queryClient.invalidateQueries({ queryKey: ['marketplaceProfiles'] }); // Public "Find a Lender" page query
          queryClient.invalidateQueries({ queryKey: ['marketplaceLeads'] });
          setEditingProfile(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Marketplace Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your listing? Borrowers will no longer see you on the marketplace.
              This action cannot be undone, but you can create a new listing anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveListing}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
