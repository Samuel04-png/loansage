import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckoutButton } from '../stripe/CheckoutButton';
import { PLAN_CONFIG, type PlanCode } from '../../lib/pricing/plan-config';
import { Zap, Crown, Check } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  currentPlan: PlanCode;
  requiredPlan: PlanCode;
}

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  currentPlan,
  requiredPlan,
}: UpgradeModalProps) {
  const currentPlanConfig = PLAN_CONFIG[currentPlan];
  const requiredPlanConfig = PLAN_CONFIG[requiredPlan];

  const getFeatureBenefits = () => {
    if (requiredPlan === 'professional') {
      return [
        'Unlimited customers & loans',
        'Up to 3 loan types',
        'AI risk insights & early-warning alerts',
        'Collateral valuation tools',
        'Multi-user support (Admin + Staff)',
        'Advanced analytics dashboard',
      ];
    } else if (requiredPlan === 'enterprise') {
      return [
        'Everything in Professional, plus:',
        'Unlimited loan types',
        'Multi-branch support',
        'Advanced AI predictions',
        'Scheduled reports (CSV/PDF)',
        'API access',
        'White-label branding',
        'Priority support',
      ];
    }
    return [];
  };

  const benefits = getFeatureBenefits();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {requiredPlan === 'professional' ? (
              <Zap className="w-6 h-6 text-[#006BFF]" />
            ) : (
              <Crown className="w-6 h-6 text-[#006BFF]" />
            )}
            Upgrade Required
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {feature ? (
              <>
                <span className="font-semibold">{feature}</span> is available on the{' '}
                <span className="font-semibold text-[#006BFF]">{requiredPlanConfig.name}</span> plan.
              </>
            ) : (
              <>
                This feature is available on the{' '}
                <span className="font-semibold text-[#006BFF]">{requiredPlanConfig.name}</span> plan.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Current Plan vs Required Plan */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Current Plan</p>
              <p className="text-lg font-semibold">{currentPlanConfig.name}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                ${currentPlanConfig.price}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Upgrade To</p>
              <p className="text-lg font-semibold text-[#006BFF]">
                {requiredPlanConfig.name}
              </p>
              <p className="text-sm text-[#006BFF] font-medium">
                ${requiredPlanConfig.price}/month
              </p>
            </div>
          </div>

          {/* Benefits List */}
          <div>
            <h3 className="font-semibold text-lg mb-3">What you'll get:</h3>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-700 dark:text-neutral-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <CheckoutButton
              plan={requiredPlan}
              className="flex-1 bg-[#006BFF] hover:bg-[#0052CC] text-white"
            >
              Upgrade to {requiredPlanConfig.name} - ${requiredPlanConfig.price}/month
            </CheckoutButton>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="sm:flex-shrink-0"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

