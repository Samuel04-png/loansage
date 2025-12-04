import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2, ChevronRight, ChevronLeft, Upload, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { createLoan, addCollateral, uploadLoanDocument, createCollateral } from '../../../lib/firebase/firestore-helpers';
import { createLoanTransaction } from '../../../lib/firebase/loan-transactions';
import { validateLoanEligibility } from '../../../lib/firebase/loan-validation';
import { uploadLoanDocument as uploadDoc, uploadCollateralPhoto } from '../../../lib/firebase/storage-helpers';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import toast from 'react-hot-toast';

const loanSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  loanAmount: z.string().min(1, 'Loan amount is required').refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0'),
  loanType: z.string().min(1, 'Loan type is required'),
  interestRate: z.string().min(1, 'Interest rate is required').refine((val) => parseFloat(val) >= 0 && parseFloat(val) <= 100, 'Rate must be between 0 and 100'),
  durationMonths: z.string().min(1, 'Duration is required').refine((val) => parseInt(val) > 0, 'Duration must be greater than 0'),
  disbursementDate: z.string().min(1, 'Disbursement date is required'),
  collateralType: z.string().optional(),
  collateralDescription: z.string().optional(),
  collateralValue: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface NewLoanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedCustomerId?: string;
}

export function NewLoanDrawer({ open, onOpenChange, onSuccess, preselectedCustomerId }: NewLoanDrawerProps) {
  const { user, profile } = useAuth();
  const { agency } = useAgency();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [collateralFiles, setCollateralFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const totalSteps = 3;

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: preselectedCustomerId || '',
    },
  });

  // Update customer selection when preselectedCustomerId changes
  useEffect(() => {
    if (preselectedCustomerId && open) {
      setValue('customerId', preselectedCustomerId);
    }
  }, [preselectedCustomerId, open, setValue]);

  const selectedCustomerId = watch('customerId');
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  const handleFileChange = (type: 'collateral' | 'document', files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    if (type === 'collateral') {
      setCollateralFiles((prev) => [...prev, ...fileArray]);
    } else {
      setDocumentFiles((prev) => [...prev, ...fileArray]);
    }
  };

  const removeFile = (type: 'collateral' | 'document', index: number) => {
    if (type === 'collateral') {
      setCollateralFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: LoanFormData) => {
    if (!agency?.id || !user?.id || !profile?.agency_id) {
      toast.error('Agency information not available');
      return;
    }

    setLoading(true);
    try {
      // Validate loan eligibility
      const validation = await validateLoanEligibility({
        customerId: data.customerId,
        agencyId: profile.agency_id,
        requestedAmount: parseFloat(data.loanAmount),
      });

      if (!validation.valid) {
        toast.error(validation.errors.join(', '));
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(warning => toast(warning, { icon: '⚠️' }));
        }
        setLoading(false);
        return;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast(warning, { icon: '⚠️' }));
      }

      // Create loan using transaction
      const result = await createLoanTransaction({
        agencyId: profile.agency_id,
        customerId: data.customerId,
        officerId: user.id,
        amount: parseFloat(data.loanAmount),
        interestRate: parseFloat(data.interestRate),
        durationMonths: parseInt(data.durationMonths),
        loanType: data.loanType,
        disbursementDate: new Date(data.disbursementDate),
        collateralIncluded: !!data.collateralType,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create loan');
      }

      const loanId = result.loanId;

      // Add collateral if provided
      if (data.collateralType && data.collateralDescription) {
        const collateralPhotos: string[] = [];
        
        // Upload collateral photos (skip on Spark plan)
        for (const file of collateralFiles) {
          try {
            const { isSparkPlan } = await import('../../../lib/firebase/config');
            if (isSparkPlan) {
              console.info('Skipping collateral photo upload - Spark plan');
              // Skip upload but continue
            } else {
              const photoURL = await uploadCollateralPhoto(
                profile.agency_id,
                loanId,
                'temp',
                file
              );
              collateralPhotos.push(photoURL);
            }
          } catch (error: any) {
            console.warn('Failed to upload collateral photo:', error);
            if (error.message?.includes('Spark') || error.message?.includes('free')) {
              // Already handled
            }
          }
        }

        const collateralData = {
          type: data.collateralType as any,
          description: data.collateralDescription,
          estimatedValue: data.collateralValue ? parseFloat(data.collateralValue) : 0,
          photos: collateralPhotos,
        };

        // Add to loan's collateral subcollection
        await addCollateral(profile.agency_id, loanId, collateralData);

        // Also create in top-level collateral registry (only pass defined values)
        await createCollateral(profile.agency_id, {
          type: collateralData.type,
          description: collateralData.description,
          estimatedValue: collateralData.estimatedValue,
          photos: collateralData.photos,
          loanId: loanId,
          ownerCustomerId: data.customerId,
        });
      }

      // Upload loan documents (skip on Spark plan)
      if (documentFiles.length > 0) {
        const { isSparkPlan } = await import('../../../lib/firebase/config');
        if (isSparkPlan) {
          toast('File uploads skipped - not available on Spark (free) plan', { icon: 'ℹ️' });
        } else {
          for (const file of documentFiles) {
            try {
              const fileURL = await uploadDoc(profile.agency_id, loanId, file, 'other');
              await uploadLoanDocument(profile.agency_id, loanId, {
                type: 'other',
                fileURL,
                uploadedBy: user.id,
              });
            } catch (error: any) {
              console.warn('Failed to upload loan document:', error);
              if (error.message?.includes('Spark') || error.message?.includes('free')) {
                toast('File uploads not available on free plan', { icon: 'ℹ️' });
              }
            }
          }
        }
      }

      toast.success('Loan created successfully!');
      reset();
      setCollateralFiles([]);
      setDocumentFiles([]);
      setStep(1);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating loan:', error);
      toast.error(error.message || 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  useEffect(() => {
    if (!open) {
      setStep(1);
      reset();
      setCollateralFiles([]);
      setDocumentFiles([]);
    }
  }, [open, reset]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="xl">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Create New Loan</DrawerTitle>
          <DrawerDescription>
            Step {step} of {totalSteps}: {step === 1 ? 'Customer & Basic Info' : step === 2 ? 'Loan Details' : 'Collateral & Documents'}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form id="loan-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Customer & Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customerId">Select Customer *</Label>
                  <select
                    id="customerId"
                    {...register('customerId')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer: any) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.fullName} - {customer.phone} {customer.email ? `(${customer.email})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.customerId && (
                    <p className="text-sm text-red-600 mt-1">{errors.customerId.message}</p>
                  )}
                  {selectedCustomer && (
                    <div className="mt-2 p-3 bg-slate-50 rounded text-sm">
                      <p><strong>NRC:</strong> {selectedCustomer.nrc}</p>
                      <p><strong>Address:</strong> {selectedCustomer.address}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="loanAmount">Loan Amount *</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      {...register('loanAmount')}
                      className={errors.loanAmount ? 'border-red-500' : ''}
                    />
                    {errors.loanAmount && (
                      <p className="text-sm text-red-600 mt-1">{errors.loanAmount.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="loanType">Loan Type *</Label>
                    <select
                      id="loanType"
                      {...register('loanType')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select type</option>
                      <option value="personal">Personal Loan</option>
                      <option value="business">Business Loan</option>
                      <option value="agricultural">Agricultural Loan</option>
                      <option value="emergency">Emergency Loan</option>
                      <option value="asset">Asset-Based Loan</option>
                    </select>
                    {errors.loanType && (
                      <p className="text-sm text-red-600 mt-1">{errors.loanType.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Loan Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="interestRate">Interest Rate (%) *</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      placeholder="15.5"
                      step="0.1"
                      {...register('interestRate')}
                      className={errors.interestRate ? 'border-red-500' : ''}
                    />
                    {errors.interestRate && (
                      <p className="text-sm text-red-600 mt-1">{errors.interestRate.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="durationMonths">Duration (Months) *</Label>
                    <Input
                      id="durationMonths"
                      type="number"
                      placeholder="12"
                      {...register('durationMonths')}
                      className={errors.durationMonths ? 'border-red-500' : ''}
                    />
                    {errors.durationMonths && (
                      <p className="text-sm text-red-600 mt-1">{errors.durationMonths.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="disbursementDate">Disbursement Date *</Label>
                  <Input
                    id="disbursementDate"
                    type="date"
                    {...register('disbursementDate')}
                    className={errors.disbursementDate ? 'border-red-500' : ''}
                  />
                  {errors.disbursementDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.disbursementDate.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Collateral & Documents */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3">Collateral (Optional)</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="collateralType">Collateral Type</Label>
                      <select
                        id="collateralType"
                        {...register('collateralType')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">None</option>
                        <option value="vehicle">Vehicle</option>
                        <option value="land">Land</option>
                        <option value="electronics">Electronics</option>
                        <option value="equipment">Equipment</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="collateralDescription">Description</Label>
                      <Textarea
                        id="collateralDescription"
                        placeholder="Describe the collateral..."
                        rows={3}
                        {...register('collateralDescription')}
                      />
                    </div>

                    <div>
                      <Label htmlFor="collateralValue">Estimated Value</Label>
                      <Input
                        id="collateralValue"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        {...register('collateralValue')}
                      />
                    </div>

                    <div>
                      <Label>Collateral Photos</Label>
                      <div className="mt-2">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-xs text-slate-500">Upload Photos</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileChange('collateral', e.target.files)}
                          />
                        </label>
                        {collateralFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {collateralFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                                <span className="flex-1 truncate">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFile('collateral', index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">Loan Documents (Optional)</h3>
                  <div>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500">Upload Documents</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,image/*"
                        multiple
                        onChange={(e) => handleFileChange('document', e.target.files)}
                      />
                    </label>
                    {documentFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {documentFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                            <span className="flex-1 truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile('document', index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </DrawerBody>

        <DrawerFooter>
          <div className="flex justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={step === 1 ? () => onOpenChange(false) : prevStep}
              disabled={loading}
            >
              {step === 1 ? 'Cancel' : (
                <>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </>
              )}
            </Button>

            {step < totalSteps ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="loan-form"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Loan'
                )}
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

