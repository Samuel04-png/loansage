import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/supabase/auth';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import { AnimatedIllustration } from '../../../components/auth/AnimatedIllustration';
import { SocialLoginButtons } from '../../../components/auth/SocialLoginButtons';
import { Loader2, Mail, Lock, User, AlertCircle, Eye, EyeOff, Building2, Users } from 'lucide-react';
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
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setUser, setSession, setProfile } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: 'admin',
      agreeToTerms: false,
    },
  });

  const agreeToTerms = watch('agreeToTerms');

  const selectedRole = watch('role');
  const emailValue = watch('email');

  // Show referral code if present
  useEffect(() => {
    if (referralCode) {
      toast.success(`You were referred by someone! Using referral code: ${referralCode}`, { duration: 5000 });
    }
  }, [referralCode]);

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    try {
      const result = await authService.signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        referralCode: referralCode || undefined,
      });

      if (result.user && result.session) {
        const { isDemoMode } = await import('../../../lib/supabase/client');
        if (isDemoMode) {
          localStorage.setItem('demo_session', JSON.stringify(result.session));
        }

        let profile = null;
        try {
          const { supabase } = await import('../../../lib/supabase/client');
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
          console.warn('Profile fetch failed, using defaults:', error);
        }
        
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
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
        <AnimatedIllustration variant="signup" />
      </div>

      {/* Right Side - Auth Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Glassmorphism Card */}
          <div className="relative">
            {/* Noise texture overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiIHJlc3VsdD0ibm9pc2UiLz48ZmVDb2xvck1hdHJpeCBpbj0ibm9pc2UiIHR5cGU9InNhdHVyYXRlIiB2YWx1ZXM9IjAiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-30 rounded-3xl pointer-events-none"></div>
            
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-6 sm:p-8">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="flex justify-center mb-4"
              >
                <img 
                  src="/logo/tengaloanlogo.png" 
                  alt="TengaLoans" 
                  className="h-36 w-auto"
                />
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-6"
              >
                <h1 className="text-2xl font-bold text-slate-900 mb-1">
                  Welcome to TengaLoans 🚀
                </h1>
                <p className="text-sm text-slate-600">
                  Create your account to get started
                </p>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Full Name */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                    Full Name
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      className="pl-10 h-10 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
                      {...register('fullName')}
                    />
                  </div>
                  {errors.fullName && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.fullName.message}
                    </motion.p>
                  )}
                </motion.div>

                {/* Email */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="space-y-2"
                >
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email
                  </Label>
                  <div className="relative group">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-all ${
                      errors.email ? 'text-red-500 animate-pulse' : 'text-slate-400 group-focus-within:text-primary-600'
                    }`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className={`pl-10 h-10 rounded-xl border-2 transition-all text-sm ${
                        errors.email 
                          ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                          : 'border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                      }`}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.email.message}
                    </motion.p>
                  )}
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-10 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.password.message}
                    </motion.p>
                  )}
                </motion.div>

                {/* Confirm Password */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-10 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-600 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword.message}
                    </motion.p>
                  )}
                </motion.div>

                {/* Role Selection */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-2"
                >
                  <Label className="text-sm font-semibold text-slate-700">I want to</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 ${
                        selectedRole === 'admin'
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        value="admin"
                        className="sr-only"
                        {...register('role')}
                      />
                      <div className={`p-1.5 rounded-lg transition-colors mr-2 ${
                        selectedRole === 'admin' ? 'bg-primary-600' : 'bg-slate-200'
                      }`}>
                        <Building2 className={`w-4 h-4 ${
                          selectedRole === 'admin' ? 'text-white' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold text-xs ${
                          selectedRole === 'admin' ? 'text-primary-900' : 'text-slate-900'
                        }`}>
                          Create Agency
                        </div>
                      </div>
                    </motion.label>
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 ${
                        selectedRole === 'employee'
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        value="employee"
                        className="sr-only"
                        {...register('role')}
                      />
                      <div className={`p-1.5 rounded-lg transition-colors mr-2 ${
                        selectedRole === 'employee' ? 'bg-primary-600' : 'bg-slate-200'
                      }`}>
                        <Users className={`w-4 h-4 ${
                          selectedRole === 'employee' ? 'text-white' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold text-xs ${
                          selectedRole === 'employee' ? 'text-primary-900' : 'text-slate-900'
                        }`}>
                          Join Employee
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

                {/* Terms Checkbox */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="flex items-start gap-2"
                >
                  <Checkbox
                    id="agreeToTerms"
                    className="mt-0.5"
                    checked={agreeToTerms}
                    onChange={(e) => setValue('agreeToTerms', e.target.checked, { shouldValidate: true })}
                  />
                  <Label htmlFor="agreeToTerms" className="text-xs text-slate-600 leading-tight cursor-pointer flex-1">
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary-600 hover:text-primary-700 font-semibold">
                      Terms
                    </Link>
                    {' '}&{' '}
                    <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-semibold">
                      Privacy
                    </Link>
                  </Label>
                </motion.div>
                {errors.agreeToTerms && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-600 flex items-center gap-1.5 -mt-3"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.agreeToTerms.message}
                  </motion.p>
                )}

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </motion.div>

                {/* Divider */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="relative my-4"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-500">Or continue with</span>
                  </div>
                </motion.div>

                {/* Social Login */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <SocialLoginButtons />
                </motion.div>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-center text-xs text-slate-600 pt-2"
                >
                  Already have an account?{' '}
                  <Link
                    to="/auth/login"
                    className="text-primary-600 hover:text-primary-700 font-semibold hover:underline transition-colors"
                  >
                    Sign In
                  </Link>
                </motion.div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
