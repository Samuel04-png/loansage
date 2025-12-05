import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Chrome, Github, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';

export function SocialLoginButtons() {
  const handleSocialLogin = async (provider: 'google' | 'github' | 'facebook') => {
    try {
      // TODO: Implement OAuth with Firebase
      toast.info(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`);
    } catch (error: any) {
      toast.error(`Failed to sign in with ${provider}`);
    }
  };

  const socialProviders = [
    { name: 'Google', icon: Chrome, provider: 'google' as const, color: 'hover:bg-red-50 hover:border-red-200' },
    { name: 'GitHub', icon: Github, provider: 'github' as const, color: 'hover:bg-slate-50 hover:border-slate-300' },
    { name: 'Facebook', icon: Facebook, provider: 'facebook' as const, color: 'hover:bg-blue-50 hover:border-blue-200' },
  ];

  return (
    <div className="space-y-3">
      {socialProviders.map((social, index) => (
        <motion.div
          key={social.name}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + index * 0.1 }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSocialLogin(social.provider)}
            className={`w-full h-11 rounded-xl border-2 transition-all duration-200 ${social.color}`}
          >
            <social.icon className="mr-3 h-5 w-5" />
            Continue with {social.name}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

