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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
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
      const { user, session } = await authService.signIn(data);

      if (user && session) {
        // Store demo session if in demo mode
        const { isDemoMode } = await import('../../../lib/supabase/client');
        if (isDemoMode) {
          localStorage.setItem('demo_session', JSON.stringify(session));
        }

        // Try to fetch user profile with timeout
        let profile = null;
        try {
          const { supabase } = await import('../../../lib/supabase/client');
          
          // Add timeout to prevent hanging
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
          // If profile fetch fails or times out, create a default profile
          console.warn('Profile fetch failed, using defaults:', error);
        }
        
        // Always set a profile, even if fetch failed
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

        // Set auth state first (don't wait for profile updates)
        setUser(user);
        setSession(session);
        setProfile(profile as any);

        toast.success('Welcome back!');
        
        // Update last login in background (non-blocking)
        Promise.resolve().then(async () => {
          try {
            const { supabase } = await import('../../../lib/supabase/client');
            const updatePromise = supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', user.id);
            
            // Add timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Update timeout')), 3000)
            );
            
            await Promise.race([updatePromise, timeoutPromise]);
          } catch (error) {
            // Ignore errors - not critical for login
            console.warn('Failed to update last login:', error);
          }
        });
        
        // Redirect based on role
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
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
              Welcome back
            </CardTitle>
            <CardDescription className="text-base">
              Sign in to your account to continue
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

              <div className="flex items-center justify-between">
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </motion.div>

              <div className="text-center text-sm text-slate-600 pt-2">
                Don't have an account?{' '}
                <Link
                  to="/auth/signup"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
