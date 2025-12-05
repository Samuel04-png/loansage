import { motion } from 'framer-motion';
import { TrendingUp, Users, FileText, BarChart3, Shield, Zap } from 'lucide-react';

interface AnimatedIllustrationProps {
  variant?: 'signup' | 'login' | 'forgot' | 'reset';
}

export function AnimatedIllustration({ variant = 'signup' }: AnimatedIllustrationProps) {
  const floatingCards = [
    { icon: TrendingUp, delay: 0, color: 'from-blue-500 to-blue-600' },
    { icon: Users, delay: 0.2, color: 'from-purple-500 to-purple-600' },
    { icon: FileText, delay: 0.4, color: 'from-green-500 to-green-600' },
    { icon: BarChart3, delay: 0.6, color: 'from-orange-500 to-orange-600' },
    { icon: Shield, delay: 0.8, color: 'from-red-500 to-red-600' },
    { icon: Zap, delay: 1, color: 'from-indigo-500 to-indigo-600' },
  ];

  return (
    <div className="relative h-full w-full flex items-center justify-center p-8 overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-10 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-10 right-10 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 20, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>

      {/* Main illustration container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Character/Device illustration */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative mb-8"
        >
          {/* Laptop/Device */}
          <div className="relative mx-auto">
            <motion.div
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-64 h-40 mx-auto bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl shadow-2xl border-4 border-white relative overflow-hidden"
            >
              {/* Screen content */}
              <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3">
                <div className="space-y-2">
                  <div className="h-2 bg-blue-200 rounded w-3/4"></div>
                  <div className="h-2 bg-blue-200 rounded w-1/2"></div>
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    <div className="h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded"></div>
                    <div className="h-8 bg-gradient-to-br from-purple-400 to-purple-500 rounded"></div>
                    <div className="h-8 bg-gradient-to-br from-green-400 to-green-500 rounded"></div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Person sitting (simplified SVG-style) */}
            <motion.div
              animate={{
                y: [0, -5, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2"
            >
              <div className="w-24 h-24 relative">
                {/* Head */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full border-4 border-white shadow-lg"></div>
                {/* Body */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-16 h-20 bg-gradient-to-br from-blue-400 to-blue-500 rounded-t-2xl border-4 border-white shadow-lg"></div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Floating analytics cards */}
        <div className="relative">
          {floatingCards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: [
                  Math.cos((index * Math.PI * 2) / floatingCards.length) * 120,
                  Math.cos((index * Math.PI * 2) / floatingCards.length) * 130,
                  Math.cos((index * Math.PI * 2) / floatingCards.length) * 120,
                ],
                y: [
                  Math.sin((index * Math.PI * 2) / floatingCards.length) * 80,
                  Math.sin((index * Math.PI * 2) / floatingCards.length) * 90,
                  Math.sin((index * Math.PI * 2) / floatingCards.length) * 80,
                ],
              }}
              transition={{
                duration: 4 + index * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: card.delay,
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className={`w-16 h-20 bg-gradient-to-br ${card.color} rounded-xl shadow-xl border-2 border-white/50 backdrop-blur-sm flex flex-col items-center justify-center p-3`}>
                <card.icon className="w-6 h-6 text-white mb-1" />
                <div className="w-full h-1 bg-white/30 rounded mt-1"></div>
                <div className="w-3/4 h-1 bg-white/20 rounded mt-1"></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Welcome text animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-32"
        >
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="text-2xl font-bold text-slate-800 mb-2"
          >
            {variant === 'signup' && 'Welcome to LoanSage 🚀'}
            {variant === 'login' && 'Welcome Back! 👋'}
            {variant === 'forgot' && 'Reset Your Password 🔐'}
            {variant === 'reset' && 'Create New Password ✨'}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="text-slate-600 text-sm"
          >
            {variant === 'signup' && 'Start managing loans with AI-powered intelligence'}
            {variant === 'login' && 'Sign in to continue your journey'}
            {variant === 'forgot' && 'We\'ll help you get back in'}
            {variant === 'reset' && 'Choose a strong password to secure your account'}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

