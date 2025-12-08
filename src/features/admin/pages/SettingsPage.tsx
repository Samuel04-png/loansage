import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, updateDoc, deleteDoc, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAgency } from '../../../hooks/useAgency';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/utils';
import { Upload, Download, FileText, Loader2, Save, UserPlus, Users, Building2, User, Lock, Trash2, Edit2, Database, Calculator, Percent, Calendar, DollarSign, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { createAgency, updateAgency as updateAgencyHelper } from '../../../lib/firebase/firestore-helpers';
import { uploadAgencyLogo, uploadProfilePhoto, uploadCompanyProfilePhoto } from '../../../lib/firebase/storage-helpers';
import { InviteEmployeeDrawer } from '../components/InviteEmployeeDrawer';
import { AddCustomerDrawer } from '../components/AddCustomerDrawer';
import { authService } from '../../../lib/supabase/auth';
import { exportLoans, exportCustomers, exportEmployees } from '../../../lib/data-export';
import { importCustomersFromCSV, importLoansFromCSV } from '../../../lib/data-import';
import { createCustomer } from '../../../lib/firebase/firestore-helpers';
import { createLoanTransaction } from '../../../lib/firebase/loan-transactions';
import { PaymentHistoryTab } from './PaymentHistoryTab';
import { isDeepSeekConfigured, testDeepSeekConnection } from '../../../lib/ai/deepseek-client';

const agencySchema = z.object({
  name: z.string().min(2, 'Agency name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
});

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const loanSettingsSchema = z.object({
  defaultInterestRate: z.number().min(0).max(100, 'Interest rate must be between 0 and 100%'),
  gracePeriodDays: z.number().min(0).max(30, 'Grace period must be between 0 and 30 days'),
  lateFeeRate: z.number().min(0).max(10, 'Late fee rate must be between 0 and 10%'),
  maxLateFeeRate: z.number().min(0).max(50, 'Max late fee rate must be between 0 and 50%'),
  minLoanAmount: z.number().min(0, 'Minimum loan amount must be positive'),
  maxLoanAmount: z.number().min(0, 'Maximum loan amount must be positive'),
  defaultLoanDuration: z.number().min(1).max(60, 'Default duration must be between 1 and 60 months'),
  interestCalculationMethod: z.enum(['simple', 'compound'], {
    errorMap: () => ({ message: 'Please select an interest calculation method' }),
  }),
}).refine((data) => data.maxLoanAmount >= data.minLoanAmount, {
  message: 'Maximum loan amount must be greater than or equal to minimum loan amount',
  path: ['maxLoanAmount'],
});

type AgencyFormData = z.infer<typeof agencySchema>;
type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type LoanSettingsFormData = z.infer<typeof loanSettingsSchema>;

export function SettingsPage() {
  const { agency, updateAgency, loading: agencyLoading } = useAgency();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'agency' | 'employees' | 'account' | 'data' | 'loans' | 'payments' | 'ai'>('agency');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [companyProfileFile, setCompanyProfileFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [addCustomerDrawerOpen, setAddCustomerDrawerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'customers' | 'loans' | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Agency form
  const agencyForm = useForm<AgencyFormData>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency?.name || '',
      email: '',
      phone: '',
      address: '',
    },
  });

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Loan Settings form
  const loanSettingsForm = useForm<LoanSettingsFormData>({
    resolver: zodResolver(loanSettingsSchema),
    defaultValues: {
      defaultInterestRate: agency?.settings?.loanSettings?.defaultInterestRate || 15,
      gracePeriodDays: agency?.settings?.loanSettings?.gracePeriodDays || 7,
      lateFeeRate: agency?.settings?.loanSettings?.lateFeeRate || 2.5,
      maxLateFeeRate: agency?.settings?.loanSettings?.maxLateFeeRate || 25,
      minLoanAmount: agency?.settings?.loanSettings?.minLoanAmount || 1000,
      maxLoanAmount: agency?.settings?.loanSettings?.maxLoanAmount || 1000000,
      defaultLoanDuration: agency?.settings?.loanSettings?.defaultLoanDuration || 12,
      interestCalculationMethod: agency?.settings?.loanSettings?.interestCalculationMethod || 'simple',
    },
  });

  // Fetch employees
  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['employees', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const snapshot = await getDocs(employeesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && activeTab === 'employees',
  });

  // Fetch data for export
  const { data: loans } = useQuery({
    queryKey: ['all-loans-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const snapshot = await getDocs(loansRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && activeTab === 'data',
  });

  const { data: customers } = useQuery({
    queryKey: ['all-customers-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const customersRef = collection(db, 'agencies', profile.agency_id, 'customers');
      const snapshot = await getDocs(customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && activeTab === 'data',
  });

  const { data: employeesForExport } = useQuery({
    queryKey: ['all-employees-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      const employeesRef = collection(db, 'agencies', profile.agency_id, 'employees');
      const snapshot = await getDocs(employeesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!profile?.agency_id && activeTab === 'data',
  });

  const handleExport = (type: 'loans' | 'customers' | 'employees', format: 'csv' | 'xlsx' = 'xlsx') => {
    if (type === 'loans' && loans) {
      exportLoans(loans, { format });
      toast.success(`Loans exported to ${format.toUpperCase()} successfully`);
    } else if (type === 'customers' && customers) {
      exportCustomers(customers, { format });
      toast.success(`Customers exported to ${format.toUpperCase()} successfully`);
    } else if (type === 'employees' && employeesForExport) {
      exportEmployees(employeesForExport, { format });
      toast.success(`Employees exported to ${format.toUpperCase()} successfully`);
    } else {
      toast.error('No data available to export');
    }
  };

  const handleImport = async (type: 'customers' | 'loans') => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!profile?.agency_id || !user?.id) {
      toast.error('Agency information not available');
      return;
    }

    setImporting(true);
    setImportType(type);
    setImportResult(null);

    try {
      if (type === 'customers') {
        const result = await importCustomersFromCSV(
          file,
          profile.agency_id,
          user.id,
          async (agencyId, data) => {
            await createCustomer(agencyId, data);
          }
        );
        setImportResult(result);
        
        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} customers`);
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} customers`);
        }
      } else if (type === 'loans') {
        const { findCustomerByIdentifier } = await import('../../../lib/data-import');
        const result = await importLoansFromCSV(
          file,
          profile.agency_id,
          user.id,
          async (agencyId, loanData) => {
            await createLoanTransaction({
              agencyId,
              ...loanData,
            });
          },
          async (agencyId, identifier) => {
            return await findCustomerByIdentifier(agencyId, identifier);
          }
        );
        setImportResult(result);
        
        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} loans`);
          queryClient.invalidateQueries({ queryKey: ['loans'] });
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} loans`);
        }
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import data');
      setImportResult({ success: 0, failed: 0, errors: [error.message] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Update forms when data loads
  useEffect(() => {
    if (agency) {
      agencyForm.reset({
        name: agency.name || '',
        email: (agency as any).email || '',
        phone: (agency as any).phone || '',
        address: (agency as any).address || '',
      });
    }
  }, [agency, agencyForm]);

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        fullName: profile.full_name || '',
      });
    }
  }, [profile, profileForm]);

  useEffect(() => {
    if (agency?.settings?.loanSettings) {
      loanSettingsForm.reset({
        defaultInterestRate: agency.settings.loanSettings.defaultInterestRate || 15,
        gracePeriodDays: agency.settings.loanSettings.gracePeriodDays || 7,
        lateFeeRate: agency.settings.loanSettings.lateFeeRate || 2.5,
        maxLateFeeRate: agency.settings.loanSettings.maxLateFeeRate || 25,
        minLoanAmount: agency.settings.loanSettings.minLoanAmount || 1000,
        maxLoanAmount: agency.settings.loanSettings.maxLoanAmount || 1000000,
        defaultLoanDuration: agency.settings.loanSettings.defaultLoanDuration || 12,
        interestCalculationMethod: agency.settings.loanSettings.interestCalculationMethod || 'simple',
      });
    }
  }, [agency, loanSettingsForm]);

  // Create or update agency
  const handleAgencySubmit = async (data: AgencyFormData) => {
    if (!user?.id || !profile) {
      toast.error('User information not available');
      return;
    }

    setLoading(true);
    try {
      let logoURL = agency?.logo_url || null;
      let companyProfileURL = agency?.company_profile_url || null;

      if (agency && profile.agency_id) {
        // Upload logo if provided (for existing agency)
        if (logoFile) {
          logoURL = await uploadAgencyLogo(profile.agency_id, logoFile);
        }
        
        // Upload company profile photo if provided
        if (companyProfileFile) {
          try {
            companyProfileURL = await uploadCompanyProfilePhoto(profile.agency_id, companyProfileFile);
          } catch (error: any) {
            console.warn('Failed to upload company profile photo:', error);
            toast('Company profile photo upload failed, but agency was updated', { icon: '⚠️' });
          }
        }
        // Update existing agency - only include logoURL if it has a value
        const updateData: any = {
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
        };
        if (logoURL) {
          updateData.logoURL = logoURL;
        }
        if (companyProfileURL) {
          updateData.companyProfileURL = companyProfileURL;
        }
        await updateAgencyHelper(profile.agency_id, updateData);
        await updateAgency({
          name: data.name,
          logo_url: logoURL,
          company_profile_url: companyProfileURL,
        } as any);
        
        // Invalidate queries to refresh agency list in dropdown
        queryClient.invalidateQueries({ queryKey: ['user-agencies'] });
        queryClient.invalidateQueries({ queryKey: ['agency'] });
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('agency-updated'));
        
        toast.success('Agency updated successfully!');
      } else {
        // Create new agency first (without logo)
        const newAgency = await createAgency({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          createdBy: user.id,
          logoURL: undefined, // Will upload logo after agency is created
        });

        // Upload logo if provided (after agency is created)
        if (logoFile) {
          try {
            logoURL = await uploadAgencyLogo(newAgency.id, logoFile);
            // Update agency with logo URL
            await updateAgencyHelper(newAgency.id, { logoURL });
          } catch (error: any) {
            console.warn('Failed to upload logo:', error);
            toast('Logo upload failed, but agency was created successfully', { icon: '⚠️' });
            // Continue even if logo upload fails
          }
        }

        // Update user profile with agency_id in Firestore (create if doesn't exist)
        const { updateUserDocument } = await import('../../../lib/firebase/firestore-helpers');
        await updateUserDocument(user.id, {
          agency_id: newAgency.id,
          email: user.email || '',
          full_name: profile.full_name || user.email?.split('@')[0] || 'Admin',
          role: profile.role || 'admin',
          employee_category: profile.employee_category || null,
        });

        // Also create employee record for the admin
        const { createEmployee } = await import('../../../lib/firebase/firestore-helpers');
        await createEmployee(newAgency.id, {
          userId: user.id,
          email: user.email || '',
          name: profile.full_name || user.email?.split('@')[0] || 'Admin',
          role: 'admin',
        });

        toast.success('Agency created successfully!');
        queryClient.invalidateQueries({ queryKey: ['agency'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        
        // Refresh agency data
        const { useAgencyStore } = await import('../../../stores/agencyStore');
        useAgencyStore.getState().fetchAgency(newAgency.id);
      }

      setLogoFile(null);
    } catch (error: any) {
      console.error('Error saving agency:', error);
      toast.error(error.message || 'Failed to save agency');
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const handleProfileSubmit = async (data: ProfileFormData) => {
    if (!profile?.id) {
      toast.error('Profile not available');
      return;
    }

    setLoading(true);
    try {
      // Upload avatar if provided
      let photoURL = profile.photoURL || profile.photo_url;
      if (avatarFile) {
        try {
          photoURL = await uploadProfilePhoto(profile.id, avatarFile);
        } catch (error: any) {
          console.warn('Failed to upload avatar:', error);
          toast.error('Failed to upload avatar, but profile was updated');
        }
      }

      // Update profile in Firestore
      const { doc, updateDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', profile.id);
      const updateData: any = { full_name: data.fullName };
      if (photoURL) {
        updateData.photoURL = photoURL;
        updateData.photo_url = photoURL; // Also set photo_url for compatibility
      }
      await updateDoc(userRef, updateData);

      // Also update Firebase Auth profile
      if (photoURL) {
        const { updateProfile: updateAuthProfile } = await import('firebase/auth');
        const { auth } = await import('../../../lib/firebase/config');
        if (auth.currentUser) {
          await updateAuthProfile(auth.currentUser, { photoURL });
        }
      }

      toast.success('Profile updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setAvatarFile(null);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setLoading(true);
    try {
      await authService.updatePassword(data.newPassword);
      passwordForm.reset();
      toast.success('Password updated successfully!');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Update loan settings
  const handleLoanSettingsSubmit = async (data: LoanSettingsFormData) => {
    if (!profile?.agency_id) {
      toast.error('Agency information not available');
      return;
    }

    setLoading(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const agencyRef = doc(db, 'agencies', profile.agency_id);
      
      // Get current settings or create new object
      const currentSettings = agency?.settings || {};
      
      await updateDoc(agencyRef, {
        settings: {
          ...currentSettings,
          loanSettings: {
            defaultInterestRate: data.defaultInterestRate,
            gracePeriodDays: data.gracePeriodDays,
            lateFeeRate: data.lateFeeRate,
            maxLateFeeRate: data.maxLateFeeRate,
            minLoanAmount: data.minLoanAmount,
            maxLoanAmount: data.maxLoanAmount,
            defaultLoanDuration: data.defaultLoanDuration,
            interestCalculationMethod: data.interestCalculationMethod,
            updatedAt: serverTimestamp(),
          },
        },
        updatedAt: serverTimestamp(),
      });

      // Update local agency state
      await updateAgency({
        ...agency,
        settings: {
          ...currentSettings,
          loanSettings: data,
        },
      } as any);

      queryClient.invalidateQueries({ queryKey: ['agency'] });
      toast.success('Loan settings updated successfully!');
    } catch (error: any) {
      console.error('Error updating loan settings:', error);
      toast.error(error.message || 'Failed to update loan settings');
    } finally {
      setLoading(false);
    }
  };

  // Remove employee
  const handleRemoveEmployee = async (employeeId: string) => {
    if (!profile?.agency_id) return;

    if (!confirm('Are you sure you want to remove this employee?')) return;

    try {
      const employeeRef = doc(db, 'agencies', profile.agency_id, 'employees', employeeId);
      await updateDoc(employeeRef, { status: 'disabled' });
      toast.success('Employee removed successfully');
      refetchEmployees();
    } catch (error: any) {
      console.error('Error removing employee:', error);
      toast.error(error.message || 'Failed to remove employee');
    }
  };

  if (agencyLoading && !agency) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">Settings</h2>
          <p className="text-sm text-neutral-600">Loading settings...</p>
        </motion.div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Reference Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Settings</h2>
        <p className="text-sm text-neutral-600">Manage your agency and account settings</p>
      </motion.div>

      {/* Tabs - Reference Style with ShadCN Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-6 rounded-xl bg-neutral-100 p-1">
          <TabsTrigger 
            value="agency" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Agency
          </TabsTrigger>
          <TabsTrigger 
            value="loans"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Loan Settings
          </TabsTrigger>
          <TabsTrigger 
            value="employees"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger 
            value="account"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <User className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger 
            value="data"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <Database className="w-4 h-4 mr-2" />
            Data
          </TabsTrigger>
          <TabsTrigger 
            value="ai"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#006BFF] data-[state=active]:shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Settings
          </TabsTrigger>
        </TabsList>

        {/* Agency Settings Tab */}
        <TabsContent value="agency" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <form onSubmit={agencyForm.handleSubmit(handleAgencySubmit)}>
              <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-neutral-900">Organization Settings</CardTitle>
                  <CardDescription className="text-sm text-neutral-600">
                    {agency ? 'Update your agency information' : 'Create your agency organization'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-neutral-900">Agency Name *</Label>
                    <Input
                      id="name"
                      {...agencyForm.register('name')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        agencyForm.formState.errors.name && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {agencyForm.formState.errors.name && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {agencyForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold text-neutral-900">Business Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...agencyForm.register('email')}
                        className={cn(
                          "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                          agencyForm.formState.errors.email && 'border-[#EF4444] focus:border-[#EF4444]'
                        )}
                      />
                      {agencyForm.formState.errors.email && (
                        <p className="text-sm text-[#EF4444] mt-1">
                          {agencyForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-semibold text-neutral-900">Business Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        {...agencyForm.register('phone')}
                        className={cn(
                          "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                          agencyForm.formState.errors.phone && 'border-[#EF4444] focus:border-[#EF4444]'
                        )}
                      />
                      {agencyForm.formState.errors.phone && (
                        <p className="text-sm text-[#EF4444] mt-1">
                          {agencyForm.formState.errors.phone.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-semibold text-neutral-900">Address *</Label>
                    <Input
                      id="address"
                      {...agencyForm.register('address')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        agencyForm.formState.errors.address && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {agencyForm.formState.errors.address && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {agencyForm.formState.errors.address.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-neutral-900">Company Logo</Label>
                    <div className="flex items-center gap-4">
                      {agency?.logo_url && (
                        <img src={agency.logo_url} alt="Current logo" className="h-16 w-auto rounded-lg border border-neutral-200" />
                      )}
                      <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
                        <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                        <span className="text-sm text-neutral-500">Upload Logo</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {logoFile && (
                      <p className="text-sm text-neutral-600 mt-2">Selected: {logoFile.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-neutral-900">Company Profile Picture</Label>
                    <div className="flex items-center gap-4">
                      {agency?.company_profile_url && (
                        <img src={agency.company_profile_url} alt="Company profile" className="h-32 w-32 rounded-lg object-cover border border-neutral-200" />
                      )}
                      <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
                        <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                        <span className="text-sm text-neutral-500">Upload Photo</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => setCompanyProfileFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {companyProfileFile && (
                      <p className="text-sm text-neutral-600 mt-2">Selected: {companyProfileFile.name}</p>
                    )}
                    <p className="text-xs text-neutral-500">This will be used as the company's profile picture</p>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-neutral-200">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {agency ? 'Update Agency' : 'Create Agency'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </motion.div>
        </TabsContent>

        {/* Loan Settings Tab */}
        <TabsContent value="loans" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <form onSubmit={loanSettingsForm.handleSubmit(handleLoanSettingsSubmit)}>
              <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#006BFF]" />
                    Loan Calculation Settings
                  </CardTitle>
                  <CardDescription className="text-sm text-neutral-600">
                    Configure default interest rates, late fees, and loan calculation parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Interest Rate Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Interest Rate Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="defaultInterestRate" className="text-sm font-semibold text-neutral-900">
                          Default Interest Rate (%)
                        </Label>
                        <Input
                          id="defaultInterestRate"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          {...loanSettingsForm.register('defaultInterestRate', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.defaultInterestRate && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.defaultInterestRate && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.defaultInterestRate.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Default interest rate applied to new loans (0-100%)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interestCalculationMethod" className="text-sm font-semibold text-neutral-900">
                          Interest Calculation Method
                        </Label>
                        <select
                          id="interestCalculationMethod"
                          {...loanSettingsForm.register('interestCalculationMethod')}
                          className={cn(
                            "flex h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.interestCalculationMethod && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        >
                          <option value="simple">Simple Interest</option>
                          <option value="compound">Compound Interest</option>
                        </select>
                        {loanSettingsForm.formState.errors.interestCalculationMethod && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.interestCalculationMethod.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Method used to calculate interest on loans
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Late Fee Settings */}
                  <div className="space-y-4 pt-4 border-t border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Late Fee Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="gracePeriodDays" className="text-sm font-semibold text-neutral-900">
                          Grace Period (Days)
                        </Label>
                        <Input
                          id="gracePeriodDays"
                          type="number"
                          step="1"
                          min="0"
                          max="30"
                          {...loanSettingsForm.register('gracePeriodDays', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.gracePeriodDays && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.gracePeriodDays && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.gracePeriodDays.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Days before late fees are applied
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lateFeeRate" className="text-sm font-semibold text-neutral-900">
                          Late Fee Rate (% per month)
                        </Label>
                        <Input
                          id="lateFeeRate"
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          {...loanSettingsForm.register('lateFeeRate', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.lateFeeRate && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.lateFeeRate && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.lateFeeRate.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Percentage charged per month on overdue amount
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxLateFeeRate" className="text-sm font-semibold text-neutral-900">
                          Maximum Late Fee Rate (%)
                        </Label>
                        <Input
                          id="maxLateFeeRate"
                          type="number"
                          step="0.1"
                          min="0"
                          max="50"
                          {...loanSettingsForm.register('maxLateFeeRate', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.maxLateFeeRate && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.maxLateFeeRate && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.maxLateFeeRate.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Maximum late fee as percentage of loan amount
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Loan Amount Limits */}
                  <div className="space-y-4 pt-4 border-t border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Loan Amount Limits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="minLoanAmount" className="text-sm font-semibold text-neutral-900">
                          Minimum Loan Amount (ZMW)
                        </Label>
                        <Input
                          id="minLoanAmount"
                          type="number"
                          step="100"
                          min="0"
                          {...loanSettingsForm.register('minLoanAmount', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.minLoanAmount && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.minLoanAmount && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.minLoanAmount.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Minimum amount allowed for new loans
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxLoanAmount" className="text-sm font-semibold text-neutral-900">
                          Maximum Loan Amount (ZMW)
                        </Label>
                        <Input
                          id="maxLoanAmount"
                          type="number"
                          step="1000"
                          min="0"
                          {...loanSettingsForm.register('maxLoanAmount', { valueAsNumber: true })}
                          className={cn(
                            "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                            loanSettingsForm.formState.errors.maxLoanAmount && 'border-[#EF4444] focus:border-[#EF4444]'
                          )}
                        />
                        {loanSettingsForm.formState.errors.maxLoanAmount && (
                          <p className="text-sm text-[#EF4444] mt-1">
                            {loanSettingsForm.formState.errors.maxLoanAmount.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Maximum amount allowed for new loans
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Default Loan Duration */}
                  <div className="space-y-4 pt-4 border-t border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Default Loan Duration
                    </h3>
                    <div className="space-y-2">
                      <Label htmlFor="defaultLoanDuration" className="text-sm font-semibold text-neutral-900">
                        Default Loan Duration (Months)
                      </Label>
                      <Input
                        id="defaultLoanDuration"
                        type="number"
                        step="1"
                        min="1"
                        max="60"
                        {...loanSettingsForm.register('defaultLoanDuration', { valueAsNumber: true })}
                        className={cn(
                          "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                          loanSettingsForm.formState.errors.defaultLoanDuration && 'border-[#EF4444] focus:border-[#EF4444]'
                        )}
                      />
                      {loanSettingsForm.formState.errors.defaultLoanDuration && (
                        <p className="text-sm text-[#EF4444] mt-1">
                          {loanSettingsForm.formState.errors.defaultLoanDuration.message}
                        </p>
                      )}
                      <p className="text-xs text-neutral-500">
                        Default repayment period for new loans (1-60 months)
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-neutral-200">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Loan Settings
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </motion.div>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">Employee Management</h3>
                <p className="text-sm text-neutral-600">Manage your agency employees</p>
              </div>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setInviteDrawerOpen(true);
                }}
                type="button"
                className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Employee
              </Button>
            </div>

            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
            <CardContent className="p-0">
              {employees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left">Employee</th>
                        <th className="px-6 py-3 text-left">Role</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp: any) => (
                        <tr key={emp.id} className="border-b hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium">{emp.name || 'N/A'}</div>
                              <div className="text-xs text-slate-500">{emp.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="capitalize">
                              {emp.role?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {emp.status === 'active' ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // TODO: Implement edit role
                                  toast('Edit role functionality coming soon', { icon: 'ℹ️' });
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEmployee(emp.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No employees yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInviteDrawerOpen(true);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite First Employee
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white mt-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-neutral-900">Customer Management</CardTitle>
                <CardDescription className="text-sm text-neutral-600">Quick access to add customers</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setAddCustomerDrawerOpen(true)}
                  className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-neutral-900">Profile Information</CardTitle>
                <CardDescription className="text-sm text-neutral-600">Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                  {/* Avatar Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-neutral-900">Profile Picture</Label>
                    <div className="flex items-center gap-4">
                      {(profile?.photoURL || profile?.photo_url) && (
                        <img 
                          src={profile.photoURL || profile.photo_url} 
                          alt="Profile" 
                          className="h-24 w-24 rounded-full object-cover border-2 border-neutral-200" 
                        />
                      )}
                      {!profile?.photoURL && !profile?.photo_url && (
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#006BFF] to-[#4F46E5] flex items-center justify-center text-white text-2xl font-semibold border-2 border-neutral-200">
                          {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
                        <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                        <span className="text-sm text-neutral-500">Upload Avatar</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {avatarFile && (
                      <p className="text-sm text-neutral-600 mt-2">Selected: {avatarFile.name}</p>
                    )}
                    <p className="text-xs text-neutral-500">This will be displayed in the header and throughout the app</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-neutral-900">Email</Label>
                    <Input 
                      id="email" 
                      value={user?.email || ''} 
                      disabled 
                      className="rounded-xl border-neutral-200 bg-neutral-50"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-semibold text-neutral-900">Full Name</Label>
                    <Input
                      id="fullName"
                      {...profileForm.register('fullName')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        profileForm.formState.errors.fullName && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {profileForm.formState.errors.fullName && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {profileForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end pt-4 border-t border-neutral-200">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-neutral-900">Change Password</CardTitle>
                <CardDescription className="text-sm text-neutral-600">Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-semibold text-neutral-900">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      {...passwordForm.register('currentPassword')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        passwordForm.formState.errors.currentPassword && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-semibold text-neutral-900">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      {...passwordForm.register('newPassword')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        passwordForm.formState.errors.newPassword && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-neutral-900">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...passwordForm.register('confirmPassword')}
                      className={cn(
                        "rounded-xl border-neutral-200 focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF]",
                        passwordForm.formState.errors.confirmPassword && 'border-[#EF4444] focus:border-[#EF4444]'
                      )}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-[#EF4444] mt-1">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end pt-4 border-t border-neutral-200">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Update Password
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-neutral-900">Data Management</CardTitle>
                <CardDescription className="text-sm text-neutral-600">
                  Import and export customer, loan, and employee data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Export Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Export Data</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <FileText className="h-5 w-5 text-primary-600" />
                        <Badge>{loans?.length || 0} loans</Badge>
                      </div>
                      <h4 className="font-semibold mb-1">Loans</h4>
                      <p className="text-sm text-slate-500 mb-3">Export all loan data</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('loans', 'xlsx')}
                          disabled={!loans || loans.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('loans', 'csv')}
                          disabled={!loans || loans.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="h-5 w-5 text-primary-600" />
                        <Badge>{customers?.length || 0} customers</Badge>
                      </div>
                      <h4 className="font-semibold mb-1">Customers</h4>
                      <p className="text-sm text-slate-500 mb-3">Export all customer data</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('customers', 'xlsx')}
                          disabled={!customers || customers.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('customers', 'csv')}
                          disabled={!customers || customers.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <UserPlus className="h-5 w-5 text-primary-600" />
                        <Badge>{employeesForExport?.length || 0} employees</Badge>
                      </div>
                      <h4 className="font-semibold mb-1">Employees</h4>
                      <p className="text-sm text-slate-500 mb-3">Export all employee data</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('employees', 'xlsx')}
                          disabled={!employeesForExport || employeesForExport.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport('employees', 'csv')}
                          disabled={!employeesForExport || employeesForExport.length === 0}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                </div>

                {/* Import Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Import Data</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                    <CardHeader>
                      <CardTitle>Import Customers</CardTitle>
                      <CardDescription>Upload a CSV or Excel file to import customers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImport('customers');
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing && importType === 'customers'}
                        className="w-full"
                      >
                        {importing && importType === 'customers' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Select File (CSV/Excel)
                          </>
                        )}
                      </Button>
                      {importResult && importType === 'customers' && (
                        <div className="text-sm space-y-1">
                          <p className="text-green-600">✓ {importResult.success} imported successfully</p>
                          {importResult.failed > 0 && (
                            <p className="text-red-600">✗ {importResult.failed} failed</p>
                          )}
                          {importResult.errors.length > 0 && importResult.errors.length <= 5 && (
                            <div className="text-xs text-red-500 mt-2">
                              {importResult.errors.map((error, idx) => (
                                <p key={idx}>{error}</p>
                              ))}
                            </div>
                          )}
                          {importResult.errors.length > 5 && (
                            <p className="text-xs text-red-500 mt-2">
                              {importResult.errors.length} errors. Check console for details.
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Import Loans</CardTitle>
                      <CardDescription>Upload a CSV or Excel file to import loans</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImport('loans');
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing && importType === 'loans'}
                        className="w-full"
                      >
                        {importing && importType === 'loans' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Select File (CSV/Excel)
                          </>
                        )}
                      </Button>
                      {importResult && importType === 'loans' && (
                        <div className="text-sm space-y-1">
                          <p className="text-green-600">✓ {importResult.success} imported successfully</p>
                          {importResult.failed > 0 && (
                            <p className="text-red-600">✗ {importResult.failed} failed</p>
                          )}
                          {importResult.errors.length > 0 && importResult.errors.length <= 5 && (
                            <div className="text-xs text-red-500 mt-2">
                              {importResult.errors.map((error, idx) => (
                                <p key={idx}>{error}</p>
                              ))}
                            </div>
                          )}
                          {importResult.errors.length > 5 && (
                            <p className="text-xs text-red-500 mt-2">
                              {importResult.errors.length} errors. Check console for details.
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Payment History Tab */}
        <TabsContent value="payments" className="mt-6">
          <PaymentHistoryTab />
        </TabsContent>

        {/* AI Settings Tab */}
        <TabsContent value="ai" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-6"
          >
            <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-neutral-900">DeepSeek AI Configuration</CardTitle>
                <CardDescription className="text-sm text-neutral-600">
                  Configure and test your DeepSeek AI integration for intelligent loan analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-neutral-900">API Key Status</p>
                      <p className="text-sm text-neutral-600 mt-1">
                        {isDeepSeekConfigured() 
                          ? 'API key is configured and ready to use'
                          : 'API key not found. Add VITE_DEEP_SEEK_API_KEY to your .env.local file'}
                      </p>
                    </div>
                    {isDeepSeekConfigured() ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>

                  {isDeepSeekConfigured() && (
                    <div className="space-y-4">
                      <Button
                        onClick={async () => {
                          setTestingAI(true);
                          setAiTestResult(null);
                          try {
                            const result = await testDeepSeekConnection();
                            setAiTestResult(result);
                            if (result.success) {
                              toast.success('DeepSeek AI is working correctly!');
                            } else {
                              toast.error(result.message);
                            }
                          } catch (error: any) {
                            setAiTestResult({
                              success: false,
                              message: error.message || 'Failed to test connection',
                            });
                            toast.error('Failed to test DeepSeek connection');
                          } finally {
                            setTestingAI(false);
                          }
                        }}
                        disabled={testingAI}
                        className="w-full bg-gradient-to-r from-[#006BFF] to-[#3B82FF] hover:from-[#0052CC] hover:to-[#006BFF] text-white"
                      >
                        {testingAI ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Test DeepSeek Connection
                          </>
                        )}
                      </Button>

                      {aiTestResult && (
                        <div className={`p-4 rounded-xl border ${
                          aiTestResult.success 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            {aiTestResult.success ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}
                            <div>
                              <p className={`font-semibold ${
                                aiTestResult.success ? 'text-green-900' : 'text-red-900'
                              }`}>
                                {aiTestResult.success ? 'Connection Successful!' : 'Connection Failed'}
                              </p>
                              <p className={`text-sm mt-1 ${
                                aiTestResult.success ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {aiTestResult.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-neutral-50 rounded-xl">
                        <p className="text-sm font-semibold text-neutral-900 mb-2">AI Features Enabled:</p>
                        <ul className="text-sm text-neutral-700 space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Collateral Valuation - AI-powered market price estimation
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Risk Scoring - Intelligent loan risk assessment
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Smart Notifications - AI-driven recommendations
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            NRC Risk Analysis - Historical pattern analysis
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Loan Summaries - AI-generated loan insights
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {!isDeepSeekConfigured() && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <p className="text-sm font-semibold text-yellow-900 mb-2">Setup Required:</p>
                      <p className="text-sm text-yellow-800 mb-3">
                        To enable AI features, you need to add your DeepSeek API key to the <code className="bg-yellow-100 px-1 rounded">.env.local</code> file in the project root.
                      </p>
                      <p className="text-sm text-yellow-800">
                        Get your API key from: <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">platform.deepseek.com</a>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Drawers */}
      <InviteEmployeeDrawer
        open={inviteDrawerOpen}
        onOpenChange={setInviteDrawerOpen}
        onSuccess={() => {
          refetchEmployees();
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />

      <AddCustomerDrawer
        open={addCustomerDrawerOpen}
        onOpenChange={setAddCustomerDrawerOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }}
      />
    </div>
  );
}
