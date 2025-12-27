import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { calculateCustomerRiskScore, getLoanApprovalRecommendation, predictDefaultProbability } from '../../lib/ai/risk-scoring';
import { detectLoanAnomalies } from '../../lib/ai/predictive-analytics';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AIRiskAnalysisProps {
  loanData: {
    amount: number;
    interestRate: number;
    durationMonths: number;
    loanType: string;
  };
  customerData?: {
    monthlyIncome?: number;
    employmentStatus?: string;
    kycStatus?: string;
    totalLoans?: number;
    completedLoans?: number;
    defaultedLoans?: number;
    averageLoanAmount?: number;
    averageRepaymentTime?: number;
  };
  collateralData?: {
    value: number;
    type: string;
    verificationStatus?: string;
  };
}

export function AIRiskAnalysis({ loanData, customerData, collateralData }: AIRiskAnalysisProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    const performAnalysis = async () => {
      setLoading(true);
      
      // Prepare risk factors
      const riskFactors = {
        loanDetails: loanData,
        customerProfile: customerData ? {
          monthlyIncome: customerData.monthlyIncome,
          employmentStatus: customerData.employmentStatus,
          kycStatus: customerData.kycStatus,
        } : undefined,
        customerHistory: customerData ? {
          totalLoans: customerData.totalLoans || 0,
          completedLoans: customerData.completedLoans || 0,
          defaultedLoans: customerData.defaultedLoans || 0,
          averageLoanAmount: customerData.averageLoanAmount || 0,
          averageRepaymentTime: customerData.averageRepaymentTime || 0,
        } : undefined,
        collateral: collateralData,
      };

      // Calculate risk score (now async with DeepSeek)
      const riskScore = await calculateCustomerRiskScore(riskFactors, profile?.agency_id);
      
      // Get approval recommendation (now async)
      const recommendation = await getLoanApprovalRecommendation(riskFactors);
      
      // Predict default probability (now async)
      const defaultPrediction = await predictDefaultProbability(riskFactors);
      
      // Detect anomalies
      const anomalies = detectLoanAnomalies({
        ...loanData,
        customerHistory: customerData ? {
          averageLoanAmount: customerData.averageLoanAmount || 0,
          averageDuration: 24, // Default
        } : undefined,
      });

      setAnalysis({
        riskScore,
        recommendation,
        defaultPrediction,
        anomalies,
      });
      
      setLoading(false);
    };

    performAnalysis();
  }, [loanData, customerData, collateralData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            <span className="ml-2 text-slate-600">Analyzing risk...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const { riskScore, recommendation, defaultPrediction, anomalies } = analysis;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-emerald-600 bg-emerald-50';
      case 'medium':
        return 'text-amber-600 bg-amber-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'approve':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'approve_with_conditions':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'review':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'reject':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <Card className="border-2 border-primary-100">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-blue-50">
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary-600" />
          AI Risk Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {/* Risk Score */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-50">
            <p className="text-sm text-slate-600 mb-1">Risk Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{riskScore.score}/100</span>
              <Badge className={getRiskColor(riskScore.level)}>
                {riskScore.level.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Confidence: {Math.round(riskScore.confidence * 100)}%
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50">
            <p className="text-sm text-slate-600 mb-1">Default Probability</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {Math.round(defaultPrediction.probability * 100)}%
              </span>
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Estimated timeframe: {defaultPrediction.timeframe} months
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div className={`p-4 rounded-lg border-2 ${getRecommendationColor(recommendation.recommendation)}`}>
          <div className="flex items-start gap-2 mb-2">
            {recommendation.recommendation === 'approve' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            )}
            {recommendation.recommendation === 'approve_with_conditions' && (
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            )}
            {recommendation.recommendation === 'review' && (
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            )}
            {recommendation.recommendation === 'reject' && (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold mb-1">
                Recommendation: {recommendation.recommendation.replace('_', ' ').toUpperCase()}
              </p>
              <p className="text-sm">{recommendation.reasoning}</p>
            </div>
          </div>

          {recommendation.conditions && recommendation.conditions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <p className="text-sm font-medium mb-2">Conditions:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {recommendation.conditions.map((condition: string, index: number) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Risk Factors */}
        <div className="grid grid-cols-2 gap-4">
          {riskScore.factors.positive.length > 0 && (
            <div>
              <p className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Positive Factors
              </p>
              <ul className="space-y-1">
                {riskScore.factors.positive.map((factor: string, index: number) => (
                  <li key={index} className="text-xs text-emerald-600 flex items-start gap-1">
                    <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {riskScore.factors.negative.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                Risk Factors
              </p>
              <ul className="space-y-1">
                {riskScore.factors.negative.map((factor: string, index: number) => (
                  <li key={index} className="text-xs text-red-600 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Anomalies */}
        {anomalies.hasAnomalies && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Anomalies Detected ({anomalies.riskLevel} risk)
            </p>
            <ul className="space-y-1">
              {anomalies.anomalies.map((anomaly: string, index: number) => (
                <li key={index} className="text-xs text-amber-700">
                  • {anomaly}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

