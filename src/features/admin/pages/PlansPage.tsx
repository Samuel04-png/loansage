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

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: 'month',
    description: 'Perfect for small agencies',
    icon: Building2,
    features: [
      'Unlimited loans',
      'Basic reporting',
      'Email support',
      'Unlimited team members',
      'Core loan management',
      'Customer management',
      'Mobile app access',
      'Offline mode',
    ],
    limitations: [],
    current: false,
  },
  {
    name: 'Professional',
    price: '$35',
    period: 'month',
    description: 'For growing agencies',
    icon: Zap,
    features: [
      'Unlimited loans',
      'Advanced analytics & insights',
      'Real-time collaboration',
      'Priority support',
      'Unlimited team members',
      'API access',
      'Custom integrations',
      'Advanced reporting',
      'Full offline sync',
      'Automated workflows',
      'Bulk operations',
      'Advanced search & filters',
      'Export capabilities (CSV, PDF, Excel)',
    ],
    limitations: [],
    current: true,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    icon: Crown,
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom development',
      'SLA guarantee (99.9% uptime)',
      'On-premise deployment option',
      'Training & onboarding',
      'Advanced security features',
      'Custom workflows',
      'Advanced audit logs',
      'White-label customization',
    ],
    limitations: [],
    current: false,
  },
];

export function PlansPage() {
  const { agency } = useAgency();
  const { isDecemberSpecial, daysUntilGating } = useFeatureGate();
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

  const currentPlan = planStatus?.planType || 'free';
  const isFreePlan = currentPlan === 'free';
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
              <Badge variant={isFreePlan ? 'outline' : 'default'} className="text-sm">
                {isFreePlan ? 'Free Plan' : 'Professional Plan'}
              </Badge>
              {isFreePlan && daysRemaining !== undefined && (
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
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular ? 'border-2 border-[#006BFF] shadow-lg' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#006BFF] text-white text-xs font-semibold rounded-full">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    plan.popular ? 'bg-[#006BFF]' : 'bg-neutral-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${plan.popular ? 'text-white' : 'text-neutral-600'}`} />
                  </div>
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-neutral-900">{plan.price}</span>
                  {plan.period && (
                    <span className="text-neutral-500 ml-2">/{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-neutral-700">{feature}</span>
                      </div>
                    ))}
                    {plan.limitations.map((limitation, index) => (
                      <div key={index} className="flex items-center gap-2 opacity-50">
                        <X className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <span className="text-sm text-neutral-500">{limitation}</span>
                      </div>
                    ))}
                  </div>
                  {((plan.name === 'Starter' && isFreePlan) || (plan.name === 'Professional' && !isFreePlan)) ? (
                    <Button
                      variant="outline"
                      className="w-full mt-6"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : plan.price === 'Custom' ? (
                    <Button
                      variant="outline"
                      className="w-full mt-6"
                      asChild
                    >
                      <a href="mailto:sales@tengaloans.com">Contact Sales</a>
                    </Button>
                  ) : (
                    <CheckoutButton className="w-full mt-6">
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
              <p className="font-semibold text-neutral-900">
                {isFreePlan ? 'Free Plan (Trial)' : 'Professional Plan'}
              </p>
              <p className="text-sm text-neutral-500">
                {isFreePlan 
                  ? daysRemaining !== undefined 
                    ? `${daysRemaining} days remaining in your free trial`
                    : '30-day free trial'
                  : '$35/month - Billed monthly'
                }
              </p>
              {isFreePlan && daysRemaining !== undefined && daysRemaining <= 7 && (
                <p className="text-sm text-amber-600 mt-1">
                  Your trial expires soon. Upgrade to continue using all features.
                </p>
              )}
            </div>
            {!isFreePlan && (
              <Button variant="outline" asChild>
                <Link to="/admin/settings">Manage Subscription</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

