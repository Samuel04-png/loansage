/**
 * Loan Plan Comparison Component
 * Displays 3 algorithmic loan plan options for borrowers
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle2, X, TrendingUp, Shield, Clock } from 'lucide-react';
import { generateLoanPlans, LoanPlanComparisonInput } from '../../lib/ai/loan-plan-comparison';
import toast from 'react-hot-toast';

interface LoanPlanComparisonProps {
  input: LoanPlanComparisonInput;
  onPlanSelected?: (plan: any) => void;
}

export function LoanPlanComparison({ input, onPlanSelected }: LoanPlanComparisonProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  const comparison = generateLoanPlans(input);

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan.planName);
    onPlanSelected?.(plan);
    toast.success(`Selected ${plan.planName}`);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Eligibility Check */}
      {!comparison.borrowerEligibility.eligible && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <X className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Not Eligible</p>
                <p className="text-sm text-red-800 mt-1">
                  {comparison.borrowerEligibility.reasoning}
                </p>
                <p className="text-sm font-medium text-red-900 mt-2">
                  Maximum Safe Amount: {comparison.borrowerEligibility.maxSafeAmount.toLocaleString()} ZMW
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparison.plans.map((plan, idx) => (
          <Card
            key={idx}
            className={`relative ${
              plan.planName === comparison.recommendedPlan.planName
                ? 'border-2 border-blue-500 ring-2 ring-blue-200'
                : ''
            } ${
              selectedPlan === plan.planName ? 'ring-2 ring-green-500' : ''
            }`}
          >
            {plan.planName === comparison.recommendedPlan.planName && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-blue-600">RECOMMENDED</Badge>
              </div>
            )}
            
            <CardHeader>
              <CardTitle className="text-lg">{plan.planName}</CardTitle>
              <Badge className={getRiskColor(plan.risk)}>
                {plan.risk.toUpperCase()} RISK
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Loan Details */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Loan Amount</span>
                  <span className="font-semibold">{plan.loanAmount.toLocaleString()} ZMW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Interest Rate</span>
                  <span className="font-semibold">{plan.interestRate}% p.a.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duration</span>
                  <span className="font-semibold">{plan.durationMonths} months</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Monthly Payment</span>
                  <span className="font-bold text-lg">{plan.monthlyPayment.toLocaleString()} ZMW</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold">{plan.totalAmount.toLocaleString()} ZMW</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Interest</span>
                  <span className="font-semibold text-blue-600">{plan.totalInterest.toLocaleString()} ZMW</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Profit Margin</span>
                  <span className="font-semibold text-green-600">{plan.profitMargin.toFixed(2)}%</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-600">{plan.description}</p>

              {/* Recommended For */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Best For:</p>
                <ul className="space-y-1">
                  {plan.recommendedFor.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Select Button */}
              <Button
                onClick={() => handleSelectPlan(plan)}
                className="w-full"
                variant={selectedPlan === plan.planName ? 'default' : 'outline'}
              >
                {selectedPlan === plan.planName ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Selected
                  </>
                ) : (
                  'Select This Plan'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">Cheapest</p>
              <p className="font-semibold">{comparison.comparison.cheapest.planName}</p>
              <p className="text-xs text-gray-500">
                {comparison.comparison.cheapest.totalAmount.toLocaleString()} ZMW total
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Fastest</p>
              <p className="font-semibold">{comparison.comparison.fastest.planName}</p>
              <p className="text-xs text-gray-500">
                {comparison.comparison.fastest.durationMonths} months
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Safest</p>
              <p className="font-semibold">{comparison.comparison.safest.planName}</p>
              <p className="text-xs text-gray-500">
                {comparison.comparison.safest.risk} risk
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

