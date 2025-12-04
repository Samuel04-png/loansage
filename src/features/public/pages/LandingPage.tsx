import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { 
  ShieldAlert, 
  TrendingUp, 
  Users, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Star,
  Zap
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img 
                src="/logo/loansagelogo.png" 
                alt="LoanSage" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center hidden">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">LoanSage</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900">
                About
              </Link>
              <Link to="/contact" className="text-sm text-slate-600 hover:text-slate-900">
                Contact
              </Link>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-700 text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Enterprise Microfinance Platform
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Manage Loans with
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">
                AI-Powered Intelligence
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
              Complete loan management solution with multi-tenant support, white-labeling, 
              and AI-driven risk assessment for modern microfinance institutions.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/auth/signup">
                <Button size="lg" className="text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8">
                Watch Demo
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything you need to manage loans
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features designed for microfinance institutions of all sizes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Multi-Tenant Architecture',
                description: 'Isolated data for each agency with complete white-labeling support',
              },
              {
                icon: ShieldAlert,
                title: 'AI Risk Assessment',
                description: 'Powered by Google Gemini for intelligent loan underwriting',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Analytics',
                description: 'Comprehensive dashboards and reports for data-driven decisions',
              },
              {
                icon: FileText,
                title: 'Document Management',
                description: 'Secure storage and organization of all loan documents',
              },
              {
                icon: CheckCircle2,
                title: 'Role-Based Access',
                description: 'Granular permissions for admins, employees, and customers',
              },
              {
                icon: Zap,
                title: 'Mobile Ready',
                description: 'Full-featured mobile apps for iOS and Android',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-xl border border-slate-200 hover:border-primary-300 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Trusted by microfinance institutions
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Sarah Mumba',
                role: 'CEO, ABC Microfinance',
                content: 'LoanSage transformed how we manage our loan portfolio. The AI features are incredible.',
                rating: 5,
              },
              {
                name: 'John Banda',
                role: 'Operations Manager, XYZ Finance',
                content: 'The multi-tenant architecture allows us to scale without worrying about data isolation.',
                rating: 5,
              },
              {
                name: 'Grace Lungu',
                role: 'Loan Officer, MicroCredit Co',
                content: 'The mobile app makes field work so much easier. I can process loans on the go.',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 bg-white rounded-xl border border-slate-200"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-600">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to transform your loan management?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join leading microfinance institutions using LoanSage
          </p>
          <Link to="/auth/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">LoanSage</span>
              </div>
              <p className="text-sm">
                Enterprise microfinance platform powered by AI.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
                <li><a href="#" className="hover:text-white">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} LoanSage. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

