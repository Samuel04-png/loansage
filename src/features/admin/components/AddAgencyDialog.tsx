import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { Dialog, DialogContent, DialogHeader } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Loader2, Building2, Upload, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAgency } from '../../../lib/firebase/firestore-helpers';
import { uploadAgencyLogo } from '../../../lib/firebase/storage-helpers';
import { useAuth } from '../../../hooks/useAuth';
import { useAgencyStore } from '../../../stores/agencyStore';

const agencySchema = z.object({
  name: z.string().min(2, 'Agency name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
});

type AgencyFormData = z.infer<typeof agencySchema>;

interface AddAgencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAgencyDialog({ open, onOpenChange }: AddAgencyDialogProps) {
  const { user } = useAuthStore();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { fetchAgency } = useAgencyStore();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AgencyFormData>({
    resolver: zodResolver(agencySchema),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: AgencyFormData) => {
    if (!user?.id) {
      toast.error('User information not available');
      return;
    }

    setLoading(true);
    try {
      // Create new agency
      const newAgency = await createAgency({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        createdBy: user.id,
        logoURL: undefined,
      });

      // Upload logo if provided
      if (logoFile) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (isSparkPlan) {
            console.info('Skipping logo upload - Spark plan detected');
            toast('Logo upload skipped - not available on Spark (free) plan', { icon: 'ℹ️' });
          } else {
            const logoURL = await uploadAgencyLogo(newAgency.id, logoFile);
            const { updateAgency } = await import('../../../lib/firebase/firestore-helpers');
            await updateAgency(newAgency.id, { logoURL });
          }
        } catch (error: any) {
          console.warn('Failed to upload logo:', error);
          toast('Logo upload failed, but agency was created successfully', { icon: '⚠️' });
        }
      }

      // Update user profile with agency_id
      const { updateUserDocument } = await import('../../../lib/firebase/firestore-helpers');
      await updateUserDocument(user.id, {
        agency_id: newAgency.id,
        email: user.email || data.email,
        full_name: user.displayName || user.email?.split('@')[0] || 'Admin',
        role: 'admin',
      });

      // Create employee record for the admin
      const { createEmployee } = await import('../../../lib/firebase/firestore-helpers');
      await createEmployee(newAgency.id, {
        userId: user.id,
        email: user.email || data.email,
        name: user.displayName || user.email?.split('@')[0] || 'Admin',
        role: 'admin',
      });

      // Update auth store
      const { setProfile } = useAuthStore.getState();
      setProfile({ ...profile, agency_id: newAgency.id } as any);

      // Fetch the new agency
      await fetchAgency(newAgency.id);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['user-agencies'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      toast.success('Agency created successfully!');
      reset();
      setLogoFile(null);
      setLogoPreview(null);
      onOpenChange(false);
      
      // Reload to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Error creating agency:', error);
      toast.error(error.message || 'Failed to create agency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Create New Agency</h2>
              <p className="text-sm text-slate-600">Set up a new microfinance organization</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo (Optional)</Label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-lg object-cover border-2 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="flex-1">
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Upload Logo</span>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Agency Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Agency Name *</Label>
            <Input
              id="name"
              placeholder="ABC Microfinance"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@agency.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+260 123 456 789"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="123 Main Street, City, Country"
              {...register('address')}
            />
            {errors.address && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.address.message}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-[#006BFF] to-[#4F46E5] hover:from-[#0052CC] hover:to-[#4338CA] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Agency'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setLogoFile(null);
                setLogoPreview(null);
                onOpenChange(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

