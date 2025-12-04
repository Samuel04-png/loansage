import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/supabase/auth';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Loader2, Mail, Lock, User, AlertCircle, Eye, EyeOff, Sparkles, Building2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['admin', 'employee'], {
    required_error: 'Please select a role',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export function SignUpPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setUser, setSession, setProfile } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: 'admin',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    try {
      const result = await authService.signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
      });

      if (result.user && result.session) {
        // Store demo session if in demo mode
        const { isDemoMode } = await import('../../../lib/supabase/client');
        if (isDemoMode) {
          localStorage.setItem('demo_session', JSON.stringify(result.session));
        }

        // Try to fetch user profile with timeout
        let profile = null;
        try {
          const { supabase } = await import('../../../lib/supabase/client');
          
          // Add timeout to prevent hanging
          const profilePromise = supabase
            .from('users')
            .select('*')
            .eq('id', result.user.id)
            .single();
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          const profileResult = await Promise.race([profilePromise, timeoutPromise]) as any;
          
          if (profileResult?.data) {
            profile = profileResult.data;
          }
        } catch (error: any) {
          // If profile fetch fails or times out, create a default profile
          console.warn('Profile fetch failed, using defaults:', error);
        }
        
        // Always set a profile, even if fetch failed
        if (!profile) {
          profile = {
            id: result.user.id,
            email: result.user.email || '',
            full_name: result.user.user_metadata?.full_name || data.fullName || 'User',
            phone: null,
            role: (result.user.user_metadata?.role as 'admin' | 'employee' | 'customer') || data.role,
            employee_category: result.user.user_metadata?.employee_category || null,
            agency_id: null,
            is_active: true,
          };
        }

        // Set auth state
        setUser(result.user);
        setSession(result.session);
        setProfile(profile as any);

        if (isDemoMode) {
          toast.success('Demo account created! You can now explore the platform.');
        } else {
          toast.success('Account created! Please check your email to verify your account.');
        }
        
        if (data.role === 'admin') {
          navigate('/auth/create-organization');
        } else {
          navigate('/auth/verify-email');
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      const errorMessage = error.message || 'Failed to create account';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mx-auto mb-4 flex items-center justify-center"
            >
              <img 
                src="/logo/loansagelogo.png" 
                alt="LoanSage" 
                className="max-h-24 h-auto w-auto object-contain"
                style={{ maxWidth: '200px' }}
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg hidden">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Create an account
            </CardTitle>
            <CardDescription className="text-base">
              Get started with LoanSage today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    className="pl-11 h-12 border-2 focus:border-blue-500 transition-colors"
                    {...register('fullName')}
                  />
                </div>
                {errors.fullName && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-600 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.fullName.message}
                  </motion.p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-11 h-12 border-2 focus:border-blue-500 transition-colors"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-600 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.email.message}
                  </motion.p>
                )}
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-11 pr-11 h-12 border-2 focus:border-blue-500 transition-colors"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-red-600 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {errors.password.message}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 }}
                  className="space-y-2"
                >
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-11 pr-11 h-12 border-2 focus:border-blue-500 transition-colors"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-red-600 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {errors.confirmPassword.message}
                    </motion.p>
                  )}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <Label className="text-sm font-medium">I want to</Label>
                <div className="grid grid-cols-2 gap-4">
                  <motion.label
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex flex-col cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 ${
                      selectedRole === 'admin'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="admin"
                      className="sr-only"
                      {...register('role')}
                    />
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedRole === 'admin' ? 'bg-blue-600' : 'bg-slate-200'
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          selectedRole === 'admin' ? 'text-white' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold text-base ${
                          selectedRole === 'admin' ? 'text-blue-900' : 'text-slate-900'
                        }`}>
                          Create Agency
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          Start my own microfinance
                        </div>
                      </div>
                    </div>
                  </motion.label>
                  <motion.label
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex flex-col cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 ${
                      selectedRole === 'employee'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="employee"
                      className="sr-only"
                      {...register('role')}
                    />
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedRole === 'employee' ? 'bg-blue-600' : 'bg-slate-200'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          selectedRole === 'employee' ? 'text-white' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold text-base ${
                          selectedRole === 'employee' ? 'text-blue-900' : 'text-slate-900'
                        }`}>
                          Join as Employee
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          I have an invite
                        </div>
                      </div>
                    </div>
                  </motion.label>
                </div>
                {errors.role && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-600 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.role.message}
                  </motion.p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </motion.div>

              <div className="text-center text-sm text-slate-600 pt-2">
                Already have an account?{' '}
                <Link
                  to="/auth/login"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
