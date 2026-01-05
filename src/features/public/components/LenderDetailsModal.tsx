/**
 * Lender Details Modal
 * Shows detailed information about a lender when user clicks on a card
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { 
  Building2,
  Star,
  Shield,
  Mail,
  Phone,
  Globe,
  Percent,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle2,
  ArrowRight,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../../lib/utils';
import { MarketplaceApplicationModal } from './MarketplaceApplicationModal';

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

interface LenderDetailsModalProps {
  lender: MarketplaceProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal Loan',
  business: 'Business Loan',
  sme: 'SME Loan',
  civil_servant: 'Civil Servant Loan',
  agricultural: 'Agricultural Loan',
  education: 'Education Loan',
};

const REQUIREMENT_LABELS: Record<string, string> = {
  payslip: 'Payslip',
  collateral: 'Collateral',
  id: 'ID Document',
  proof_of_residence: 'Proof of Residence',
  bank_statement: 'Bank Statement',
  business_registration: 'Business Registration',
};

export function LenderDetailsModal({ lender, open, onOpenChange }: LenderDetailsModalProps) {
  const [showApplicationModal, setShowApplicationModal] = useState(false);

  if (!lender) return null;

  const getTrustBadgeColor = (badge: string | null) => {
    switch (badge) {
      case 'enterprise':
        return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0';
      case 'professional':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-4">
              {lender.logoUrl ? (
                <img
                  src={lender.logoUrl}
                  alt={lender.agencyName}
                  className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-10 h-10 text-white dark:text-slate-900" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {lender.agencyName}
                </DialogTitle>
                {lender.trustBadge && (
                  <Badge className={`text-xs font-medium ${getTrustBadgeColor(lender.trustBadge)}`}>
                    {lender.trustBadge === 'enterprise' && <Star className="w-3 h-3 mr-1 fill-current" />}
                    {lender.trustBadge === 'professional' && <Shield className="w-3 h-3 mr-1" />}
                    {lender.trustBadge.charAt(0).toUpperCase() + lender.trustBadge.slice(1)} Verified
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="products" className="rounded-lg">Loan Products</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-lg">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {lender.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">About Us</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {lender.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    {lender.contactEmail && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Mail className="w-4 h-4" />
                        <span>{lender.contactEmail}</span>
                      </div>
                    )}
                    {lender.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Phone className="w-4 h-4" />
                        <span>{lender.contactPhone}</span>
                      </div>
                    )}
                    {lender.websiteUrl && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Globe className="w-4 h-4" />
                        <a 
                          href={lender.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          Visit Website
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Loan Overview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Interest Rate</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {lender.minInterestRate}% - {lender.maxInterestRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Loan Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(lender.minLoanAmount)} - {formatCurrency(lender.maxLoanAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Term</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {lender.minTermMonths} - {lender.maxTermMonths} months
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Available Loan Types</h3>
                {lender.loanTypes && lender.loanTypes.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {lender.loanTypes.map((type) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-slate-900 dark:text-white">
                          {LOAN_TYPE_LABELS[type] || type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No specific loan types listed.</p>
                )}
              </div>

              {lender.requirements && lender.requirements.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Required Documents</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {lender.requirements.map((req) => (
                      <div
                        key={req}
                        className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      >
                        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm text-slate-900 dark:text-white">
                          {REQUIREMENT_LABELS[req] || req}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4 mt-4">
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Reviews coming soon. Be the first to review this lender!
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Sticky Footer with Apply Button */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 -mx-6 px-6 py-4 mt-6">
            <Button
              onClick={() => {
                setShowApplicationModal(true);
                onOpenChange(false);
              }}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              Start Application
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showApplicationModal && lender && (
        <MarketplaceApplicationModal
          lender={lender}
          onClose={() => {
            setShowApplicationModal(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
