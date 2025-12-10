import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/supabase/auth';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AnimatedIllustration } from '../../../components/auth/AnimatedIllustration';
import { SocialLoginButtons } from '../../../components/auth/SocialLoginButtons';
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setUser, setSession, setProfile } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const from = (location.state as any)?.from?.pathname || '/';

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const signInData: { email: string; password: string } = {
        email: data.email as string,
        password: data.password as string,
      };
      const { user, session } = await authService.signIn(signInData);

      if (user && session) {
        const { isDemoMode } = await import('../../../lib/supabase/client');
        if (isDemoMode) {
          localStorage.setItem('demo_session', JSON.stringify(session));
        }

        let profile = null;
        try {
          const { supabase } = await import('../../../lib/supabase/client');
          const profilePromise = supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          const result = await Promise.race([profilePromise, timeoutPromise]) as any;
          if (result?.data) {
            profile = result.data;
          }
        } catch (error: any) {
          console.warn('Profile fetch failed, using defaults:', error);
        }
        
        if (!profile) {
          profile = {
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || data.email.split('@')[0] || 'User',
            phone: null,
            role: (user.user_metadata?.role as 'admin' | 'employee' | 'customer') || 'admin',
            employee_category: user.user_metadata?.employee_category || null,
            agency_id: null,
            is_active: true,
          };
        }

        setUser(user as any);
        setSession(session as any);
        setProfile(profile as any);

        toast.success('Welcome back!');
        
        // Update last login in background (non-blocking, don't wait for it)
        Promise.resolve().then(async () => {
          try {
            const { supabase } = await import('../../../lib/supabase/client');
            const updatePromise = supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', user.id);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Update timeout')), 10000) // Increased to 10 seconds
            );
            await Promise.race([updatePromise, timeoutPromise]);
          } catch (error) {
            // Silently fail - this is not critical
            console.warn('Failed to update last login (non-critical):', error);
          }
        }).catch(() => {
          // Ignore errors - this is a background operation
        });
        
        const userRole = profile?.role || user.user_metadata?.role || 'admin';
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'employee') {
          navigate('/employee/dashboard', { replace: true });
        } else if (userRole === 'customer') {
          navigate('/customer/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Failed to sign in';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
        <AnimatedIllustration variant="login" />
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
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiIHJlc3VsdD0ibm9pc2UiLz48ZmVDb2xvck1hdHJpeCBpbj0ibm9pc2UiIHR5cGU9InNhdHVyYXRlIiB2YWx1ZXM9IjAiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-30 rounded-3xl pointer-events-none"></div>
            
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 sm:p-10">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="flex justify-center mb-6"
              >
                <img 
                  src="/logo/loansagelogo.png" 
                  alt="LoanSage" 
                  className="h-12 w-auto"
                />
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-8"
              >
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Welcome Back! 👋
                </h1>
                <p className="text-slate-600">
                  Sign in to your account to continue
                </p>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                    Email
                  </Label>
                  <div className="relative group">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-all ${
                      errors.email ? 'text-red-500 animate-pulse' : 'text-slate-400 group-focus-within:text-primary-600'
                    }`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className={`pl-11 h-12 rounded-xl border-2 transition-all ${
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
                      className="text-sm text-red-600 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {errors.email.message}
                    </motion.p>
                  )}
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      Password
                    </Label>
                    <Link
                      to="/auth/forgot-password"
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-11 pr-11 h-12 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </motion.div>

                {/* Divider */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="relative my-6"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-slate-500">Or continue with</span>
                  </div>
                </motion.div>

                {/* Social Login */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <SocialLoginButtons />
                </motion.div>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-center text-sm text-slate-600 pt-4"
                >
                  Don't have an account?{' '}
                  <Link
                    to="/auth/signup"
                    className="text-primary-600 hover:text-primary-700 font-semibold hover:underline transition-colors"
                  >
                    Create one
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
