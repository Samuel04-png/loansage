import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../components/ui/form';
import { Loader2, Upload, X, Search } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useAgency } from '../../../hooks/useAgency';
import { createCustomer, uploadCustomerDocument, createCollateral, createCustomerInvitation } from '../../../lib/firebase/firestore-helpers';
import { uploadCustomerDocument as uploadDoc } from '../../../lib/firebase/storage-helpers';
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
    watch,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  });

  const employmentStatus = watch('employmentStatus');

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
        lastEmploymentDate: data.lastEmploymentDate || undefined,
        unemploymentReason: data.unemploymentReason || undefined,
        createdBy: user.id,
      });

      // Upload profile photo if provided
      if (photoFile) {
        try {
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
        } catch (error: any) {
          console.warn('Failed to upload profile photo:', error);
        }
      }

      // Upload ID documents if provided
      if (idFiles.front) {
        try {
          const fileURL = await uploadDoc(profile.agency_id, customer.id, idFiles.front, 'id-front');
          await uploadCustomerDocument(profile.agency_id, customer.id, {
            type: 'id-front',
            fileURL,
            uploadedBy: user.id,
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
            uploadedBy: user.id,
          });
        } catch (error: any) {
          console.warn('Failed to upload ID back:', error);
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

      // Create customer invitation if email is provided
      if (data.email) {
        try {
          const invitation = await createCustomerInvitation(profile.agency_id, customer.id, {
            email: data.email,
            note: `You've been invited to join ${agency?.name || 'our agency'} as a customer.`,
            createdBy: user.id,
          });

          // Send invitation email via Cloud Function
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const sendInvitationEmail = httpsCallable(functions, 'sendInvitationEmail');
            
            const inviteUrl = invitation.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${invitation.token}`;
            
            await sendInvitationEmail({
              agencyId: profile.agency_id,
              invitationId: invitation.id,
              email: data.email,
              role: 'customer',
              inviteUrl: inviteUrl,
              note: invitation.note,
              agencyName: agency?.name,
            });
            
            toast.success('Customer created and invitation email sent!');
          } catch (emailError: any) {
            console.error('Failed to send invitation email:', emailError);
            // Still show success - customer is created, email can be resent
            const inviteUrl = invitation.inviteUrl || `${window.location.origin}/auth/accept-invite?token=${invitation.token}`;
            toast.success(
              <div>
                <p className="font-semibold">Customer created!</p>
                <p className="text-xs mt-1">Email sending failed. Invitation link: <a href={inviteUrl} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">{inviteUrl}</a></p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success('Invitation link copied to clipboard!');
                  }}
                  className="text-xs mt-2 text-blue-600 underline"
                >
                  Copy link
                </button>
              </div>,
              { duration: 15000 }
            );
          }
        } catch (error: any) {
          console.warn('Failed to create customer invitation:', error);
          toast.success('Customer created successfully! (Invitation creation failed)');
        }
      } else {
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

