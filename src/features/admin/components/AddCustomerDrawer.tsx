import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Loader2, Upload, X, Search } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { createCustomer, uploadCustomerDocument, createCollateral } from '../../../lib/firebase/firestore-helpers';
import { uploadCustomerDocument as uploadDoc } from '../../../lib/firebase/storage-helpers';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import { NRCLookupDialog } from '../../../components/nrc/NRCLookupDialog';
import toast from 'react-hot-toast';

const customerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  nrc: z.string().min(5, 'NRC/ID number is required'),
  address: z.string().min(5, 'Address is required'),
  employer: z.string().optional(),
  employmentStatus: z.enum(['employed', 'self-employed', 'unemployed', 'retired', 'student']).optional(),
  monthlyIncome: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentDuration: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorNRC: z.string().optional(),
  guarantorRelationship: z.string().optional(),
  loanType: z.string().optional(),
  initialLoanAmount: z.string().optional(),
  collateralDetails: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface AddCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddCustomerDrawer({ open, onOpenChange, onSuccess }: AddCustomerDrawerProps) {
  const { user, profile } = useAuth();
  const { agency } = useAgency();
  const [loading, setLoading] = useState(false);
  const [idFiles, setIdFiles] = useState<{ front?: File; back?: File }>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [nrcLookupOpen, setNrcLookupOpen] = useState(false);
  const [nrcAnalysis, setNrcAnalysis] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  const handleFileChange = (type: 'front' | 'back', file: File | null) => {
    if (file) {
      setIdFiles((prev) => ({ ...prev, [type]: file }));
    } else {
      setIdFiles((prev => {
        const newFiles = { ...prev };
        delete newFiles[type];
        return newFiles;
      }));
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    if (!agency?.id || !user?.id || !profile?.agency_id) {
      toast.error('Agency information not available');
      return;
    }

    setLoading(true);
    try {
      // Create customer in Firestore
      const customer = await createCustomer(profile.agency_id, {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        nrc: data.nrc,
        address: data.address,
        employer: data.employer || undefined,
        employmentStatus: data.employmentStatus || undefined,
        monthlyIncome: data.monthlyIncome ? parseFloat(data.monthlyIncome) : undefined,
        jobTitle: data.jobTitle || undefined,
        employmentDuration: data.employmentDuration || undefined,
        guarantorName: data.guarantorName || undefined,
        guarantorPhone: data.guarantorPhone || undefined,
        guarantorNRC: data.guarantorNRC || undefined,
        guarantorRelationship: data.guarantorRelationship || undefined,
        createdBy: user.id,
      });

      // Upload profile photo if provided
      if (photoFile) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (!isSparkPlan) {
            const { uploadFile } = await import('../../../lib/firebase/storage-helpers');
            const photoURL = await uploadFile(
              `agencies/${profile.agency_id}/customers/${customer.id}/profile-photo-${Date.now()}.${photoFile.name.split('.').pop()}`,
              photoFile
            );
            // Update customer with photo URL
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../../lib/firebase/config');
            const customerRef = doc(db, 'agencies', profile.agency_id, 'customers', customer.id);
            await updateDoc(customerRef, { profilePhotoURL: photoURL });
          }
        } catch (error: any) {
          console.warn('Failed to upload profile photo:', error);
        }
      }

      // Upload ID documents if provided (skip on Spark plan)
      if (idFiles.front) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (!isSparkPlan) {
            const fileURL = await uploadDoc(profile.agency_id, customer.id, idFiles.front, 'id-front');
            await uploadCustomerDocument(profile.agency_id, customer.id, {
              type: 'id-front',
              fileURL,
              uploadedBy: user.id,
            });
          } else {
            toast('File uploads skipped - not available on Spark (free) plan', { icon: 'ℹ️' });
          }
        } catch (error: any) {
          console.warn('Failed to upload ID front:', error);
          if (error.message?.includes('Spark') || error.message?.includes('free')) {
            toast('File uploads not available on free plan', { icon: 'ℹ️' });
          }
        }
      }

      if (idFiles.back) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (!isSparkPlan) {
            const fileURL = await uploadDoc(profile.agency_id, customer.id, idFiles.back, 'id-back');
            await uploadCustomerDocument(profile.agency_id, customer.id, {
              type: 'id-back',
              fileURL,
              uploadedBy: user.id,
            });
          }
        } catch (error: any) {
          console.warn('Failed to upload ID back:', error);
          if (error.message?.includes('Spark') || error.message?.includes('free')) {
            // Already shown message for front, skip
          }
        }
      }

      // Extract and create collateral if details provided
      if (data.collateralDetails && data.collateralDetails.trim()) {
        try {
          const { extractCollateralFromText } = await import('../../../lib/firebase/collateral-extraction');
          const extractedCollaterals = extractCollateralFromText(data.collateralDetails);
          
          for (const collateralData of extractedCollaterals) {
            // Map extracted types to valid collateral types
            let validType: 'vehicle' | 'land' | 'electronics' | 'equipment' | 'other' = 'other';
            if (collateralData.type === 'vehicle') {
              validType = 'vehicle';
            } else if (collateralData.type === 'land' || collateralData.type === 'property') {
              validType = 'land';
            } else if (collateralData.type === 'electronics') {
              validType = 'electronics';
            } else if (collateralData.type === 'equipment') {
              validType = 'equipment';
            }
            
            const collateralPayload: any = {
              type: validType,
              description: collateralData.description,
              estimatedValue: collateralData.estimatedValue || 0,
              ownerCustomerId: customer.id,
            };
            
            // Only add optional fields if they have values
            if (collateralData.brand) collateralPayload.brand = collateralData.brand;
            if (collateralData.model) collateralPayload.model = collateralData.model;
            if (collateralData.year) collateralPayload.year = collateralData.year;
            if (collateralData.serialNumber) collateralPayload.serialNumber = collateralData.serialNumber;
            if (collateralData.condition) collateralPayload.condition = collateralData.condition;
            
            await createCollateral(profile.agency_id, collateralPayload);
          }
          
          if (extractedCollaterals.length > 0) {
            toast.success(`Customer created with ${extractedCollaterals.length} collateral item(s) extracted!`);
          }
        } catch (error: any) {
          console.warn('Failed to extract collateral:', error);
          // Continue even if collateral extraction fails
        }
      }

      // Create audit log (non-blocking)
      createAuditLog(profile.agency_id, {
        actorId: user.id,
        action: 'create_customer',
        targetCollection: 'customers',
        targetId: customer.id,
        metadata: { fullName: data.fullName },
      }).catch(() => {
        // Ignore audit log errors
      });

      // TODO: Send customer invite email if email exists
      if (data.email && !data.collateralDetails) {
        // Trigger email send (would be done via Cloud Function)
        toast.success('Customer created! Invitation email will be sent.');
      } else if (!data.collateralDetails) {
        toast.success('Customer created successfully!');
      }

      reset();
      setIdFiles({});
      setPhotoFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast.error(error.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="lg">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add New Customer</DrawerTitle>
          <DrawerDescription>
            Create a new customer profile in your agency
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  {...register('fullName')}
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+260 123 456 789"
                  {...register('phone')}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="customer@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="nrc">NRC / ID Number *</Label>
                <div className="flex gap-2">
                  <Input
                    id="nrc"
                    placeholder="123456/78/9"
                    {...register('nrc')}
                    className={errors.nrc ? 'border-red-500' : ''}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNrcLookupOpen(true)}
                    title="Lookup NRC Risk"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {errors.nrc && (
                  <p className="text-sm text-red-600 mt-1">{errors.nrc.message}</p>
                )}
                {nrcAnalysis && (
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
                    <p className="font-semibold">Risk Score: {nrcAnalysis.riskScore}/100</p>
                    <p className="text-slate-600">{nrcAnalysis.totalLoans} previous loan(s)</p>
                    {nrcAnalysis.recommendedMaxLoanSize > 0 && (
                      <p className="text-slate-600">Max recommended: {nrcAnalysis.recommendedMaxLoanSize.toLocaleString()} ZMW</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                placeholder="Street address, City, Country"
                rows={2}
                {...register('address')}
                className={errors.address ? 'border-red-500' : ''}
              />
              {errors.address && (
                <p className="text-sm text-red-600 mt-1">{errors.address.message}</p>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employmentStatus">Employment Status</Label>
                  <select
                    id="employmentStatus"
                    {...register('employmentStatus')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select status</option>
                    <option value="employed">Employed</option>
                    <option value="self-employed">Self-Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                    <option value="student">Student</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="employer">Employer / Company Name</Label>
                  <Input
                    id="employer"
                    placeholder="Company name or self-employed"
                    {...register('employer')}
                  />
                </div>

                <div>
                  <Label htmlFor="jobTitle">Job Title / Occupation</Label>
                  <Input
                    id="jobTitle"
                    placeholder="e.g., Teacher, Business Owner"
                    {...register('jobTitle')}
                  />
                </div>

                <div>
                  <Label htmlFor="employmentDuration">Employment Duration</Label>
                  <Input
                    id="employmentDuration"
                    placeholder="e.g., 2 years"
                    {...register('employmentDuration')}
                  />
                </div>

                <div>
                  <Label htmlFor="monthlyIncome">Monthly Income (ZMW)</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    {...register('monthlyIncome')}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Guarantor Details (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guarantorName">Guarantor Full Name</Label>
                  <Input
                    id="guarantorName"
                    placeholder="Guarantor name"
                    {...register('guarantorName')}
                  />
                </div>

                <div>
                  <Label htmlFor="guarantorPhone">Guarantor Phone</Label>
                  <Input
                    id="guarantorPhone"
                    type="tel"
                    placeholder="+260 123 456 789"
                    {...register('guarantorPhone')}
                  />
                </div>

                <div>
                  <Label htmlFor="guarantorNRC">Guarantor NRC</Label>
                  <Input
                    id="guarantorNRC"
                    placeholder="123456/78/9"
                    {...register('guarantorNRC')}
                  />
                </div>

                <div>
                  <Label htmlFor="guarantorRelationship">Relationship</Label>
                  <Input
                    id="guarantorRelationship"
                    placeholder="e.g., Spouse, Parent, Friend"
                    {...register('guarantorRelationship')}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Profile Photo</h3>
              <div>
                {photoFile ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                    <img 
                      src={URL.createObjectURL(photoFile)} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded"
                    />
                    <span className="text-sm flex-1 truncate">{photoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setPhotoFile(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">Upload Profile Photo</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setPhotoFile(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">ID Documents</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID Front</Label>
                  <div className="mt-2">
                    {idFiles.front ? (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <span className="text-sm flex-1 truncate">{idFiles.front.name}</span>
                        <button
                          type="button"
                          onClick={() => handleFileChange('front', null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500">Upload ID Front</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleFileChange('front', e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <Label>ID Back</Label>
                  <div className="mt-2">
                    {idFiles.back ? (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <span className="text-sm flex-1 truncate">{idFiles.back.name}</span>
                        <button
                          type="button"
                          onClick={() => handleFileChange('back', null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500">Upload ID Back</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleFileChange('back', e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Optional Loan Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loanType">Loan Type</Label>
                  <select
                    id="loanType"
                    {...register('loanType')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select loan type</option>
                    <option value="personal">Personal Loan</option>
                    <option value="business">Business Loan</option>
                    <option value="agricultural">Agricultural Loan</option>
                    <option value="emergency">Emergency Loan</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="initialLoanAmount">Initial Loan Amount</Label>
                  <Input
                    id="initialLoanAmount"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    {...register('initialLoanAmount')}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="collateralDetails">Collateral Details</Label>
                <Textarea
                  id="collateralDetails"
                  placeholder="Describe any collateral..."
                  rows={2}
                  {...register('collateralDetails')}
                />
              </div>
            </div>
          </form>
        </DrawerBody>

        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setIdFiles({});
              setPhotoFile(null);
              setNrcAnalysis(null);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-form"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Customer'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>

      <NRCLookupDialog
        open={nrcLookupOpen}
        onOpenChange={setNrcLookupOpen}
        onSelectNRC={(nrc, analysis) => {
          // Set the NRC in the form
          const nrcInput = document.getElementById('nrc') as HTMLInputElement;
          if (nrcInput) {
            nrcInput.value = nrc;
            // Trigger form validation
            const event = new Event('input', { bubbles: true });
            nrcInput.dispatchEvent(event);
          }
          setNrcAnalysis(analysis);
        }}
      />
    </Drawer>
  );
}

