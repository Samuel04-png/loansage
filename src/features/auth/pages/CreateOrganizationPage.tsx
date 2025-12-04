import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Loader2, Building2, Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAgency } from '../../../lib/firebase/firestore-helpers';
import { uploadAgencyLogo } from '../../../lib/firebase/storage-helpers';

const organizationSchema = z.object({
  name: z.string().min(2, 'Agency name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  themeMode: z.enum(['light', 'dark', 'auto']).optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      primaryColor: '#0ea5e9',
      secondaryColor: '#0284c7',
      themeMode: 'light',
    },
  });

  // Show loading if user is not loaded yet
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: OrganizationFormData) => {
    if (!user) {
      toast.error('You must be logged in to create an organization');
      navigate('/auth/login');
      return;
    }

    setLoading(true);
    try {
      // Create agency first (without logo)
      const newAgency = await createAgency({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        createdBy: user.id,
        logoURL: undefined, // Will upload logo after agency is created
        settings: {
          theme: (data.themeMode === 'auto' ? 'light' : data.themeMode) || 'light',
        },
      });

      // Update agency with color settings (stored at agency level, not in settings)
      if (data.primaryColor || data.secondaryColor) {
        const { updateAgency } = await import('../../../lib/firebase/firestore-helpers');
        await updateAgency(newAgency.id, {
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
        });
      }

      let logoURL = null;

      // Upload logo if provided (after agency is created)
      if (logoFile) {
        try {
          const { isSparkPlan } = await import('../../../lib/firebase/config');
          if (isSparkPlan) {
            console.info('Skipping logo upload - Spark plan detected');
            toast('Logo upload skipped - not available on Spark (free) plan', { icon: 'ℹ️' });
          } else {
            logoURL = await uploadAgencyLogo(newAgency.id, logoFile);
            // Update agency with logo URL
            const { updateAgency } = await import('../../../lib/firebase/firestore-helpers');
            await updateAgency(newAgency.id, { logoURL });
          }
        } catch (error: any) {
          console.warn('Failed to upload logo:', error);
          if (error.message?.includes('Spark') || error.message?.includes('free')) {
            toast('Logo upload not available on free plan', { icon: 'ℹ️' });
          } else {
            toast('Logo upload failed, but agency was created successfully', { icon: '⚠️' });
          }
          // Continue even if logo upload fails
        }
      }

      // Update user profile with agency_id in Firestore (create if doesn't exist)
      const { updateUserDocument } = await import('../../../lib/firebase/firestore-helpers');
      await updateUserDocument(user.id, {
        agency_id: newAgency.id,
        email: user.email || data.email,
        full_name: user.email?.split('@')[0] || 'Admin',
        role: 'admin',
        employee_category: null,
      });

      // Also create employee record for the admin
      const { createEmployee } = await import('../../../lib/firebase/firestore-helpers');
      await createEmployee(newAgency.id, {
        userId: user.id,
        email: user.email || data.email,
        name: user.email?.split('@')[0] || 'Admin',
        role: 'admin',
      });

      toast.success('Organization created successfully!');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['agency'] });
      
      // Small delay to ensure queries are invalidated
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 500);
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Agency</CardTitle>
          <CardDescription>Set up your microfinance organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Agency Name *</Label>
              <Input
                id="name"
                placeholder="ABC Microfinance"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@agency.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+260 123 456 789"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                placeholder="123 Main Street, Lusaka, Zambia"
                {...register('address')}
              />
              {errors.address && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.address.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo (Optional)</Label>
              <div className="flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">Upload Logo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                {logoFile && (
                  <div className="text-sm text-slate-600">
                    <p className="font-medium">{logoFile.name}</p>
                    <p className="text-slate-500">{(logoFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    className="w-20 h-10"
                    {...register('primaryColor')}
                  />
                  <Input
                    type="text"
                    placeholder="#0ea5e9"
                    {...register('primaryColor')}
                  />
                </div>
                {errors.primaryColor && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.primaryColor.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    className="w-20 h-10"
                    {...register('secondaryColor')}
                  />
                  <Input
                    type="text"
                    placeholder="#0284c7"
                    {...register('secondaryColor')}
                  />
                </div>
                {errors.secondaryColor && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.secondaryColor.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="themeMode">Theme Mode</Label>
              <select
                id="themeMode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('themeMode')}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating organization...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

