import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">LoanSage</span>
            </Link>
            <Link to="/auth/login">
              <button className="text-sm text-slate-600 hover:text-slate-900">Sign In</button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <div className="prose prose-slate max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-700">
              By accessing and using LoanSage, you accept and agree to be bound by the terms and 
              provision of this agreement. If you do not agree to these terms, please do not use 
              our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Use License</h2>
            <p className="text-slate-700 mb-2">Permission is granted to temporarily use LoanSage for:</p>
            <ul className="list-disc list-inside text-slate-700 space-y-2">
              <li>Personal or commercial microfinance management</li>
              <li>Loan origination and portfolio management</li>
              <li>Customer and employee management</li>
              <li>Financial reporting and analytics</li>
            </ul>
            <p className="text-slate-700 mt-4">This license shall automatically terminate if you violate any of these restrictions.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. User Accounts</h2>
            <p className="text-slate-700">
              You are responsible for maintaining the confidentiality of your account credentials. 
              You agree to notify us immediately of any unauthorized use of your account. You are 
              responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Prohibited Uses</h2>
            <p className="text-slate-700 mb-2">You may not use LoanSage:</p>
            <ul className="list-disc list-inside text-slate-700 space-y-2">
              <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
              <li>To violate any international, federal, provincial, or state regulations, rules, or laws</li>
              <li>To infringe upon or violate our intellectual property rights or the rights of others</li>
              <li>To harass, abuse, insult, harm, defame, or discriminate</li>
              <li>To submit false or misleading information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Service Availability</h2>
            <p className="text-slate-700">
              We strive to ensure LoanSage is available 24/7, but we do not guarantee uninterrupted 
              access. We reserve the right to modify, suspend, or discontinue the service at any 
              time with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Limitation of Liability</h2>
            <p className="text-slate-700">
              In no event shall LoanSage or its suppliers be liable for any damages (including, 
              without limitation, damages for loss of data or profit, or due to business interruption) 
              arising out of the use or inability to use LoanSage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Indemnification</h2>
            <p className="text-slate-700">
              You agree to indemnify and hold harmless LoanSage, its officers, directors, employees, 
              and agents from any claims, damages, losses, liabilities, and expenses arising out of 
              your use of the service or violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Changes to Terms</h2>
            <p className="text-slate-700">
              We reserve the right to modify these terms at any time. We will notify users of any 
              material changes via email or through the service. Your continued use of LoanSage 
              after such modifications constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Contact Information</h2>
            <p className="text-slate-700">
              If you have any questions about these Terms of Service, please contact us at 
              legal@loansage.com
            </p>
          </section>

          <section>
            <p className="text-sm text-slate-500">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

