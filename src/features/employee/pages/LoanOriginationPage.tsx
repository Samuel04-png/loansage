import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/firebase/storage';
import { generateCustomerId } from '../../../lib/firebase/helpers';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  Calendar,
  ShieldAlert,
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
  Search,
  Plus,
  X,
  Image as ImageIcon,
  Building2,
  Briefcase,
  Sprout,
  Car,
  Home,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { analyzeLoanRisk } from '../../../services/aiService';
import { motion, AnimatePresence } from 'framer-motion';
import { getEnabledLoanTypes, getLoanTypeTemplate, getLoanTypeConfig } from '../../../lib/firebase/loan-type-config';
import { useAgency } from '../../../hooks/useAgency';
import { getLoanTypeIcon } from '../../../lib/loan-type-icons';
import type { LoanTypeConfig, LoanTypeId, LoanStep } from '../../../types/loan-config';
import { buildLoanFlow, getNextStepId, getPreviousStepId, getStepIndex } from '../../../lib/loan-flow/flow-engine';
import { shouldRenderCollateral, shouldRenderEmployment, shouldRenderBusiness, shouldRenderGuarantor } from '../../../lib/loan-type/rules';

// Form schemas
const borrowerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Phone number is required'),
  nrcNumber: z.string().min(6, 'NRC number is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  address: z.string().min(5, 'Address is required'),
});

const loanTermsSchema = z.object({
  amount: z.number().min(100, 'Minimum amount is 100'),
  currency: z.string().default('ZMW'),
  interestRate: z.number().min(0).max(100),
  durationMonths: z.number().min(1).max(120),
  repaymentFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
});

type BorrowerFormData = z.infer<typeof borrowerSchema>;
type LoanTermsFormData = z.infer<typeof loanTermsSchema>;

export function LoanOriginationPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { agency } = useAgency();
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loanType, setLoanType] = useState<LoanTypeId | ''>('');
  const [collateral, setCollateral] = useState<any[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Fetch enabled loan types for this agency
  const { data: enabledLoanTypes = [], isLoading: loadingLoanTypes } = useQuery({
    queryKey: ['enabledLoanTypes', agency?.id],
    queryFn: async () => {
      if (!agency?.id) return [];
      return await getEnabledLoanTypes(agency.id);
    },
    enabled: !!agency?.id,
  });

  // Get current loan type configuration
  const currentLoanTypeConfig = enabledLoanTypes.find(lt => lt.id === loanType);

  // Get loan type template and build flow
  const loanTypeTemplate = loanType ? getLoanTypeTemplate(loanType) : null;
  const loanFlowSteps = loanTypeTemplate && currentLoanTypeConfig 
    ? buildLoanFlow(loanTypeTemplate, currentLoanTypeConfig)
    : [];

  // Determine if collateral is needed based on loan type config
  const needsCollateral = currentLoanTypeConfig 
    ? currentLoanTypeConfig.collateralRequirement === 'required' || 
      (loanTypeTemplate?.rules?.requiresCollateral === true)
    : false;

  // Get current step ID from flow
  const currentStepId = loanFlowSteps.length > 0 && step > 0 && step <= loanFlowSteps.length
    ? loanFlowSteps[step - 1]?.id
    : null;

  // Calculate total steps from flow
  const totalSteps = loanFlowSteps.length || 7; // Fallback to 7 if no flow

  // Step 1: Customer search
  const { data: customers } = useQuery({
    queryKey: ['customers', profile?.agency_id, searchTerm],
    queryFn: async () => {
      if (!profile?.agency_id || !searchTerm) return [];

      // For Firebase, we need to query differently
      // Since Firestore doesn't support complex joins like Supabase, we'll search customers directly
      const result = await new Promise<any>((resolve, reject) => {
        supabase
          .from('customers')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .or(`customer_id.ilike.%${searchTerm}%,nrc_number.ilike.%${searchTerm}%`)
          .limit(10)
          .then(
            (res: any) => {
              if (res.error) reject(res.error);
              else resolve(res.data || []);
            },
            (err: any) => reject(err)
          );
      });

      // Fetch user data separately for each customer
      const customersWithUsers = await Promise.all(
        (result || []).map(async (cust: any) => {
          if (cust.user_id) {
            const userResult = await new Promise<any>((resolve, reject) => {
              supabase
                .from('users')
                .select('email, full_name, phone')
                .eq('id', cust.user_id)
                .single()
                .then(
                  (res: any) => {
                    if (res.error) resolve(null);
                    else resolve(res.data);
                  },
                  () => resolve(null)
                );
            });
            return { ...cust, users: userResult };
          }
          return cust;
        })
      );
      return customersWithUsers;
    },
    enabled: !!profile?.agency_id && searchTerm.length > 2,
  });

  const borrowerForm = useForm<BorrowerFormData>({
    resolver: zodResolver(borrowerSchema),
  });

  const loanTermsForm = useForm<LoanTermsFormData>({
    resolver: zodResolver(loanTermsSchema),
    defaultValues: {
      currency: 'ZMW',
      interestRate: 15,
      durationMonths: 12,
      repaymentFrequency: 'monthly',
    },
  });

  // Update form defaults and add dynamic validation when loan type changes
  useEffect(() => {
    if (currentLoanTypeConfig) {
      loanTermsForm.setValue('interestRate', currentLoanTypeConfig.interestRate.default);
      loanTermsForm.setValue('durationMonths', currentLoanTypeConfig.duration.defaultMonths || 12);
      loanTermsForm.setValue('repaymentFrequency', currentLoanTypeConfig.repaymentFrequency[0] as any);
    }
  }, [loanType, currentLoanTypeConfig]);

  // Dynamic validation function
  const validateLoanTerms = (data: LoanTermsFormData): boolean => {
    if (!currentLoanTypeConfig) {
      return true; // Fallback to schema validation
    }

    const errors: string[] = [];

    if (data.amount < currentLoanTypeConfig.loanAmount.min) {
      errors.push(`Amount must be at least ${currentLoanTypeConfig.loanAmount.min.toLocaleString()}`);
    }
    if (data.amount > currentLoanTypeConfig.loanAmount.max) {
      errors.push(`Amount cannot exceed ${currentLoanTypeConfig.loanAmount.max.toLocaleString()}`);
    }
    if (data.interestRate < currentLoanTypeConfig.interestRate.min) {
      errors.push(`Interest rate must be at least ${currentLoanTypeConfig.interestRate.min}%`);
    }
    if (data.interestRate > currentLoanTypeConfig.interestRate.max) {
      errors.push(`Interest rate cannot exceed ${currentLoanTypeConfig.interestRate.max}%`);
    }
    if (data.durationMonths < currentLoanTypeConfig.duration.minMonths) {
      errors.push(`Duration must be at least ${currentLoanTypeConfig.duration.minMonths} months`);
    }
    if (data.durationMonths > currentLoanTypeConfig.duration.maxMonths) {
      errors.push(`Duration cannot exceed ${currentLoanTypeConfig.duration.maxMonths} months`);
    }
    if (!currentLoanTypeConfig.repaymentFrequency.includes(data.repaymentFrequency)) {
      errors.push(`Repayment frequency must be one of: ${currentLoanTypeConfig.repaymentFrequency.join(', ')}`);
    }

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return false;
    }

    return true;
  };

  const createLoan = useMutation({
    mutationFn: async (loanData: any) => {
      if (!profile?.agency_id) throw new Error('Not authenticated');

      const result = await new Promise<any>((resolve, reject) => {
        supabase
          .from('loans')
          .insert({
            ...loanData,
            agency_id: profile.agency_id,
            status: 'draft', // Create in DRAFT status - must be submitted separately
            created_by: profile.id,
          })
          .select('*')
          .single()
          .then(
            (res: any) => {
              if (res.error) reject(res.error);
              else resolve(res.data);
            },
            (err: any) => reject(err)
          );
      });

      return result;
    },
    onSuccess: (data) => {
      toast.success('Loan application created as draft! You can submit it for review when ready.');
      // Optionally navigate to loan detail page or stay on form
      navigate(`/employee/loans/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit loan');
    },
  });

  const handleNext = () => {
    if (currentStepId && loanFlowSteps.length > 0) {
      const nextStepId = getNextStepId(loanFlowSteps, currentStepId);
      if (nextStepId) {
        const nextIndex = getStepIndex(loanFlowSteps, nextStepId);
        if (nextIndex !== -1) {
          setStep(nextIndex + 1);
        }
      }
    } else if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (currentStepId && loanFlowSteps.length > 0) {
      const prevStepId = getPreviousStepId(loanFlowSteps, currentStepId);
      if (prevStepId) {
        const prevIndex = getStepIndex(loanFlowSteps, prevStepId);
        if (prevIndex !== -1) {
          setStep(prevIndex + 1);
        }
      }
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!selectedCustomer && !borrowerForm.formState.isValid) {
      toast.error('Please complete borrower information');
      setStep(2);
      return;
    }
    if (!loanType) {
      toast.error('Please select a loan type');
      setStep(3);
      return;
    }
    if (!loanTermsForm.formState.isValid) {
      toast.error('Please complete loan terms');
      setStep(4);
      return;
    }

    // Upload documents if any
    let uploadedDocUrls: string[] = [];
    if (documents.length > 0) {
      setUploadingDocs(true);
      try {
        const uploadPromises = documents.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${profile?.id}/${Date.now()}-${file.name}`;
          const uploadResult = await storageService.upload('documents', fileName, file);

          if (uploadResult.error) throw uploadResult.error;

          const urlResult = storageService.getPublicUrl('documents', fileName);

          return urlResult.publicUrl || '';
        });

        uploadedDocUrls = await Promise.all(uploadPromises);
        setDocumentUrls(uploadedDocUrls);
      } catch (error: any) {
        toast.error('Failed to upload documents: ' + error.message);
        setUploadingDocs(false);
        return;
      } finally {
        setUploadingDocs(false);
      }
    }

    // Create customer if new
    let customerId = selectedCustomer?.id;
    if (!selectedCustomer) {
      try {
        // Create user first
        const userResult = await new Promise<any>((resolve, reject) => {
          supabase
            .from('users')
            .insert({
              email: borrowerForm.getValues('email'),
              full_name: borrowerForm.getValues('fullName'),
              phone: borrowerForm.getValues('phone'),
              role: 'customer',
            })
            .select('*')
            .single()
            .then(
              (res: any) => {
                if (res.error) reject(res.error);
                else resolve(res.data);
              },
              (err: any) => reject(err)
            );
        });

        // Generate customer ID using helper function
        const customerIdData = await generateCustomerId(profile?.agency_id || '');

        // Create customer
        const customerResult = await new Promise<any>((resolve, reject) => {
          supabase
            .from('customers')
            .insert({
              user_id: userResult.id,
              agency_id: profile?.agency_id,
              customer_id: customerIdData || `CUST-${Date.now()}`,
              nrc_number: borrowerForm.getValues('nrcNumber'),
              date_of_birth: borrowerForm.getValues('dateOfBirth'),
              address: borrowerForm.getValues('address'),
            })
            .select('*')
            .single()
            .then(
              (res: any) => {
                if (res.error) reject(res.error);
                else resolve(res.data);
              },
              (err: any) => reject(err)
            );
        });
        customerId = customerResult.id;
      } catch (error: any) {
        toast.error('Failed to create customer: ' + error.message);
        return;
      }
    }

    // Create collateral records
    let collateralIds: string[] = [];
    if (collateral.length > 0) {
      try {
        const collateralPromises = collateral.map(async (item) => {
          const result = await new Promise<any>((resolve, reject) => {
            supabase
              .from('collateral')
              .insert({
                agency_id: profile?.agency_id,
                type: item.type,
                description: item.description,
                estimated_value: item.estimated_value,
                currency: item.currency || 'ZMW',
              })
              .select('*')
              .single()
              .then(
                (res: any) => {
                  if (res.error) reject(res.error);
                  else resolve(res.data);
                },
                (err: any) => reject(err)
              );
          });
          return result.id;
        });

        collateralIds = await Promise.all(collateralPromises);
      } catch (error: any) {
        toast.error('Failed to save collateral: ' + error.message);
        return;
      }
    }

    const loanData = {
      customer_id: customerId,
      loan_type: loanType,
      amount: loanTermsForm.getValues('amount'),
      currency: loanTermsForm.getValues('currency'),
      interest_rate: loanTermsForm.getValues('interestRate'),
      duration_months: loanTermsForm.getValues('durationMonths'),
      repayment_frequency: loanTermsForm.getValues('repaymentFrequency'),
      collateral_ids: collateralIds,
      document_urls: uploadedDocUrls,
      ai_analysis: aiAnalysis,
    };

    createLoan.mutate(loanData);
  };

  const runRiskAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeLoanRisk(
        {
          amount: loanTermsForm.getValues('amount'),
          currency: loanTermsForm.getValues('currency'),
          interestRate: loanTermsForm.getValues('interestRate'),
          durationMonths: loanTermsForm.getValues('durationMonths'),
          collateral: collateral,
          loanType: loanType,
          loan_type: loanType, // For compatibility
        } as any,
        {
          name: selectedCustomer?.users?.full_name || borrowerForm.getValues('fullName'),
          riskScore: selectedCustomer?.risk_score || 70,
          nrcNumber: selectedCustomer?.nrc_number || borrowerForm.getValues('nrcNumber'),
        } as any
      );
      setAiAnalysis(analysis);
    } catch (error) {
      toast.error('Failed to analyze risk');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Map step IDs to step info
  const getStepInfoById = (stepId: string) => {
    const stepInfoMap: Record<string, { icon: JSX.Element; title: string }> = {
      borrower: { icon: <User className="w-4 h-4" />, title: 'Borrower Information' },
      terms: { icon: <DollarSign className="w-4 h-4" />, title: 'Loan Terms' },
      collateral: { icon: <ShieldAlert className="w-4 h-4" />, title: 'Collateral' },
      collateral_valuation: { icon: <ShieldAlert className="w-4 h-4" />, title: 'Collateral Valuation' },
      employment: { icon: <Briefcase className="w-4 h-4" />, title: 'Employment Details' },
      business: { icon: <Building2 className="w-4 h-4" />, title: 'Business Information' },
      guarantor_optional: { icon: <User className="w-4 h-4" />, title: 'Guarantor (Optional)' },
      review: { icon: <CheckCircle2 className="w-4 h-4" />, title: 'Review & Submit' },
    };
    return stepInfoMap[stepId] || { icon: <FileText className="w-4 h-4" />, title: 'Step' };
  };

  // Get step info based on flow or fallback to step number
  const getStepInfo = (stepNum: number) => {
    if (currentStepId && loanFlowSteps.length > 0) {
      const stepIndex = stepNum - 1;
      if (stepIndex >= 0 && stepIndex < loanFlowSteps.length) {
        return getStepInfoById(loanFlowSteps[stepIndex].id);
      }
    }
    // Fallback to old logic
    const allSteps = [
      { icon: <Search className="w-4 h-4" />, title: 'Borrower Lookup' },
      { icon: <User className="w-4 h-4" />, title: 'Borrower KYC' },
      { icon: <FileText className="w-4 h-4" />, title: 'Loan Type' },
      { icon: <DollarSign className="w-4 h-4" />, title: 'Loan Terms' },
      { icon: <ShieldAlert className="w-4 h-4" />, title: 'Collateral' },
      { icon: <Upload className="w-4 h-4" />, title: 'Documents' },
      { icon: <ShieldAlert className="w-4 h-4" />, title: 'Risk Assessment' },
      { icon: <CheckCircle2 className="w-4 h-4" />, title: 'Preview & Submit' },
    ];
    return allSteps[stepNum - 1] || allSteps[0];
  };

  const currentStepInfo = getStepInfo(step);

  // Get current step ID from flow
  const getCurrentStepId = (): string | null => {
    if (loanFlowSteps.length > 0 && step > 0 && step <= loanFlowSteps.length) {
      return loanFlowSteps[step - 1].id;
    }
    return null;
  };

  const currentFlowStepId = getCurrentStepId();

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <Button variant="outline" onClick={() => navigate('/employee/loans')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Loans
        </Button>
        <Badge variant="outline" className="text-sm px-3 py-1">
          Step {step} of {totalSteps}
        </Badge>
      </motion.div>

      {/* Enhanced Progress indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card border rounded-lg p-4 mb-6"
      >
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {(loanFlowSteps.length > 0 ? loanFlowSteps : Array.from({ length: totalSteps }).map((_, i) => ({ id: `step${i + 1}` as any }))).map((flowStep: LoanStep | { id: string }, i) => {
            const stepId = 'id' in flowStep ? flowStep.id : flowStep.id;
            const stepInfo = getStepInfoById(stepId);
            const isOptional = 'optional' in flowStep ? flowStep.optional : false;
            const isSkippable = 'skippable' in flowStep ? flowStep.skippable : false;
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            
            return (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isCompleted || isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors relative z-10 flex-shrink-0"
                  title={stepInfo.title}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-xs">{stepNum}</span>
                  )}
                </motion.div>
                {(isOptional || isSkippable) && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {isOptional && 'Optional'}
                    {isSkippable && 'Skip'}
                  </Badge>
                )}
                {i < (loanFlowSteps.length > 0 ? loanFlowSteps.length : totalSteps) - 1 && (
                  <motion.div
                    initial={false}
                    animate={{
                      backgroundColor: isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    }}
                    className="flex-1 h-1 mx-2 rounded-full transition-colors"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-foreground">{currentStepInfo.title}</p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="shadow-lg border-2">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
              <CardTitle className="text-2xl flex items-center gap-2">
                {currentStepInfo.icon}
                {currentStepInfo.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
          {/* Step 1: Borrower Lookup */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, NRC, or customer ID..."
                  className="pl-10 h-12 text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <AnimatePresence>
                {customers && customers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 max-h-64 overflow-y-auto"
                  >
                    {customers.map((cust: any, idx: number) => (
                      <motion.div
                        key={cust.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCustomer?.id === cust.id
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary/20 shadow-md'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          borrowerForm.setValue('fullName', cust.users?.full_name || '');
                          borrowerForm.setValue('email', cust.users?.email || '');
                          borrowerForm.setValue('phone', cust.users?.phone || '');
                          borrowerForm.setValue('nrcNumber', cust.nrc_number || '');
                        }}
                      >
                        <div className="font-semibold text-foreground">{cust.users?.full_name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {cust.customer_id} • {cust.nrc_number}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {!selectedCustomer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t pt-4 mt-4"
                >
                  <p className="text-sm text-muted-foreground mb-4">Or create new customer:</p>
                  <Button variant="outline" onClick={() => setStep(2)} className="w-full md:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Customer
                  </Button>
                </motion.div>
              )}

              {selectedCustomer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        Selected: {selectedCustomer.users?.full_name}
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        {selectedCustomer.customer_id}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-emerald-700 dark:text-emerald-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 2: Borrower KYC */}
          {step === 2 && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={borrowerForm.handleSubmit(handleNext)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name *</Label>
                  <Input
                    id="fullName"
                    className="h-11"
                    placeholder="John Doe"
                    {...borrowerForm.register('fullName')}
                  />
                  {borrowerForm.formState.errors.fullName && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {borrowerForm.formState.errors.fullName.message}
                    </motion.p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nrcNumber" className="text-sm font-medium">NRC Number *</Label>
                  <Input
                    id="nrcNumber"
                    className="h-11"
                    placeholder="123456/78/9"
                    {...borrowerForm.register('nrcNumber')}
                  />
                  {borrowerForm.formState.errors.nrcNumber && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {borrowerForm.formState.errors.nrcNumber.message}
                    </motion.p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    className="h-11"
                    placeholder="john@example.com"
                    {...borrowerForm.register('email')}
                  />
                  {borrowerForm.formState.errors.email && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {borrowerForm.formState.errors.email.message}
                    </motion.p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone *</Label>
                  <Input
                    id="phone"
                    className="h-11"
                    placeholder="+260 123 456 789"
                    {...borrowerForm.register('phone')}
                  />
                  {borrowerForm.formState.errors.phone && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {borrowerForm.formState.errors.phone.message}
                    </motion.p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-sm font-medium">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="h-11"
                  {...borrowerForm.register('dateOfBirth')}
                />
                {borrowerForm.formState.errors.dateOfBirth && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-destructive flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {borrowerForm.formState.errors.dateOfBirth.message}
                  </motion.p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">Address *</Label>
                <Input
                  id="address"
                  className="h-11"
                  placeholder="Street address, City, Country"
                  {...borrowerForm.register('address')}
                />
                {borrowerForm.formState.errors.address && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-destructive flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {borrowerForm.formState.errors.address.message}
                  </motion.p>
                )}
              </div>
            </motion.form>
          )}

          {/* Step 3: Loan Type Selection */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div>
                <Label className="text-base font-semibold mb-2 block">Select Loan Type</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose the type of loan that best matches the borrower's needs
                </p>
              </div>
              {loadingLoanTypes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : enabledLoanTypes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">No loan types configured</p>
                  <p className="text-sm text-muted-foreground">
                    Please configure loan types in Settings → Loan Types
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enabledLoanTypes.map((loanTypeConfig, idx) => {
                    const isSelected = loanType === loanTypeConfig.id;
                    const Icon = getLoanTypeIcon(loanTypeConfig.id);
                    return (
                      <motion.button
                        key={loanTypeConfig.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setLoanType(loanTypeConfig.id)}
                        className={`p-6 border-2 rounded-xl text-left transition-all relative ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary/20 shadow-lg'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Icon className={`w-8 h-8 ${isSelected ? 'text-primary-600' : 'text-muted-foreground'}`} />
                          {loanTypeConfig.collateralRequirement === 'required' && (
                            <Badge variant="outline" className="text-xs">
                              Secured
                            </Badge>
                          )}
                          {loanTypeConfig.collateralRequirement === 'not_required' && (
                            <Badge variant="secondary" className="text-xs">
                              Unsecured
                            </Badge>
                          )}
                          {loanTypeConfig.collateralRequirement === 'conditional' && (
                            <Badge variant="outline" className="text-xs">
                              Conditional
                            </Badge>
                          )}
                        </div>
                        <div className="font-semibold text-foreground">{loanTypeConfig.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">{loanTypeConfig.description}</div>
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                          {formatCurrency(loanTypeConfig.loanAmount?.min || 0)} - {formatCurrency(loanTypeConfig.loanAmount?.max || 0)}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Loan Terms */}
          {step === 4 && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={loanTermsForm.handleSubmit((data) => {
                if (validateLoanTerms(data)) {
                  handleNext();
                }
              })}
              className="space-y-5"
            >
              {currentLoanTypeConfig && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {currentLoanTypeConfig.name} - Requirements
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 dark:text-blue-200">
                    <div>Amount: {currentLoanTypeConfig.loanAmount.min.toLocaleString()} - {currentLoanTypeConfig.loanAmount.max.toLocaleString()}</div>
                    <div>Interest: {currentLoanTypeConfig.interestRate.min}% - {currentLoanTypeConfig.interestRate.max}%</div>
                    <div>Duration: {currentLoanTypeConfig.duration.minMonths} - {currentLoanTypeConfig.duration.maxMonths} months</div>
                    <div>Frequency: {currentLoanTypeConfig.repaymentFrequency.join(', ')}</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Loan Amount (ZMW) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      className="pl-10 h-11"
                      placeholder="10000"
                      {...loanTermsForm.register('amount', { valueAsNumber: true })}
                    />
                  </div>
                  {loanTermsForm.formState.errors.amount && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {loanTermsForm.formState.errors.amount.message}
                    </motion.p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRate" className="text-sm font-medium">Interest Rate (%) *</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.1"
                    className="h-11"
                    placeholder="15.0"
                    {...loanTermsForm.register('interestRate', { valueAsNumber: true })}
                  />
                  {loanTermsForm.formState.errors.interestRate && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {loanTermsForm.formState.errors.interestRate.message}
                    </motion.p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationMonths" className="text-sm font-medium">Duration (Months) *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="durationMonths"
                      type="number"
                      className="pl-10 h-11"
                      placeholder="12"
                      {...loanTermsForm.register('durationMonths', { valueAsNumber: true })}
                    />
                  </div>
                  {loanTermsForm.formState.errors.durationMonths && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {loanTermsForm.formState.errors.durationMonths.message}
                    </motion.p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repaymentFrequency" className="text-sm font-medium">Repayment Frequency *</Label>
                  <select
                    id="repaymentFrequency"
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...loanTermsForm.register('repaymentFrequency')}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              {loanTermsForm.watch('amount') && loanTermsForm.watch('interestRate') && loanTermsForm.watch('durationMonths') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/10 border border-primary/20 rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Monthly Payment:</span>
                      <p className="font-semibold text-lg">
                        {formatCurrency(
                          (loanTermsForm.watch('amount') || 0) *
                          (loanTermsForm.watch('interestRate') || 0) / 100 / 12 +
                          (loanTermsForm.watch('amount') || 0) / (loanTermsForm.watch('durationMonths') || 1)
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Interest:</span>
                      <p className="font-semibold text-lg">
                        {formatCurrency(
                          (loanTermsForm.watch('amount') || 0) *
                          (loanTermsForm.watch('interestRate') || 0) / 100 *
                          (loanTermsForm.watch('durationMonths') || 0) / 12
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.form>
          )}

          {/* Step 5: Collateral (only shown if required) */}
          {step === 5 && needsCollateral && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <Label className="text-base font-semibold">Collateral Items</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add assets that will secure this loan
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newCollateral = {
                      id: Date.now(),
                      type: 'other',
                      description: '',
                      estimated_value: 0,
                      currency: 'ZMW',
                    };
                    setCollateral([...collateral, newCollateral]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Collateral
                </Button>
              </div>
              <AnimatePresence>
                {collateral.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-5 border-2 rounded-xl space-y-4 bg-card"
                  >
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Collateral {index + 1}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCollateral(collateral.filter((_, i) => i !== index))}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Type</Label>
                        <select
                          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={item.type}
                          onChange={(e) => {
                            const updated = [...collateral];
                            updated[index].type = e.target.value;
                            setCollateral(updated);
                          }}
                        >
                          <option value="vehicle">Vehicle</option>
                          <option value="property">Property</option>
                          <option value="electronics">Electronics</option>
                          <option value="jewelry">Jewelry</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Estimated Value (ZMW)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="number"
                            className="pl-10 h-11"
                            value={item.estimated_value}
                            onChange={(e) => {
                              const updated = [...collateral];
                              updated[index].estimated_value = Number(e.target.value);
                              setCollateral(updated);
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...collateral];
                          updated[index].description = e.target.value;
                          setCollateral(updated);
                        }}
                        placeholder="Describe the collateral (e.g., Make, Model, Condition)..."
                        className="h-11"
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {collateral.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30"
                >
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No collateral added</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Add Collateral" to add items (optional)
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 6: Documents Upload (or Step 5 if no collateral) */}
          {((needsCollateral && step === 6) || (!needsCollateral && step === 5)) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div>
                <Label className="text-base font-semibold">Upload Required Documents</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload NRC, proof of income, bank statements, or other supporting documents
                </p>
              </div>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop files here, or click to select
                </p>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setDocuments([...documents, ...newFiles]);
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <Label htmlFor="file-upload">
                  <Button type="button" variant="outline" className="cursor-pointer">
                    Select Files
                  </Button>
                </Label>
              </motion.div>
              {documents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  {documents.map((doc, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg border"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground block truncate">
                            {doc.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(doc.size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 7: Risk Assessment (or Step 6 if no collateral) */}
          {((needsCollateral && step === 7) || (!needsCollateral && step === 6)) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-lg">AI Risk Assessment</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get AI-powered risk analysis for this loan application
                  </p>
                </div>
                <Button
                  onClick={runRiskAnalysis}
                  disabled={isAnalyzing}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Run Analysis
                    </>
                  )}
                </Button>
              </div>
              <AnimatePresence>
                {aiAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/10 border-2 border-primary/20 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-5 h-5 text-primary-600" />
                      <h4 className="font-semibold text-foreground">Risk Assessment Results</h4>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {aiAnalysis}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!aiAnalysis && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30"
                >
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-1">No analysis yet</p>
                  <p className="text-sm text-muted-foreground">
                    Click "Run Analysis" to get AI-powered risk assessment
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 8: Preview & Submit (or Step 7 if no collateral) */}
          {((needsCollateral && step === 8) || (!needsCollateral && step === 7)) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-5"
              >
                <div className="flex items-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mr-2" />
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-lg">
                    Ready to Submit
                  </h3>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Review all information before submitting for approval.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="h-full">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Borrower Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Name:</span>
                          <span className="font-semibold text-foreground">
                            {selectedCustomer?.users?.full_name || borrowerForm.getValues('fullName')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">NRC:</span>
                          <span className="font-semibold text-foreground">
                            {selectedCustomer?.nrc_number || borrowerForm.getValues('nrcNumber')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Phone:</span>
                          <span className="font-semibold text-foreground">
                            {selectedCustomer?.users?.phone || borrowerForm.getValues('phone')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Email:</span>
                          <span className="font-semibold text-foreground text-xs truncate ml-2">
                            {selectedCustomer?.users?.email || borrowerForm.getValues('email')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="h-full">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Loan Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Type:</span>
                          <Badge className="capitalize">{loanType}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Amount:</span>
                          <span className="font-semibold text-lg text-foreground">
                            {formatCurrency(loanTermsForm.getValues('amount') || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Interest Rate:</span>
                          <span className="font-semibold text-foreground">
                            {loanTermsForm.getValues('interestRate')}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Duration:</span>
                          <span className="font-semibold text-foreground">
                            {loanTermsForm.getValues('durationMonths')} months
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">Frequency:</span>
                          <span className="font-semibold text-foreground capitalize">
                            {loanTermsForm.getValues('repaymentFrequency')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {collateral.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card>
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" />
                        Collateral ({collateral.length} {collateral.length === 1 ? 'item' : 'items'})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {collateral.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-3 bg-muted rounded-lg border"
                          >
                            <div>
                              <span className="font-semibold capitalize text-foreground">{item.type}</span>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              )}
                            </div>
                            <span className="font-bold text-lg text-foreground">
                              {formatCurrency(item.estimated_value)}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 border-t">
                          <div className="flex justify-between font-semibold">
                            <span>Total Collateral Value:</span>
                            <span className="text-lg">
                              {formatCurrency(
                                collateral.reduce((sum, item) => sum + (item.estimated_value || 0), 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {documents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Documents ({documents.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {documents.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded border"
                          >
                            <span className="text-sm text-foreground truncate flex-1">{doc.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {(doc.size / 1024).toFixed(1)} KB
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {aiAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-primary/10 border-2 border-primary/20 rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-5 h-5 text-primary-600" />
                    <h4 className="font-semibold text-foreground">AI Risk Assessment</h4>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {aiAnalysis}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between gap-4 pt-4"
      >
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
          className="flex-1 md:flex-initial"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step < totalSteps ? (
          <Button
            onClick={() => {
              if (step === 2) {
                borrowerForm.handleSubmit(handleNext)();
              } else if (step === 4) {
                loanTermsForm.handleSubmit(handleNext)();
              } else if (step === 3 && !loanType) {
                toast.error('Please select a loan type');
              } else {
                handleNext();
              }
            }}
            className="flex-1 md:flex-initial bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createLoan.isPending || uploadingDocs}
            className="flex-1 md:flex-initial bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
          >
            {createLoan.isPending || uploadingDocs ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadingDocs ? 'Uploading...' : 'Submitting...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Submit Application
              </>
            )}
          </Button>
        )}
      </motion.div>
    </div>
  );
}
