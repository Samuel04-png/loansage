import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CreditCard, Check, X, Zap, Crown, Building2, AlertCircle, Gift } from 'lucide-react';
import { useAgency } from '../../../hooks/useAgency';
import { Link } from 'react-router-dom';
import { CheckoutButton } from '../../../components/stripe/CheckoutButton';
import { useEffect, useState } from 'react';
import { getAgencyPlanStatus, type PlanType } from '../../../lib/firebase/subscription-helpers';
import { Badge } from '../../../components/ui/badge';
import toast from 'react-hot-toast';
import { useFeatureGate } from '../../../hooks/useFeatureGate';
import { PLAN_CONFIG, normalizePlanCode, type PlanCode } from '../../../lib/pricing/plan-config';

// Plan display configuration
const planDisplayConfig: Record<PlanCode, { icon: typeof Building2; popular?: boolean }> = {
  starter: { icon: Building2 },
  professional: { icon: Zap, popular: true },
  enterprise: { icon: Crown },
};

const planFeatures: Record<PlanCode, string[]> = {
  starter: [
    'Multiple loan types',
    'Up to 200 customers, 100 active loans',
    '3 users included',
    'Core loan & customer management',
    'AI risk (rule-based, 50/mo)',
    'Collateral valuation (basic, 50/mo)',
    'Email & in-app notifications (300/mo)',
    'CSV export; manual status updates (no automation)',
  ],
  professional: [
    'Up to 2,000 customers, 1,000 active loans',
    'Up to 10 users, up to 5 branches',
    'Automation: interest accrual, overdue checks, reminders',
    'PDF export + advanced dashboards',
    'AI risk (DeepSeek-enabled, 500/mo)',
    'Collateral valuation (market-based, 300/mo)',
    'Notifications 5,000/mo; scheduled AI 50/day; reports 30/mo',
    'API read-only (rate-limited)',
  ],
  enterprise: [
    'Up to 20,000 customers, 10,000 active loans',
    'White-label branding & priority support SLAs',
    'Advanced analytics & scheduled reports',
    'Full API (read/write) & webhooks',
    'Scheduled AI up to 1,000/day (metered)',
    'High caps with overage billing options',
  ],
};

const planLimitations: Record<PlanCode, string[]> = {
  starter: [
    'No automation (scheduled jobs)',
    'No PDF exports (CSV only)',
    'No API access',
    'No multi-branch',
  ],
  professional: [
    'No write-enabled API/webhooks',
    'No white-label branding',
  ],
  enterprise: [],
};

export function PlansPage() {
  const { agency } = useAgency();
  const { isDecemberSpecial, daysUntilGating, plan } = useFeatureGate();
  const [planStatus, setPlanStatus] = useState<{
    planType: PlanType;
    status: string;
    isActive: boolean;
    daysRemaining?: number;
    shouldDowngrade: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agency) {
      setLoading(false);
      return;
    }
    
    try {
      const status = getAgencyPlanStatus(agency);
      setPlanStatus({
        planType: status.planType,
        status: status.subscriptionStatus,
        isActive: status.isTrialing || status.subscriptionStatus === 'active',
        daysRemaining: status.daysRemaining || undefined,
        shouldDowngrade: status.isExpired && status.planType === 'free',
      });
      
      // Show warning if expired
      if (status.isExpired && status.planType === 'free') {
        toast.error('Your free trial has expired. Please subscribe to continue.');
      }
    } catch (error) {
      console.error('Error loading plan status:', error);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  const currentPlanCode = plan;
  const currentPlanConfig = PLAN_CONFIG[currentPlanCode];
  const daysRemaining = planStatus?.daysRemaining;

  return (
    <div className="space-y-6 p-6">
      {/* December Special Banner */}
      {isDecemberSpecial && (
        <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                  🎉 December Special - All Features Free!
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  Enjoy all premium features at no cost until January 15, 2025. 
                  {daysUntilGating && daysUntilGating > 0 && (
                    <span className="font-medium text-primary ml-1"> {daysUntilGating} days remaining!</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-[#006BFF]" />
              Plans & Pricing
            </h1>
            <p className="text-neutral-600 mt-2">Choose the plan that's right for your agency</p>
          </div>
          {planStatus && (
            <div className="flex items-center gap-3">
              <Badge variant={currentPlanCode === 'starter' ? 'outline' : 'default'} className="text-sm">
                {currentPlanConfig.name} Plan
              </Badge>
              {currentPlanCode === 'starter' && daysRemaining !== undefined && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>{daysRemaining} days remaining</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['starter', 'professional', 'enterprise'] as PlanCode[]).map((planCode) => {
          const planConfig = PLAN_CONFIG[planCode];
          const displayConfig = planDisplayConfig[planCode];
          const Icon = displayConfig.icon;
          const features = planFeatures[planCode];
          const limitations = planLimitations[planCode];
          const isCurrentPlan = planCode === currentPlanCode;
          const isPopular = displayConfig.popular;

          return (
            <Card
              key={planCode}
              className={`relative ${
                isPopular ? 'border-2 border-[#006BFF] shadow-lg' : ''
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#006BFF] text-white text-xs font-semibold rounded-full">
                  Recommended
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isPopular ? 'bg-[#006BFF]' : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${isPopular ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}`} />
                  </div>
                  <div>
                    <CardTitle>{planConfig.name}</CardTitle>
                    <CardDescription>{planConfig.description}</CardDescription>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                    ${planConfig.price}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 ml-2">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{feature}</span>
                      </div>
                    ))}
                    {limitations.map((limitation, index) => (
                      <div key={index} className="flex items-center gap-2 opacity-50">
                        <X className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">{limitation}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      className="w-full mt-6"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : (
                    <CheckoutButton plan={planCode} className="w-full mt-6">
                      Subscribe Now
                    </CheckoutButton>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                {currentPlanConfig.name} Plan
                {currentPlanCode === 'starter' && ' (Free Trial)'}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {currentPlanCode === 'starter'
                  ? daysRemaining !== undefined 
                    ? `${daysRemaining} days remaining in your free trial`
                    : 'Free tier with limits'
                  : `$${currentPlanConfig.price}/month - Billed monthly`
                }
              </p>
              {currentPlanCode === 'starter' && daysRemaining !== undefined && daysRemaining <= 7 && (
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  Your trial expires soon. Upgrade to continue using all features.
                </p>
              )}
            </div>
            {currentPlanCode !== 'starter' && (
              <Link 
                to="/admin/settings"
                className="inline-flex items-center justify-center rounded-xl text-sm font-semibold h-11 md:h-10 px-4 py-2 min-h-[44px] md:min-h-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-900 dark:text-neutral-100 transition-all duration-300"
              >
                Manage Subscription
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

