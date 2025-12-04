import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Mail, CheckCircle2, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../../lib/firebase/config';
import toast from 'react-hot-toast';

export function VerifyEmailPage() {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    setResending(true);
    try {
      await sendEmailVerification(user);
      toast.success('Verification email sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification email');
    } finally {
      setResending(false);
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
              className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            >
              <Mail className="w-8 h-8 text-white" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Verify your email
            </CardTitle>
            <CardDescription className="text-base">
              We've sent a verification link to your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900 font-semibold mb-1">
                    Check your inbox
                  </p>
                  <p className="text-sm text-blue-700">
                    Click the verification link in the email we sent to complete your account setup.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4"
            >
              <p className="text-sm font-medium text-slate-900 mb-2">Didn't receive the email?</p>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
                <li>Check your spam or junk folder</li>
                <li>Make sure the email address is correct</li>
                <li>Wait a few minutes and try again</li>
                <li>Click the button below to resend</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    Resend verification email
                  </>
                )}
              </Button>
              <Link to="/auth/login">
                <Button variant="ghost" className="w-full h-12">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
