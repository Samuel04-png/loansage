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
  Zap,
  Brain,
  Lock,
  BarChart3,
  Sparkles,
  Clock,
  Globe,
  Smartphone,
  CreditCard,
  Shield,
  Target,
  Rocket,
  Award,
  DollarSign,
  PieChart,
  Settings,
  Headphones,
  PlayCircle
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Navigation */}
      <nav className="border-b border-slate-200/50 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <img 
                  src="/logo/loansagelogo.png" 
                  alt="LoanSage" 
                  className="h-12 w-auto transition-all duration-300 group-hover:drop-shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center hidden">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
              </motion.div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                  LoanSage
                </span>
                <span className="hidden sm:block text-xs text-slate-500 font-medium">AI-Powered Loan Management</span>
              </div>
            </Link>
            <div className="flex items-center gap-3 sm:gap-6">
              <Link 
                to="/about" 
                className="hidden sm:block text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
              >
                About
              </Link>
              <Link 
                to="/contact" 
                className="hidden sm:block text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
              >
                Contact
              </Link>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm" className="font-medium text-xs sm:text-sm">Sign In</Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="sm" className="font-medium shadow-md hover:shadow-lg transition-shadow text-xs sm:text-sm px-3 sm:px-4">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-100 text-primary-700 text-sm font-semibold mb-8 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Enterprise Microfinance Platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-tight px-4"
            >
              Streamline Your Loan
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-purple-600 to-primary-400">
                Management with AI
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed px-4"
            >
              Complete loan management solution with multi-tenant support, white-labeling, 
              and AI-driven risk assessment. Built for modern microfinance institutions.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4 mb-12"
            >
              <Link to="/auth/signup" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 font-semibold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 rounded-xl border-2 hover:bg-slate-50 font-semibold"
              >
                <PlayCircle className="mr-2 w-5 h-5" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-slate-500"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600" />
                <span className="font-medium">No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600" />
                <span className="font-medium">14-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600" />
                <span className="font-medium">Cancel Anytime</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10K+', label: 'Active Loans', icon: DollarSign },
              { value: '500+', label: 'Agencies', icon: Users },
              { value: '99.9%', label: 'Uptime', icon: Shield },
              { value: '24/7', label: 'Support', icon: Headphones },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 mb-3">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Everything you need to manage loans
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Powerful features designed for microfinance institutions of all sizes
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Users,
                title: 'Multi-Tenant Architecture',
                description: 'Isolated data for each agency with complete white-labeling support. Scale without limits.',
                color: 'from-blue-500 to-blue-600',
              },
              {
                icon: Brain,
                title: 'AI Risk Assessment',
                description: 'Powered by advanced AI for intelligent loan underwriting and automated risk analysis.',
                color: 'from-purple-500 to-purple-600',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Analytics',
                description: 'Comprehensive dashboards and reports for data-driven decisions and portfolio insights.',
                color: 'from-green-500 to-green-600',
              },
              {
                icon: FileText,
                title: 'Document Management',
                description: 'Secure storage, organization, and retrieval of all loan documents with version control.',
                color: 'from-orange-500 to-orange-600',
              },
              {
                icon: Lock,
                title: 'Role-Based Access',
                description: 'Granular permissions for admins, employees, and customers with audit trails.',
                color: 'from-red-500 to-red-600',
              },
              {
                icon: BarChart3,
                title: 'Advanced Reporting',
                description: 'Generate comprehensive reports, exports, and insights with one click.',
                color: 'from-indigo-500 to-indigo-600',
              },
              {
                icon: Smartphone,
                title: 'Mobile App',
                description: 'Full-featured mobile app for iOS and Android. Process loans on the go.',
                color: 'from-pink-500 to-pink-600',
              },
              {
                icon: Globe,
                title: 'Offline Mode',
                description: 'Work seamlessly even without internet. Sync automatically when connected.',
                color: 'from-cyan-500 to-cyan-600',
              },
              {
                icon: Settings,
                title: 'Custom Workflows',
                description: 'Configure loan approval workflows, payment schedules, and business rules.',
                color: 'from-teal-500 to-teal-600',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group p-8 rounded-2xl border border-slate-200 bg-white hover:border-primary-300 hover:shadow-2xl transition-all duration-300 cursor-pointer"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-primary-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Get started in minutes. Simple setup, powerful results.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Sign Up',
                description: 'Create your agency account in seconds. No credit card required.',
                icon: Rocket,
              },
              {
                step: '02',
                title: 'Configure',
                description: 'Set up your loan products, workflows, and branding.',
                icon: Settings,
              },
              {
                step: '03',
                title: 'Start Lending',
                description: 'Begin processing loans with AI-powered risk assessment.',
                icon: Target,
              },
              {
                step: '04',
                title: 'Scale',
                description: 'Grow your portfolio with advanced analytics and insights.',
                icon: TrendingUp,
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="relative"
              >
                {index < 3 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary-200 to-transparent -z-10" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-bold mb-4 shadow-lg">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary-50 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Trusted by microfinance institutions
            </h2>
            <p className="text-xl text-slate-600">
              See what our customers are saying
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Sarah Mumba',
                role: 'CEO, ABC Microfinance',
                content: 'LoanSage transformed how we manage our loan portfolio. The AI features are incredible and have reduced our default rate by 40%.',
                rating: 5,
                avatar: 'SM',
              },
              {
                name: 'John Banda',
                role: 'Operations Manager, XYZ Finance',
                content: 'The multi-tenant architecture allows us to scale without worrying about data isolation. Our team productivity has doubled.',
                rating: 5,
                avatar: 'JB',
              },
              {
                name: 'Grace Lungu',
                role: 'Loan Officer, MicroCredit Co',
                content: 'The mobile app makes field work so much easier. I can process loans on the go and sync everything automatically.',
                rating: 5,
                avatar: 'GL',
              },
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-600">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 bg-gradient-to-br from-slate-50 via-white to-slate-50 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              One simple plan. Full access. No hidden fees. Start your 14-day free trial today.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="relative rounded-3xl border-2 border-primary-300 p-10 bg-white shadow-2xl"
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold px-6 py-2 rounded-full shadow-lg">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-10">
                <h3 className="text-3xl font-bold text-slate-900 mb-3">Agency Full Access</h3>
                <p className="text-slate-600 text-lg mb-8">Everything you need to manage your microfinance operations</p>
                <div className="flex items-baseline justify-center gap-3 mb-4">
                  <span className="text-6xl font-extrabold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                    $20
                  </span>
                  <span className="text-2xl text-slate-600">/month</span>
                </div>
                <p className="text-sm text-slate-500">Billed monthly • Cancel anytime</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-10">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary-600" />
                    Core Features
                  </h4>
                  {[
                    'Unlimited loans & borrowers',
                    'Multi-tenant architecture',
                    'White-labeling & branding',
                    'AI-powered risk assessment',
                    'Real-time analytics & reports',
                    'Document management',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary-600" />
                    Advanced Features
                  </h4>
                  {[
                    'Role-based access control',
                    'Mobile app (iOS & Android)',
                    'Offline mode support',
                    'Custom workflows',
                    'API access',
                    'Priority support',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Link to="/auth/signup" className="block">
                  <Button
                    size="lg"
                    className="w-full h-14 rounded-xl font-semibold text-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <p className="text-sm text-slate-500 mt-4">
                  No credit card required • 14-day free trial • Cancel anytime
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center mt-12"
            >
              <p className="text-slate-600 mb-4">
                All features included. No per-user fees. No setup costs.
              </p>
              <Link to="/contact" className="text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center gap-2">
                Need a custom enterprise plan? Contact us
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Perfect for Every Microfinance Need
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Whether you're a startup or an established institution, LoanSage scales with you
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Small Agencies',
                description: 'Perfect for new microfinance institutions starting with 50-500 loans. Get all features at an affordable price.',
                icon: Rocket,
                color: 'from-blue-500 to-blue-600',
              },
              {
                title: 'Growing Institutions',
                description: 'Scale seamlessly as you grow. Handle thousands of loans with the same powerful platform.',
                icon: TrendingUp,
                color: 'from-green-500 to-green-600',
              },
              {
                title: 'Enterprise Networks',
                description: 'Multi-branch operations with centralized management. White-label for each branch.',
                icon: Globe,
                color: 'from-purple-500 to-purple-600',
              },
            ].map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="p-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:shadow-xl transition-all"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${useCase.color} rounded-xl flex items-center justify-center mb-6 shadow-lg`}>
                  <useCase.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{useCase.title}</h3>
                <p className="text-slate-600 leading-relaxed">{useCase.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary-600 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-3xl"></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Ready to transform your loan management?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-primary-100 mb-8"
          >
            Join leading microfinance institutions using LoanSage. Start your free trial today.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/auth/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-lg px-10 py-6 rounded-xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 font-semibold">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-10 py-6 rounded-xl border-2 border-white/20 bg-white/10 hover:bg-white/20 text-white font-semibold">
                Schedule Demo
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img 
                  src="/logo/loansagelogo.png" 
                  alt="LoanSage" 
                  className="h-10 w-auto"
                />
                <span className="text-2xl font-bold text-white">LoanSage</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Enterprise microfinance platform powered by AI. Transform your loan management with intelligent automation.
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Award className="w-4 h-4" />
                <span>Trusted by 500+ agencies</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} LoanSage. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>Made with ❤️ for microfinance</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
