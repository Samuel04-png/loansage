import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/supabase/auth';
import { getInvitationByToken, acceptInvitation, createEmployee } from '../../../lib/firebase/firestore-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

        const expiresAt = invite.expiresAt?.toDate?.() || new Date(invite.expiresAt);
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
      // Create auth user
      const { user, session } = await authService.signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: invitation.role,
        employeeCategory: invitation.role,
      });

      if (!user || !session) throw new Error('Failed to create user');

      // Create user record in Firestore (via users collection)
      const { supabase } = await import('../../../lib/supabase/client');
      await supabase
        .from('users')
        .insert({
          id: user.id,
          email: data.email,
          full_name: data.fullName,
          role: invitation.role,
          employee_category: invitation.role,
          agency_id: invitation.agencyId,
        });

      // Create employee record in Firestore
      if (invitation.role && invitation.agencyId) {
        await createEmployee(invitation.agencyId, {
          userId: user.id,
          email: data.email,
          name: data.fullName,
          role: invitation.role as any,
        });
      }

      // Mark invitation as accepted
      await acceptInvitation(invitation.agencyId, invitation.id, user.id);

      toast.success('Account created successfully! Please verify your email.');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Accept Invitation</CardTitle>
          <CardDescription>
            You've been invited to join this agency as {invitation.role?.replace('_', ' ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-primary-900">
                <strong>Role:</strong> {invitation.role?.replace('_', ' ') || 'Employee'}
              </p>
              {invitation.note && (
                <p className="text-sm text-primary-700 mt-1">
                  <strong>Note:</strong> {invitation.note}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  {...register('email')}
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  className="pl-10"
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Accept Invitation & Create Account'
              )}
            </Button>

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

