/**
 * Credit Scoring & Risk Assessment Page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { calculateCreditScore, performRiskAssessment } from '../../../lib/credit-scoring/credit-scorer';
import type { CreditScore, RiskAssessment } from '../../../types/features';

export function CreditScoringPage() {
  const { profile } = useAuth();
  const { customerId, loanId } = useParams<{ customerId?: string; loanId?: string }>();
  const [loanAmount, setLoanAmount] = useState<number | undefined>();
  const [loanDuration, setLoanDuration] = useState<number | undefined>();

  const { data: creditScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['credit-score', profile?.agency_id, customerId, loanAmount],
    queryFn: async () => {
      if (!profile?.agency_id || !customerId) return null;
      return calculateCreditScore(profile.agency_id, customerId, loanAmount);
    },
    enabled: !!profile?.agency_id && !!customerId,
  });

  const { data: riskAssessment, isLoading: riskLoading } = useQuery({
    queryKey: ['risk-assessment', profile?.agency_id, customerId, loanAmount, loanDuration],
    queryFn: async () => {
      if (!profile?.agency_id || !customerId || !loanAmount || !loanDuration) return null;
      return performRiskAssessment(profile.agency_id, customerId, loanAmount, loanDuration);
    },
    enabled: !!profile?.agency_id && !!customerId && !!loanAmount && !!loanDuration,
  });

  if (scoreLoading || riskLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Credit Scoring & Risk Assessment</h1>
        <p className="text-neutral-600 mt-1">Analyze customer creditworthiness and loan risk</p>
      </div>

      {creditScore && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Score</CardTitle>
            <CardDescription>
              Calculated on {creditScore.calculatedAt.toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{creditScore.score}</p>
                <p className="text-sm text-neutral-500">Out of 1000</p>
              </div>
              <Badge
                variant={
                  creditScore.tier === 'A'
                    ? 'default'
                    : creditScore.tier === 'B'
                    ? 'default'
                    : creditScore.tier === 'C'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-lg px-4 py-2"
              >
                Tier {creditScore.tier}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-500 mb-1">Payment History</p>
                <p className="text-2xl font-bold">{creditScore.factors.paymentHistory}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-500 mb-1">Credit History</p>
                <p className="text-2xl font-bold">{creditScore.factors.creditHistory}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-500 mb-1">Debt-to-Income</p>
                <p className="text-2xl font-bold">{creditScore.factors.debtToIncome}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-500 mb-1">Collateral Value</p>
                <p className="text-2xl font-bold">{creditScore.factors.collateralValue}</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-medium text-blue-900 mb-2">Recommendations</p>
              <div className="space-y-2">
                <p className="text-sm text-blue-800">
                  Max Loan Amount: {creditScore.recommendations.maxLoanAmount.toLocaleString()}
                </p>
                <p className="text-sm text-blue-800">
                  Recommended Interest Rate: {creditScore.recommendations.recommendedInterestRate}%
                </p>
                <Badge variant="outline">
                  Risk Level: {creditScore.recommendations.riskLevel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {riskAssessment && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {(riskAssessment.defaultProbability * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-neutral-500">Default Probability</p>
              </div>
              <Badge
                variant={
                  riskAssessment.recommendation === 'approve'
                    ? 'default'
                    : riskAssessment.recommendation === 'approve_with_conditions'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-lg px-4 py-2"
              >
                {riskAssessment.recommendation === 'approve' && <CheckCircle2 className="w-4 h-4 mr-2" />}
                {riskAssessment.recommendation === 'reject' && <XCircle className="w-4 h-4 mr-2" />}
                {riskAssessment.recommendation.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            {riskAssessment.riskFactors.length > 0 && (
              <div>
                <p className="font-medium text-red-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Factors
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  {riskAssessment.riskFactors.map((factor, index) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {riskAssessment.positiveFactors.length > 0 && (
              <div>
                <p className="font-medium text-green-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Positive Factors
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                  {riskAssessment.positiveFactors.map((factor, index) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {riskAssessment.conditions && riskAssessment.conditions.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-medium text-yellow-900 mb-2">Conditions for Approval</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                  {riskAssessment.conditions.map((condition, index) => (
                    <li key={index}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!customerId && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-500">Select a customer to view credit score and risk assessment</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

