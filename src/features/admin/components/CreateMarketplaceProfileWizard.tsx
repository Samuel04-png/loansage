/**
 * Marketplace Profile Creation Wizard
 * Multi-step form for agencies to create their public marketplace listing
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Building2,
  DollarSign,
  Calendar,
  FileCheck,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Loan types
const LOAN_TYPES = [
  { id: 'personal', label: 'Personal Loan' },
  { id: 'business', label: 'Business Loan' },
  { id: 'sme', label: 'SME Loan' },
  { id: 'civil_servant', label: 'Civil Servant Loan' },
  { id: 'agricultural', label: 'Agricultural Loan' },
  { id: 'education', label: 'Education Loan' },
] as const;

// Requirements checklist
const REQUIREMENTS = [
  { id: 'payslip', label: 'Payslip Required' },
  { id: 'collateral', label: 'Collateral Required' },
  { id: 'id', label: 'ID Required' },
  { id: 'proof_of_residence', label: 'Proof of Residence Required' },
  { id: 'bank_statement', label: 'Bank Statement Required' },
  { id: 'business_registration', label: 'Business Registration Required' },
] as const;

// Step 1: Identity Schema
const identitySchema = z.object({
  agencyName: z.string().min(2, 'Agency name is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  logoUrl: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Invalid URL').optional()
  ),
  websiteUrl: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Invalid URL').optional()
  ),
  contactEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().email('Invalid email').optional()
  ),
  contactPhone: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(10, 'Phone number must be at least 10 characters').optional()
  ),
});

// Step 2: Loan Configuration Schema
const loanConfigSchema = z.object({
  loanTypes: z.array(z.string()).min(1, 'Select at least one loan type'),
  minInterestRate: z.number().min(0).max(100),
  maxInterestRate: z.number().min(0).max(100),
  minLoanAmount: z.number().min(100, 'Minimum amount must be at least 100 ZMW'),
  maxLoanAmount: z.number().min(100, 'Maximum amount must be at least 100 ZMW'),
  minTermMonths: z.number().min(1, 'Minimum term must be at least 1 month'),
  maxTermMonths: z.number().min(1, 'Maximum term must be at least 1 month'),
  requirements: z.array(z.string()).optional(),
}).refine((data) => data.maxInterestRate >= data.minInterestRate, {
  message: 'Maximum interest rate must be greater than or equal to minimum',
  path: ['maxInterestRate'],
}).refine((data) => data.maxLoanAmount >= data.minLoanAmount, {
  message: 'Maximum loan amount must be greater than or equal to minimum',
  path: ['maxLoanAmount'],
}).refine((data) => data.maxTermMonths >= data.minTermMonths, {
  message: 'Maximum term must be greater than or equal to minimum',
  path: ['maxTermMonths'],
});

type IdentityFormData = z.infer<typeof identitySchema>;
type LoanConfigFormData = z.infer<typeof loanConfigSchema>;

interface CreateMarketplaceProfileWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateMarketplaceProfileWizard({
  open,
  onOpenChange,
  onSuccess,
}: CreateMarketplaceProfileWizardProps) {
  const { profile } = useAuth();
  const { agency } = useAgency();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const identityForm = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      agencyName: agency?.name || '',
      description: agency?.description || '',
      logoUrl: agency?.logoURL || '',
      websiteUrl: '',
      contactEmail: agency?.email || '',
      contactPhone: agency?.phone || '',
    },
  });

  const loanConfigForm = useForm<LoanConfigFormData>({
    resolver: zodResolver(loanConfigSchema),
    defaultValues: {
      loanTypes: [],
      minInterestRate: 10,
      maxInterestRate: 30,
      minLoanAmount: 1000,
      maxLoanAmount: 100000,
      minTermMonths: 3,
      maxTermMonths: 36,
      requirements: [],
    },
  });

  const upsertMarketplaceProfile = httpsCallable(functions, 'upsertMarketplaceProfile');

  const handleLogoUrlChange = (url: string) => {
    identityForm.setValue('logoUrl', url);
    setLogoPreview(url);
  };

  const handleNext = async () => {
    if (step === 1) {
      // Trigger validation on all fields
      const result = await identityForm.trigger();
      
      if (!result) {
        // Get all errors
        const errors = identityForm.formState.errors;
        console.log('Form validation errors:', errors);
        
        // Show first error to user
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          const firstErrorField = errorFields[0];
          const firstError = errors[firstErrorField as keyof typeof errors];
          if (firstError?.message) {
            toast.error(firstError.message);
          } else {
            toast.error(`Please fix the ${firstErrorField} field`);
          }
        } else {
          toast.error('Please fill in all required fields correctly');
        }
        return;
      }
      
      // Validation passed, move to next step
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    const isValid = await loanConfigForm.trigger();
    if (!isValid) return;

    if (!profile?.agency_id) {
      toast.error('Agency ID not found');
      return;
    }

    setIsSubmitting(true);

    try {
      const identityData = identityForm.getValues();
      const loanData = loanConfigForm.getValues();

      const result = await upsertMarketplaceProfile({
        agencyId: profile.agency_id,
        agencyName: identityData.agencyName,
        description: identityData.description,
        logoUrl: identityData.logoUrl || undefined,
        websiteUrl: identityData.websiteUrl || undefined,
        contactEmail: identityData.contactEmail || undefined,
        contactPhone: identityData.contactPhone || undefined,
        minInterestRate: loanData.minInterestRate,
        maxInterestRate: loanData.maxInterestRate,
        minLoanAmount: loanData.minLoanAmount,
        maxLoanAmount: loanData.maxLoanAmount,
        minTermMonths: loanData.minTermMonths,
        maxTermMonths: loanData.maxTermMonths,
        loanTypes: loanData.loanTypes,
        requirements: loanData.requirements || [],
        isActive: true, // Make it visible immediately
      });

      if ((result.data as { success: boolean }).success) {
        toast.success('Marketplace profile created successfully!');
        onSuccess?.();
        onOpenChange(false);
        // Reset forms
        setStep(1);
        identityForm.reset();
        loanConfigForm.reset();
        setLogoPreview('');
      }
    } catch (error: any) {
      console.error('Error creating marketplace profile:', error);
      toast.error(error.message || 'Failed to create marketplace profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
            Create Public Listing
          </DialogTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Step {step} of 2: {step === 1 ? 'Agency Identity' : 'Loan Configuration'}
          </p>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
          <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Agency Identity
                </h3>

                <div>
                  <Label htmlFor="agencyName">Display Name *</Label>
                  <Input
                    id="agencyName"
                    {...identityForm.register('agencyName')}
                    placeholder="Your Agency Name"
                    className="mt-1"
                  />
                  {identityForm.formState.errors.agencyName && (
                    <p className="text-sm text-red-500 mt-1">
                      {identityForm.formState.errors.agencyName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">About Us *</Label>
                  <Textarea
                    id="description"
                    {...identityForm.register('description')}
                    placeholder="Describe your lending services, values, and what makes you different..."
                    rows={4}
                    className="mt-1"
                  />
                  {identityForm.formState.errors.description && (
                    <p className="text-sm text-red-500 mt-1">
                      {identityForm.formState.errors.description.message}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum 20 characters. This will be visible to borrowers.
                  </p>
                </div>

                <div>
                  <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
                  <div className="flex gap-3 mt-1">
                    <Input
                      id="logoUrl"
                      {...identityForm.register('logoUrl')}
                      placeholder="https://example.com/logo.png"
                      className="flex-1"
                    />
                    {logoPreview && (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-16 h-16 rounded-lg object-cover border-2 border-slate-200 dark:border-slate-700"
                          onError={() => setLogoPreview('')}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            identityForm.setValue('logoUrl', '');
                            setLogoPreview('');
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {identityForm.watch('logoUrl') && !logoPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleLogoUrlChange(identityForm.watch('logoUrl') || '')}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Preview Logo
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email (Optional)</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      {...identityForm.register('contactEmail')}
                      placeholder="contact@agency.com"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactPhone">Contact Phone (Optional)</Label>
                    <Input
                      id="contactPhone"
                      {...identityForm.register('contactPhone')}
                      placeholder="+260 97X XXX XXX"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="websiteUrl">Website URL (Optional)</Label>
                  <Input
                    id="websiteUrl"
                    {...identityForm.register('websiteUrl')}
                    placeholder="https://yourwebsite.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Loan Configuration
                </h3>

                {/* Loan Types */}
                <div>
                  <Label>Loan Types Offered *</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {LOAN_TYPES.map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={type.id}
                          checked={loanConfigForm.watch('loanTypes').includes(type.id)}
                          onCheckedChange={(checked) => {
                            const current = loanConfigForm.getValues('loanTypes');
                            if (checked) {
                              loanConfigForm.setValue('loanTypes', [...current, type.id]);
                            } else {
                              loanConfigForm.setValue('loanTypes', current.filter((t) => t !== type.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={type.id}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {loanConfigForm.formState.errors.loanTypes && (
                    <p className="text-sm text-red-500 mt-1">
                      {loanConfigForm.formState.errors.loanTypes.message}
                    </p>
                  )}
                </div>

                {/* Interest Rate Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minInterestRate">Min Interest Rate (%) *</Label>
                    <Input
                      id="minInterestRate"
                      type="number"
                      step="0.1"
                      {...loanConfigForm.register('minInterestRate', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.minInterestRate && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.minInterestRate.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="maxInterestRate">Max Interest Rate (%) *</Label>
                    <Input
                      id="maxInterestRate"
                      type="number"
                      step="0.1"
                      {...loanConfigForm.register('maxInterestRate', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.maxInterestRate && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.maxInterestRate.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Loan Amount Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minLoanAmount">Min Loan Amount (ZMW) *</Label>
                    <Input
                      id="minLoanAmount"
                      type="number"
                      {...loanConfigForm.register('minLoanAmount', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.minLoanAmount && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.minLoanAmount.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="maxLoanAmount">Max Loan Amount (ZMW) *</Label>
                    <Input
                      id="maxLoanAmount"
                      type="number"
                      {...loanConfigForm.register('maxLoanAmount', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.maxLoanAmount && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.maxLoanAmount.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Term Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minTermMonths">Min Term (Months) *</Label>
                    <Input
                      id="minTermMonths"
                      type="number"
                      {...loanConfigForm.register('minTermMonths', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.minTermMonths && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.minTermMonths.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="maxTermMonths">Max Term (Months) *</Label>
                    <Input
                      id="maxTermMonths"
                      type="number"
                      {...loanConfigForm.register('maxTermMonths', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {loanConfigForm.formState.errors.maxTermMonths && (
                      <p className="text-sm text-red-500 mt-1">
                        {loanConfigForm.formState.errors.maxTermMonths.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Requirements */}
                <div>
                  <Label>Requirements Checklist (Optional)</Label>
                  <p className="text-xs text-slate-500 mb-2">
                    Select the documents/requirements borrowers must provide
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {REQUIREMENTS.map((req) => (
                      <div key={req.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={req.id}
                          checked={loanConfigForm.watch('requirements')?.includes(req.id) || false}
                          onCheckedChange={(checked) => {
                            const current = loanConfigForm.getValues('requirements') || [];
                            if (checked) {
                              loanConfigForm.setValue('requirements', [...current, req.id]);
                            } else {
                              loanConfigForm.setValue('requirements', current.filter((r) => r !== req.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={req.id}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {req.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Publish Listing
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
