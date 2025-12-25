import { useState, useEffect } from 'react';
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
import { updateCustomer, uploadCustomerDocument } from '../../../lib/firebase/firestore-helpers';
import { uploadCustomerDocument as uploadDoc, uploadFile } from '../../../lib/firebase/storage-helpers';
import { createAuditLog } from '../../../lib/firebase/firestore-helpers';
import { NRCLookupDialog } from '../../../components/nrc/NRCLookupDialog';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

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
  lastEmploymentDate: z.string().optional(),
  unemploymentReason: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorNRC: z.string().optional(),
  guarantorRelationship: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface EditCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  customer: any;
}

export function EditCustomerDrawer({ open, onOpenChange, onSuccess, customer }: EditCustomerDrawerProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [idFiles, setIdFiles] = useState<{ front?: File; back?: File }>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoURL, setExistingPhotoURL] = useState<string | null>(null);
  const [nrcLookupOpen, setNrcLookupOpen] = useState(false);
  const [nrcAnalysis, setNrcAnalysis] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  const employmentStatus = watch('employmentStatus');

  // Load customer data into form when drawer opens
  useEffect(() => {
    if (open && customer) {
      setValue('fullName', customer.fullName || '');
      setValue('phone', customer.phone || '');
      setValue('email', customer.email || '');
      setValue('nrc', customer.nrc || '');
      setValue('address', customer.address || '');
      setValue('employer', customer.employer || '');
      setValue('employmentStatus', customer.employmentStatus || '');
      setValue('monthlyIncome', customer.monthlyIncome ? String(customer.monthlyIncome) : '');
      setValue('jobTitle', customer.jobTitle || '');
      setValue('employmentDuration', customer.employmentDuration || '');
      setValue('lastEmploymentDate', customer.lastEmploymentDate || '');
      setValue('unemploymentReason', customer.unemploymentReason || '');
      setValue('guarantorName', customer.guarantorName || '');
      setValue('guarantorPhone', customer.guarantorPhone || '');
      setValue('guarantorNRC', customer.guarantorNRC || '');
      setValue('guarantorRelationship', customer.guarantorRelationship || '');
      setExistingPhotoURL(customer.profilePhotoURL || null);
    }
  }, [open, customer, setValue]);

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
    if (!profile?.agency_id || !customer?.id) {
      toast.error('Agency information or customer ID not available');
      return;
    }

    setLoading(true);
    try {
      let photoURL = existingPhotoURL;

      // Upload new profile photo if provided
      if (photoFile) {
        try {
          photoURL = await uploadFile(
            `agencies/${profile.agency_id}/customers/${customer.id}/profile-photo-${Date.now()}.${photoFile.name.split('.').pop()}`,
            photoFile
          );
        } catch (error: any) {
          console.warn('Failed to upload profile photo:', error);
          toast.error('Failed to upload profile photo');
        }
      }

      // Update customer in Firestore
      await updateCustomer(profile.agency_id, customer.id, {
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
        lastEmploymentDate: data.lastEmploymentDate || undefined,
        unemploymentReason: data.unemploymentReason || undefined,
        profilePhotoURL: photoURL || undefined,
      });

      // Upload ID documents if provided
      if (idFiles.front) {
        try {
          const fileURL = await uploadDoc(profile.agency_id, customer.id, idFiles.front, 'id-front');
          await uploadCustomerDocument(profile.agency_id, customer.id, {
            type: 'id-front',
            fileURL,
            uploadedBy: user!.id,
          });
        } catch (error: any) {
          console.warn('Failed to upload ID front:', error);
        }
      }

      if (idFiles.back) {
        try {
          const fileURL = await uploadDoc(profile.agency_id, customer.id, idFiles.back, 'id-back');
          await uploadCustomerDocument(profile.agency_id, customer.id, {
            type: 'id-back',
            fileURL,
            uploadedBy: user!.id,
          });
        } catch (error: any) {
          console.warn('Failed to upload ID back:', error);
        }
      }

      // Create audit log
      createAuditLog(profile.agency_id, {
        actorId: user!.id,
        action: 'customer_updated',
        targetCollection: 'customers',
        targetId: customer.id,
        metadata: {
          customerName: data.fullName,
        },
      }).catch(() => {
        // Ignore audit log errors
      });

      toast.success('Customer updated successfully!');

      reset();
      setIdFiles({});
      setPhotoFile(null);
      setExistingPhotoURL(photoURL);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast.error(error.message || 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="lg">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit Customer</DrawerTitle>
          <DrawerDescription>
            Update customer information and details
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          <form id="edit-customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                {/* Show fields based on employment status */}
                
                {/* Employer/Company Name - Show for: employed, self-employed */}
                {(employmentStatus === 'employed' || employmentStatus === 'self-employed') && (
                  <div>
                    <Label htmlFor="employer">
                      {employmentStatus === 'employed' ? 'Employer / Company Name' : 'Business Name'}
                    </Label>
                    <Input
                      id="employer"
                      placeholder={employmentStatus === 'employed' ? 'Company name' : 'Business name'}
                      {...register('employer')}
                    />
                  </div>
                )}

                {/* Job Title/Occupation - Show for: employed, self-employed, student */}
                {(employmentStatus === 'employed' || employmentStatus === 'self-employed' || employmentStatus === 'student') && (
                  <div>
                    <Label htmlFor="jobTitle">
                      {employmentStatus === 'employed' ? 'Job Title / Occupation' : 
                       employmentStatus === 'self-employed' ? 'Business Type / Occupation' :
                       'Course / Field of Study'}
                    </Label>
                    <Input
                      id="jobTitle"
                      placeholder={
                        employmentStatus === 'employed' ? 'e.g., Teacher, Accountant' :
                        employmentStatus === 'self-employed' ? 'e.g., Retailer, Farmer' :
                        'e.g., Computer Science, Medicine'
                      }
                      {...register('jobTitle')}
                    />
                  </div>
                )}

                {/* Employment Duration - Show for: employed, self-employed */}
                {(employmentStatus === 'employed' || employmentStatus === 'self-employed') && (
                  <div>
                    <Label htmlFor="employmentDuration">
                      {employmentStatus === 'employed' ? 'Employment Duration' : 'Years in Business'}
                    </Label>
                    <Input
                      id="employmentDuration"
                      placeholder="e.g., 2 years"
                      {...register('employmentDuration')}
                    />
                  </div>
                )}

                {/* Monthly Income - Show for: employed, self-employed, retired, student */}
                {(employmentStatus === 'employed' || employmentStatus === 'self-employed' || employmentStatus === 'retired' || employmentStatus === 'student') && (
                  <div>
                    <Label htmlFor="monthlyIncome">
                      {employmentStatus === 'retired' ? 'Monthly Pension/Income (ZMW)' : 
                       employmentStatus === 'student' ? 'Monthly Allowance/Income (ZMW)' :
                       'Monthly Income (ZMW)'}
                    </Label>
                    <Input
                      id="monthlyIncome"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      {...register('monthlyIncome')}
                    />
                  </div>
                )}

                {/* Unemployed Status Fields */}
                {employmentStatus === 'unemployed' && (
                  <>
                    <div>
                      <Label htmlFor="lastEmploymentDate">Last Employment Date</Label>
                      <Input
                        id="lastEmploymentDate"
                        type="date"
                        {...register('lastEmploymentDate')}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="unemploymentReason">Reason for Unemployment</Label>
                      <Textarea
                        id="unemploymentReason"
                        placeholder="e.g., Laid off, Company closure, Resigned, etc."
                        rows={3}
                        {...register('unemploymentReason')}
                      />
                    </div>
                  </>
                )}
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
                ) : existingPhotoURL ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                    <img 
                      src={existingPhotoURL} 
                      alt="Current photo" 
                      className="w-16 h-16 object-cover rounded"
                    />
                    <span className="text-sm flex-1">Current profile photo</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoFile(null);
                        setExistingPhotoURL(null);
                      }}
                    >
                      Remove
                    </Button>
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
            form="edit-customer-form"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Customer'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>

      <NRCLookupDialog
        open={nrcLookupOpen}
        onOpenChange={setNrcLookupOpen}
        onSelectNRC={(nrc, analysis) => {
          setValue('nrc', nrc);
          setNrcAnalysis(analysis);
        }}
      />
    </Drawer>
  );
}

