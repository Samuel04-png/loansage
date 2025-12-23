import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Building2, Upload, AlertCircle, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAgency } from '../../../lib/firebase/firestore-helpers';
import { uploadAgencyLogo } from '../../../lib/firebase/storage-helpers';
import { initializeAgencyLoanConfig, DEFAULT_LOAN_TYPE_TEMPLATES } from '../../../lib/firebase/loan-type-config';
import type { LoanTypeId } from '../../../types/loan-config';

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
  const [step, setStep] = useState(1);
  const [selectedLoanTypes, setSelectedLoanTypes] = useState<LoanTypeId[]>(['collateral_based', 'salary_based', 'personal_unsecured']);
  const { user } = useAuthStore();
  const { setProfile } = useAuthStore();

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
      <div className="min-h-screen flex items-center justify-center bg-background">
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

      let logoURL = null;

      // Upload logo if provided (after agency is created)
      if (logoFile) {
        try {
          logoURL = await uploadAgencyLogo(newAgency.id, logoFile);
        } catch (error: any) {
          console.warn('Failed to upload logo:', error);
          toast('Logo upload failed, but agency was created successfully', { icon: '⚠️' });
          // Continue even if logo upload fails
        }
      }

      // Update agency with color settings and logo (stored at agency level, not in settings)
      const { updateAgency } = await import('../../../lib/firebase/firestore-helpers');
      const agencyUpdates: any = {};
      
      if (data.primaryColor) {
        agencyUpdates.primary_color = data.primaryColor;
      }
      if (data.secondaryColor) {
        agencyUpdates.secondary_color = data.secondaryColor;
      }
      if (logoURL) {
        agencyUpdates.logoURL = logoURL;
        agencyUpdates.logo_url = logoURL; // Also set logo_url for compatibility
      }
      
      if (Object.keys(agencyUpdates).length > 0) {
        await updateAgency(newAgency.id, agencyUpdates);
      }

      // Update user profile with agency_id in Firestore (create if doesn't exist)
      const { updateUserDocument } = await import('../../../lib/firebase/firestore-helpers');
      await updateUserDocument(user.id, {
        agency_id: newAgency.id,
        email: user.email || data.email,
        full_name: user.email?.split('@')[0] || 'Admin',
        role: 'admin',
        employee_category: null,
        onboardingCompleted: true, // Mark onboarding as completed
      });

      // Update the auth store profile immediately so ProtectedRoute doesn't redirect
      const updatedProfile = {
        id: user.id,
        email: user.email || data.email,
        full_name: user.email?.split('@')[0] || 'Admin',
        phone: null,
        role: 'admin' as const,
        employee_category: null,
        agency_id: newAgency.id,
        is_active: true,
        onboardingCompleted: true,
      };
      setProfile(updatedProfile as any);

      // Also create employee record for the admin
      const { createEmployee } = await import('../../../lib/firebase/firestore-helpers');
      await createEmployee(newAgency.id, {
        userId: user.id,
        email: user.email || data.email,
        name: user.email?.split('@')[0] || 'Admin',
        role: 'admin',
      });

      // Initialize loan type configuration
      try {
        await initializeAgencyLoanConfig(newAgency.id, selectedLoanTypes);
      } catch (error: any) {
        console.warn('Failed to initialize loan config:', error);
        toast('Loan configuration initialization failed, but agency was created. You can configure it in Settings.', { icon: '⚠️' });
      }

      toast.success('Organization created successfully!');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['agency'] });
      
      // Fetch the agency in the store to ensure name and logo are available
      const { useAgencyStore } = await import('../../../stores/agencyStore');
      const agencyStore = useAgencyStore.getState();
      
      // Update the store with the complete agency data immediately
      agencyStore.fetchAgency(newAgency.id).catch((err) => {
        console.warn('Failed to fetch agency in store:', err);
        // Still navigate even if fetch fails
      });
      
      // Small delay to ensure store is updated before navigation
      setTimeout(() => {
        navigate('/admin/dashboard', { replace: true });
      }, 300);
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleLoanTypeToggle = (loanTypeId: LoanTypeId) => {
    setSelectedLoanTypes(prev => 
      prev.includes(loanTypeId)
        ? prev.filter(id => id !== loanTypeId)
        : [...prev, loanTypeId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate basic info
      handleSubmit((data) => {
        setStep(2);
      })();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Agency</CardTitle>
          <CardDescription>
            Step {step} of 2: {step === 1 ? 'Basic Information' : 'Loan Types'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form onSubmit={handleSubmit(handleNext)} className="space-y-6">
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
                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted">
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

              <Button type="submit" className="w-full">
                Next: Select Loan Types
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Loan Types</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which loan types your agency will offer. You can modify these later in Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2">
                {Object.values(DEFAULT_LOAN_TYPE_TEMPLATES).map((template) => {
                  const isSelected = selectedLoanTypes.includes(template.id);
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleLoanTypeToggle(template.id)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{template.name}</h4>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                            {template.defaultConfig.collateralRequirement === 'required' && (
                              <Badge variant="secondary" className="text-xs">Secured</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedLoanTypes.length === 0 && (
                <p className="text-sm text-destructive">Please select at least one loan type</p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={loading || selectedLoanTypes.length === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating organization...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

