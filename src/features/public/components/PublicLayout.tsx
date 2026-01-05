/**
 * Public Layout Component
 * Shared layout for public pages (Landing, Marketplace, About, etc.)
 * Includes navigation bar and footer
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { 
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-slate-200/50 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <img 
                  src="/logo/tengaloanlogo.png" 
                  alt="TengaLoans" 
                  className="h-10 sm:h-12 md:h-14 w-auto transition-all duration-300 group-hover:drop-shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center hidden">
                  <ShieldAlert className="w-5 h-5 text-white dark:text-slate-900" />
                </div>
              </motion.div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                  TengaLoans
                </span>
                <span className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 font-medium">AI-Powered Loan Management</span>
              </div>
            </Link>
            <div className="flex items-center gap-3 sm:gap-6">
              <Link 
                to="/marketplace" 
                className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Find a Lender
              </Link>
              <Link 
                to="/about" 
                className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                About
              </Link>
              <Link 
                to="/contact" 
                className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Contact
              </Link>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm" className="font-medium text-xs sm:text-sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="sm" className="font-medium shadow-md hover:shadow-lg transition-shadow text-xs sm:text-sm px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="/logo/tengaloanlogo.png" 
                  alt="TengaLoans" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                  TengaLoans
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                AI-Powered loan management platform for microfinance institutions. Streamline operations, reduce risk, and grow your lending business.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/about" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/marketplace" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    Find a Lender
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              © {new Date().getFullYear()} TengaLoans. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
