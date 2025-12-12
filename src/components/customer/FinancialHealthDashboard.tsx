/**
 * Customer Financial Health Dashboard
 * Shows customer's financial wellness score and insights
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, DollarSign, CreditCard, Calendar, Target } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

interface FinancialHealthDashboardProps {
  customerId: string;
  agencyId: string;
  customer: any;
  loans: any[];
}

export function FinancialHealthDashboard({
  customerId,
  agencyId,
  customer,
  loans,
}: FinancialHealthDashboardProps) {
  // Calculate financial health metrics
  const { data: healthData, isLoading } = useQuery({
    queryKey: ['customer-financial-health', agencyId, customerId],
    queryFn: async () => {
      return calculateFinancialHealth(customer, loans, agencyId);
    },
    enabled: !!customerId && !!agencyId && !!customer && loans.length > 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return null;
  }

  const { score, rating, metrics, insights, recommendations } = healthData;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRatingBadge = (rating: string) => {
    const colors = {
      excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      good: 'bg-blue-100 text-blue-700 border-blue-200',
      fair: 'bg-amber-100 text-amber-700 border-amber-200',
      poor: 'bg-orange-100 text-orange-700 border-orange-200',
      critical: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[rating as keyof typeof colors] || colors.fair;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-[#006BFF]" />
            Financial Health Dashboard
          </CardTitle>
          <Badge className={cn('border', getRatingBadge(rating))}>
            {rating.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-600">Financial Health Score</span>
            <span className={cn('text-2xl font-bold', getScoreColor(score))}>
              {score}/100
            </span>
          </div>
          <Progress value={score} className="h-3" />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-neutral-500" />
              <span className="text-xs text-neutral-600">Total Debt</span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              {formatCurrency(metrics.totalDebt, 'ZMW')}
            </p>
            {metrics.debtTrend > 0 ? (
              <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                <TrendingUp className="h-3 w-3" />
                <span>+{metrics.debtTrend.toFixed(1)}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <TrendingDown className="h-3 w-3" />
                <span>{metrics.debtTrend.toFixed(1)}%</span>
              </div>
            )}
          </div>

          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-neutral-500" />
              <span className="text-xs text-neutral-600">Payment Rate</span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              {metrics.paymentRate.toFixed(1)}%
            </p>
            <div className="mt-1">
              <Progress value={metrics.paymentRate} className="h-2" />
            </div>
          </div>

          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-neutral-500" />
              <span className="text-xs text-neutral-600">On-Time Rate</span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              {metrics.onTimeRate.toFixed(1)}%
            </p>
            <div className="mt-1">
              <Progress value={metrics.onTimeRate} className="h-2" />
            </div>
          </div>

          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-neutral-500" />
              <span className="text-xs text-neutral-600">Completion Rate</span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              {metrics.completionRate.toFixed(1)}%
            </p>
            <div className="mt-1">
              <Progress value={metrics.completionRate} className="h-2" />
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 mb-3">Key Insights</h4>
            <div className="space-y-2">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2 p-3 rounded-lg',
                    insight.type === 'positive'
                      ? 'bg-emerald-50 border border-emerald-200'
                      : insight.type === 'warning'
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-red-50 border border-red-200'
                  )}
                >
                  {insight.type === 'positive' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-sm text-neutral-700">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 mb-3">Recommendations</h4>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-neutral-600">
                  <span className="text-[#006BFF] mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Calculate financial health metrics
 */
async function calculateFinancialHealth(
  customer: any,
  loans: any[],
  agencyId: string
): Promise<{
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  metrics: {
    totalDebt: number;
    debtTrend: number;
    paymentRate: number;
    onTimeRate: number;
    completionRate: number;
  };
  insights: Array<{ type: 'positive' | 'warning' | 'critical'; message: string }>;
  recommendations: string[];
}> {
  // Calculate total debt
  const activeLoans = loans.filter((l: any) => l.status === 'active' || l.status === 'pending');
  const totalDebt = activeLoans.reduce((sum: number, loan: any) => sum + Number(loan.amount || 0), 0);
  
  // Calculate payment metrics
  let totalRepayments = 0;
  let paidRepayments = 0;
  let onTimeRepayments = 0;
  let completedLoans = 0;
  
  for (const loan of loans) {
    if (loan.status === 'completed' || loan.status === 'paid') {
      completedLoans++;
    }
    
    try {
      const repaymentsRef = collection(db, 'agencies', agencyId, 'loans', loan.id, 'repayments');
      const repaymentsSnapshot = await getDocs(repaymentsRef);
      const repayments = repaymentsSnapshot.docs.map(doc => doc.data());
      
      for (const repayment of repayments) {
        totalRepayments++;
        if (repayment.status === 'paid') {
          paidRepayments++;
          const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
          const paidDate = repayment.paidAt?.toDate?.() || new Date(repayment.paidAt);
          if (paidDate <= dueDate) {
            onTimeRepayments++;
          }
        }
      }
    } catch (error) {
      // Skip if error
    }
  }
  
  const paymentRate = totalRepayments > 0 ? (paidRepayments / totalRepayments) * 100 : 100;
  const onTimeRate = paidRepayments > 0 ? (onTimeRepayments / paidRepayments) * 100 : 100;
  const completionRate = loans.length > 0 ? (completedLoans / loans.length) * 100 : 100;
  
  // Calculate debt trend (simplified - compare with previous period)
  const debtTrend = 0; // Would need historical data
  
  // Calculate health score
  let score = 100;
  score -= (100 - paymentRate) * 0.3; // Payment rate weight: 30%
  score -= (100 - onTimeRate) * 0.25; // On-time rate weight: 25%
  score -= (100 - completionRate) * 0.25; // Completion rate weight: 25%
  
  // Adjust for debt level (if debt is too high relative to income)
  const monthlyIncome = Number(customer.monthlyIncome || 0);
  if (monthlyIncome > 0) {
    const debtToIncome = totalDebt / (monthlyIncome * 12); // Annual income
    if (debtToIncome > 0.5) {
      score -= 20; // High debt-to-income ratio
    }
  }
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine rating
  let rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  if (score >= 80) rating = 'excellent';
  else if (score >= 60) rating = 'good';
  else if (score >= 40) rating = 'fair';
  else if (score >= 20) rating = 'poor';
  else rating = 'critical';
  
  // Generate insights
  const insights: Array<{ type: 'positive' | 'warning' | 'critical'; message: string }> = [];
  
  if (paymentRate >= 90) {
    insights.push({
      type: 'positive',
      message: 'Excellent payment history. Customer consistently pays on time.',
    });
  } else if (paymentRate < 70) {
    insights.push({
      type: 'warning',
      message: `Payment rate is ${paymentRate.toFixed(1)}%. Below recommended threshold.`,
    });
  }
  
  if (onTimeRate >= 85) {
    insights.push({
      type: 'positive',
      message: 'High on-time payment rate indicates reliable customer.',
    });
  } else if (onTimeRate < 60) {
    insights.push({
      type: 'critical',
      message: 'Low on-time payment rate. Customer frequently pays late.',
    });
  }
  
  if (completionRate >= 80) {
    insights.push({
      type: 'positive',
      message: 'High loan completion rate shows strong repayment capability.',
    });
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (paymentRate < 80) {
    recommendations.push('Consider payment reminders or restructuring options');
  }
  
  if (onTimeRate < 70) {
    recommendations.push('Implement stricter payment terms or incentives for early payment');
  }
  
  if (totalDebt > 0 && monthlyIncome > 0 && totalDebt / (monthlyIncome * 12) > 0.4) {
    recommendations.push('Customer may be over-leveraged. Consider limiting new loans');
  }
  
  if (score < 50) {
    recommendations.push('Review customer relationship and consider collection strategies');
  }
  
  return {
    score,
    rating,
    metrics: {
      totalDebt,
      debtTrend,
      paymentRate,
      onTimeRate,
      completionRate,
    },
    insights,
    recommendations,
  };
}

