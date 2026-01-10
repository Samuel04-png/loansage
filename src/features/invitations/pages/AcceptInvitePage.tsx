import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/supabase/auth';
import { getInvitationByToken, acceptInvitation, createEmployee, linkCustomerToUser } from '../../../lib/firebase/firestore-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const acceptInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Full name is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
  });

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        toast.error('Invalid invitation link');
        navigate('/auth/login');
        return;
      }

      try {
        const invite = await getInvitationByToken(token);

        if (!invite) {
          toast.error('Invitation not found');
          navigate('/auth/login');
          return;
        }

        if (invite.status === 'accepted') {
          toast.error('This invitation has already been accepted');
          navigate('/auth/login');
          return;
        }

        // Handle expiresAt - could be Timestamp, Date, or string
        let expiresAt: Date;
        if (invite.expiresAt?.toDate) {
          expiresAt = invite.expiresAt.toDate();
        } else if (invite.expiresAt instanceof Date) {
          expiresAt = invite.expiresAt;
        } else if (invite.expiresAt) {
          expiresAt = new Date(invite.expiresAt);
        } else {
          // Default to 7 days from now if not set
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
        }

        if (expiresAt < new Date()) {
          toast.error('This invitation has expired');
          navigate('/auth/login');
          return;
        }

        setInvitation(invite);
        setValue('email', invite.email);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load invitation');
        navigate('/auth/login');
      } finally {
        setLoadingInvite(false);
      }
    };

    fetchInvitation();
  }, [token, navigate, setValue]);

  const onSubmit = async (data: AcceptInviteFormData) => {
    if (!invitation || !token) return;

    setLoading(true);
    try {
      const isCustomer = invitation.role === 'customer';
      const isEmployee = invitation.role && invitation.role !== 'customer';
      
      // For employees, the role should be 'employee' and employee_category should be the specific role
      const userRole = isEmployee ? 'employee' : (isCustomer ? 'customer' : invitation.role);
      const employeeCategory = isEmployee ? invitation.role : undefined;

      let user: any;
      let session: any;
      let isExistingUser = false;

      // Try to create auth user
      try {
        const result = await authService.signUp({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: userRole,
          employeeCategory: employeeCategory,
        });
        user = result.user;
        session = result.session;
      } catch (signUpError: any) {
        // If email already exists, try to sign in instead
        if (signUpError.message?.includes('email-already-in-use') || signUpError.code === 'auth/email-already-in-use') {
          toast.error('An account with this email already exists. Please sign in instead.');
          navigate('/auth/login?email=' + encodeURIComponent(data.email));
          return;
        }
        throw signUpError;
      }

      if (!user || !session) throw new Error('Failed to create user');

      console.log('Step 1: User created successfully:', user.id);
      
      // Wait for auth to fully propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create or update user record in Firestore (via users collection)
      console.log('Step 2: Creating user record in Firestore...');
      const { supabase } = await import('../../../lib/supabase/client');
      
      // Try to insert first, if it fails due to existing record, update instead
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: data.email,
          full_name: data.fullName,
          role: userRole,
          employee_category: employeeCategory || null,
          agency_id: invitation.agencyId,
        });

      // If insert fails because record exists, update instead
      if (insertError && insertError.code !== '23505') { // 23505 is unique violation in PostgreSQL
        console.error('Error creating user record:', insertError);
        // Try update instead
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: data.fullName,
            role: userRole,
            employee_category: employeeCategory || null,
            agency_id: invitation.agencyId,
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating user record:', updateError);
          throw new Error(`Failed to update user record: ${updateError.message}`);
        }
      }
      
      console.log('Step 2: User record created/updated successfully');

      // Handle employee invitations
      if (isEmployee && invitation.agencyId) {
        console.log('Step 3: Creating employee record...');
        try {
          await createEmployee(invitation.agencyId, {
            userId: user.id,
            email: data.email,
            name: data.fullName,
            role: invitation.role as any, // This is the employee category (loan_officer, manager, etc.)
          });
          console.log('Step 3: Employee record created successfully');
        } catch (employeeError: any) {
          console.error('Error creating employee record:', employeeError);
          // Don't fail the whole process if employee creation fails
          // The user is still created and can be linked later
          toast.error(`Account created but employee record failed: ${employeeError.message}`);
        }
      }

      // Handle customer invitations - link customer record to user
      if (isCustomer && invitation.customerId && invitation.agencyId) {
        console.log('Step 3: Linking customer record to user...');
        try {
          await linkCustomerToUser(invitation.agencyId, invitation.customerId, user.id);
          console.log('Step 3: Customer linked successfully');
        } catch (linkError: any) {
          console.error('Error linking customer:', linkError);
          // Continue anyway - the user account is created
          toast.error(`Account created but failed to link customer: ${linkError.message}`);
        }
      }

      // Mark invitation as accepted - must be done while authenticated
      try {
        // Wait a moment to ensure user is fully authenticated
        await new Promise(resolve => setTimeout(resolve, 500));
        await acceptInvitation(invitation.agencyId, invitation.id, user.id, token || undefined);
      } catch (acceptError: any) {
        console.error('Error accepting invitation:', acceptError);
        // If permission error, try again after a short delay (user might not be fully synced)
        if (acceptError.message?.includes('permission') || acceptError.code === 'permission-denied') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            await acceptInvitation(invitation.agencyId, invitation.id, user.id, token || undefined);
          } catch (retryError: any) {
            console.error('Error accepting invitation on retry:', retryError);
            toast.error(`Account created but failed to mark invitation as accepted. Please contact support.`);
          }
        } else {
          toast.error(`Account created but failed to mark invitation as accepted: ${acceptError.message}`);
        }
      }

      toast.success(
        'Account created successfully! Please check your email to verify your account, then sign in.',
        { duration: 6000 }
      );
      
      // Small delay to show success message
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigate('/auth/login');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast.error(error.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#006BFF] mb-4" />
            <p className="text-sm text-neutral-600">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-white" />
          </div>
            <CardTitle className="text-2xl font-bold">Invitation Not Found</CardTitle>
          <CardDescription>
              This invitation link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0F172A] dark:to-[#1E293B] p-4">
      <Card className="w-full max-w-md shadow-xl border border-neutral-200/50 dark:border-neutral-800/50">
        <CardHeader className="space-y-1 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto w-12 h-12 bg-gradient-to-br from-[#006BFF] to-[#4F46E5] rounded-full flex items-center justify-center mb-4 shadow-lg"
          >
            <CheckCircle2 className="w-6 h-6 text-white" />
          </motion.div>
          <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Accept Invitation</CardTitle>
          <CardDescription className="text-neutral-600 dark:text-neutral-400">
            You've been invited to join this agency as {invitation.role === 'customer' ? 'a Customer' : invitation.role?.replace('_', ' ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#006BFF]/10 dark:bg-blue-900/20 border border-[#006BFF]/20 dark:border-blue-500/30 rounded-xl p-4 mb-4"
            >
              <p className="text-sm font-semibold text-[#006BFF] dark:text-blue-400 mb-1">
                Role: {invitation.role === 'customer' ? 'Customer' : invitation.role?.replace('_', ' ') || 'Employee'}
              </p>
              {invitation.note && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2">
                  {invitation.note}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  {...register('email')}
                  disabled
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">This email will be used for your account</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <Label htmlFor="fullName">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  className="pl-10"
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName.message}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Must be at least 6 characters</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept Invitation & Create Account
                  </>
              )}
            </Button>
            </motion.div>

            <Link to="/auth/login">
              <Button variant="ghost" className="w-full">
                Already have an account? Sign in
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

