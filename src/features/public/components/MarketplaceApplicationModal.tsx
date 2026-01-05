/**
 * Marketplace Application Modal
 * Form for borrowers to submit loan applications
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// Requirements mapping
const REQUIREMENT_LABELS: Record<string, string> = {
  payslip: 'Payslip',
  collateral: 'Collateral Details',
  id: 'ID Document',
  proof_of_residence: 'Proof of Residence',
  bank_statement: 'Bank Statement',
  business_registration: 'Business Registration',
};

const applicationSchema = z.object({
  borrowerName: z.string().min(2, 'Name must be at least 2 characters'),
  borrowerEmail: z.string().email('Invalid email address'),
  borrowerPhone: z.string().min(10, 'Phone number is required'),
  borrowerNRC: z.string().optional(),
  loanAmount: z.number().min(100, 'Minimum loan amount is 100 ZMW'),
  loanPurpose: z.string().min(10, 'Please describe your loan purpose'),
  preferredTermMonths: z.number().min(3, 'Minimum term is 3 months'),
  // Dynamic requirements validation
  requirements: z.record(z.boolean()).optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface MarketplaceApplicationModalProps {
  lender: {
    id: string;
    agencyId: string;
    agencyName: string;
    minLoanAmount: number;
    maxLoanAmount: number;
    minTermMonths: number;
    maxTermMonths: number;
    requirements?: string[];
  };
  onClose: () => void;
}

export function MarketplaceApplicationModal({ lender, onClose }: MarketplaceApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      preferredTermMonths: lender.minTermMonths,
      requirements: {},
    },
  });

  const requirements = lender.requirements || [];
  const requirementValues = watch('requirements') || {};

  const submitMarketplaceApplication = httpsCallable(functions, 'submitMarketplaceApplication');

  const onSubmit = async (data: ApplicationFormData) => {
    // Validate against lender limits
    if (data.loanAmount < lender.minLoanAmount || data.loanAmount > lender.maxLoanAmount) {
      toast.error(
        `Loan amount must be between ${lender.minLoanAmount.toLocaleString()} and ${lender.maxLoanAmount.toLocaleString()} ZMW`
      );
      return;
    }

    if (data.preferredTermMonths < lender.minTermMonths || data.preferredTermMonths > lender.maxTermMonths) {
      toast.error(
        `Loan term must be between ${lender.minTermMonths} and ${lender.maxTermMonths} months`
      );
      return;
    }

    // Validate required documents
    const missingRequirements = requirements.filter(
      (req) => !requirementValues[req] || requirementValues[req] === false
    );
    if (missingRequirements.length > 0) {
      toast.error(
        `Please confirm that you have the following: ${missingRequirements.map(r => REQUIREMENT_LABELS[r] || r).join(', ')}`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitMarketplaceApplication({
        ...data,
        targetAgencyId: lender.agencyId,
      });

      if ((result.data as { success: boolean }).success) {
        setIsSuccess(true);
        toast.success('Application submitted successfully!');
        
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Application Submitted!
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Your application has been sent to <strong>{lender.agencyName}</strong>. 
              They will review it and contact you soon.
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white">
              Close
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
            Apply to {lender.agencyName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Personal Information
            </h3>

            <div>
              <Label htmlFor="borrowerName">Full Name *</Label>
              <Input
                id="borrowerName"
                {...register('borrowerName')}
                placeholder="John Doe"
                className="mt-1"
              />
              {errors.borrowerName && (
                <p className="text-sm text-red-500 mt-1">{errors.borrowerName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="borrowerEmail">Email Address *</Label>
              <Input
                id="borrowerEmail"
                type="email"
                {...register('borrowerEmail')}
                placeholder="john@example.com"
                className="mt-1"
              />
              {errors.borrowerEmail && (
                <p className="text-sm text-red-500 mt-1">{errors.borrowerEmail.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="borrowerPhone">Phone Number *</Label>
              <Input
                id="borrowerPhone"
                {...register('borrowerPhone')}
                placeholder="+260 97X XXX XXX"
                className="mt-1"
              />
              {errors.borrowerPhone && (
                <p className="text-sm text-red-500 mt-1">{errors.borrowerPhone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="borrowerNRC">NRC Number (Optional)</Label>
              <Input
                id="borrowerNRC"
                {...register('borrowerNRC')}
                placeholder="123456/78/9"
                className="mt-1"
              />
            </div>
          </div>

          {/* Loan Details */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Loan Details
            </h3>

            <div>
              <Label htmlFor="loanAmount">
                Loan Amount (ZMW) * 
                <span className="text-xs text-slate-500 ml-2">
                  ({lender.minLoanAmount.toLocaleString()} - {lender.maxLoanAmount.toLocaleString()})
                </span>
              </Label>
              <Input
                id="loanAmount"
                type="number"
                {...register('loanAmount', { valueAsNumber: true })}
                placeholder="10000"
                min={lender.minLoanAmount}
                max={lender.maxLoanAmount}
                className="mt-1"
              />
              {errors.loanAmount && (
                <p className="text-sm text-red-500 mt-1">{errors.loanAmount.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="preferredTermMonths">
                Preferred Term (Months) *
                <span className="text-xs text-slate-500 ml-2">
                  ({lender.minTermMonths} - {lender.maxTermMonths})
                </span>
              </Label>
              <Input
                id="preferredTermMonths"
                type="number"
                {...register('preferredTermMonths', { valueAsNumber: true })}
                min={lender.minTermMonths}
                max={lender.maxTermMonths}
                className="mt-1"
              />
              {errors.preferredTermMonths && (
                <p className="text-sm text-red-500 mt-1">{errors.preferredTermMonths.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="loanPurpose">Loan Purpose *</Label>
              <Textarea
                id="loanPurpose"
                {...register('loanPurpose')}
                placeholder="Describe what you need the loan for..."
                rows={4}
                className="mt-1"
              />
              {errors.loanPurpose && (
                <p className="text-sm text-red-500 mt-1">{errors.loanPurpose.message}</p>
              )}
            </div>
          </div>

          {/* Requirements Section */}
          {requirements.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                    Required Documents
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    Please confirm that you have the following documents ready:
                  </p>
                  <div className="space-y-2">
                    {requirements.map((req) => (
                      <div key={req} className="flex items-center space-x-2">
                        <Checkbox
                          id={req}
                          checked={requirementValues[req] || false}
                          onCheckedChange={(checked) => {
                            setValue(`requirements.${req}`, checked === true, { shouldValidate: true });
                          }}
                        />
                        <Label
                          htmlFor={req}
                          className="text-sm font-normal cursor-pointer flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-slate-400" />
                          {REQUIREMENT_LABELS[req] || req.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
