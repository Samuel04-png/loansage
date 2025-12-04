import { useState } from 'react';
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
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loanType, setLoanType] = useState<string>('');
  const [collateral, setCollateral] = useState<any[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const totalSteps = 8;

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

  const createLoan = useMutation({
    mutationFn: async (loanData: any) => {
      if (!profile?.agency_id) throw new Error('Not authenticated');

      const result = await new Promise<any>((resolve, reject) => {
        supabase
          .from('loans')
          .insert({
            ...loanData,
            agency_id: profile.agency_id,
            status: 'pending',
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
    onSuccess: () => {
      toast.success('Loan application submitted successfully!');
      navigate('/employee/loans');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit loan');
    },
  });

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
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

  const stepIcons = [
    <Search className="w-4 h-4" />,
    <User className="w-4 h-4" />,
    <FileText className="w-4 h-4" />,
    <DollarSign className="w-4 h-4" />,
    <ShieldAlert className="w-4 h-4" />,
    <Upload className="w-4 h-4" />,
    <ShieldAlert className="w-4 h-4" />,
    <CheckCircle2 className="w-4 h-4" />,
  ];

  const stepTitles = [
    'Borrower Lookup',
    'Borrower KYC',
    'Loan Type',
    'Loan Terms',
    'Collateral',
    'Documents',
    'Risk Assessment',
    'Preview & Submit',
  ];

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
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <motion.div
                initial={false}
                animate={{
                  scale: i + 1 === step ? 1.1 : 1,
                  backgroundColor: i + 1 <= step ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors relative z-10 flex-shrink-0"
              >
                {i + 1 < step ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-xs">{i + 1}</span>
                )}
              </motion.div>
              {i < totalSteps - 1 && (
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: i + 1 < step ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  }}
                  className="flex-1 h-1 mx-2 rounded-full transition-colors"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-foreground">{stepTitles[step - 1]}</p>
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
                {stepIcons[step - 1]}
                {stepTitles[step - 1]}
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {[
                { type: 'personal', icon: User, desc: 'For personal expenses' },
                { type: 'business', icon: Briefcase, desc: 'For business operations' },
                { type: 'agriculture', icon: Sprout, desc: 'For farming activities' },
                { type: 'vehicle', icon: Car, desc: 'Vehicle purchase/repair' },
                { type: 'property', icon: Home, desc: 'Property investment' },
              ].map(({ type, icon: Icon, desc }, idx) => (
                <motion.button
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setLoanType(type)}
                  className={`p-6 border-2 rounded-xl text-left transition-all ${
                    loanType === type
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary/20 shadow-lg'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Icon className={`w-8 h-8 mb-3 ${loanType === type ? 'text-primary-600' : 'text-muted-foreground'}`} />
                  <div className="font-semibold capitalize text-foreground">{type}</div>
                  <div className="text-sm text-muted-foreground mt-1">{desc}</div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Step 4: Loan Terms */}
          {step === 4 && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={loanTermsForm.handleSubmit(handleNext)}
              className="space-y-5"
            >
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

          {/* Step 5: Collateral */}
          {step === 5 && (
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

          {/* Step 6: Documents Upload */}
          {step === 6 && (
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

          {/* Step 7: Risk Assessment */}
          {step === 7 && (
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

          {/* Step 8: Preview & Submit */}
          {step === 8 && (
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
