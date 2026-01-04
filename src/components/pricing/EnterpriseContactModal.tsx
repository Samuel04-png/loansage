import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Mail, CreditCard, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EnterpriseContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnterpriseContactModal({ open, onOpenChange }: EnterpriseContactModalProps) {
  const [selectedOption, setSelectedOption] = useState<'pay' | 'contact' | null>(null);

  const enterpriseBenefits = [
    'Up to 20,000 customers, 10,000 active loans',
    'White-label branding & priority support SLAs',
    'Advanced analytics & scheduled reports',
    'Full API (read/write) & webhooks',
    'Scheduled AI up to 1,000/day (metered)',
    'High caps with overage billing options',
    'Unlimited users & branches',
    '200 GB storage',
  ];

  const handlePayNow = () => {
    // Redirect to signup with enterprise plan
    window.location.href = '/auth/signup?plan=enterprise';
  };

  const handleContact = () => {
    window.location.href = `mailto:hello@byteandberry.com?subject=Enterprise Plan Inquiry&body=Hello,%0D%0A%0D%0AI'm interested in learning more about your Enterprise plan with unlimited access. Please provide more information.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Enterprise Plan Options
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            Choose how you'd like to proceed with the Enterprise plan
          </DialogDescription>
        </DialogHeader>

        {!selectedOption ? (
          <div className="space-y-4 mt-4">
            {/* Pay Now Option */}
            <button
              onClick={() => setSelectedOption('pay')}
              className="w-full p-6 rounded-xl border-2 border-slate-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-6 h-6 text-primary-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Pay $499.99/month</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Get started immediately with the standard Enterprise plan
                  </p>
                  <div className="space-y-2">
                    {enterpriseBenefits.slice(0, 4).map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </button>

            {/* Contact Option */}
            <button
              onClick={() => setSelectedOption('contact')}
              className="w-full p-6 rounded-xl border-2 border-slate-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-6 h-6 text-primary-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Contact for Higher Plan</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Need unlimited access or a custom plan? Contact us for tailored solutions
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Unlimited customers & loans</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Custom features & integrations</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Dedicated account manager</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Priority support & SLA guarantees</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </button>
          </div>
        ) : selectedOption === 'pay' ? (
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Enterprise Plan - $499.99/month</h3>
              <div className="space-y-2 mb-6">
                {enterpriseBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePayNow}
                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                <CreditCard className="mr-2 w-4 h-4" />
                Proceed to Payment
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedOption(null)}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Us for Custom Enterprise Plan</h3>
              <p className="text-slate-600 mb-4">
                Our team will work with you to create a plan that fits your needs, including:
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Unlimited customers, loans, and users</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Custom features and integrations</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Dedicated account manager</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Priority support with SLA guarantees</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Volume discounts and flexible billing</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-slate-900 mb-1">Email us at:</p>
                <a
                  href="mailto:hello@byteandberry.com"
                  className="text-primary-600 hover:text-primary-700 font-semibold text-base"
                >
                  hello@byteandberry.com
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleContact}
                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                <Mail className="mr-2 w-4 h-4" />
                Open Email Client
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedOption(null)}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
