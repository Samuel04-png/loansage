/**
 * Comprehensive Risk Assessment Card Component
 * Displays full risk analysis with all enhanced features
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Loader2, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
import { calculateCustomerRiskScore, RiskFactors } from '../../lib/ai/risk-scoring';
import toast from 'react-hot-toast';

interface RiskAssessmentCardProps {
  riskFactors: RiskFactors;
  onScoreCalculated?: (score: any) => void;
}

export function RiskAssessmentCard({ riskFactors, onScoreCalculated }: RiskAssessmentCardProps) {
  const [loading, setLoading] = useState(false);
  const [riskScore, setRiskScore] = useState<any>(null);

  const calculateRisk = async () => {
    setLoading(true);
    try {
      const score = await calculateCustomerRiskScore(riskFactors);
      setRiskScore(score);
      onScoreCalculated?.(score);
    } catch (error: any) {
      toast.error('Failed to calculate risk score: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 50) return 'text-yellow-600';
    if (score < 70) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!riskScore && (
          <Button onClick={calculateRisk} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating Risk...
              </>
            ) : (
              'Calculate Risk Score'
            )}
          </Button>
        )}

        {riskScore && (
          <div className="space-y-6">
            {/* Risk Score Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(riskScore.score)}`}>
                  {riskScore.score}
                  <span className="text-lg text-gray-500">/100</span>
                </p>
              </div>
              <Badge className={getRiskColor(riskScore.level)}>
                {riskScore.level.toUpperCase()}
              </Badge>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Repayment Probability</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {((riskScore.repaymentProbability || 0.7) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-600">Default Probability</p>
                <p className="text-2xl font-semibold text-red-600">
                  {((riskScore.defaultProbability || 0.3) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Suggested Loan Amount */}
            {riskScore.suggestedLoanAmount && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="font-semibold text-green-900">Suggested Loan Amount</p>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {riskScore.suggestedLoanAmount.toLocaleString()} ZMW
                </p>
              </div>
            )}

            {/* Risk Explanation */}
            {riskScore.riskExplanation && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 mb-1">Risk Analysis</p>
                    <p className="text-sm text-yellow-800">{riskScore.riskExplanation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <p className="font-semibold text-blue-900">Recommendation</p>
              </div>
              <Badge className="bg-blue-600 text-white">
                {riskScore.recommendation.toUpperCase()}
              </Badge>
              <p className="text-sm text-blue-800 mt-2">Confidence: {(riskScore.confidence * 100).toFixed(0)}%</p>
            </div>

            {/* Positive Factors */}
            {riskScore.factors.positive.length > 0 && (
              <div>
                <p className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Positive Factors
                </p>
                <ul className="space-y-1">
                  {riskScore.factors.positive.map((factor, idx) => (
                    <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Negative Factors */}
            {riskScore.factors.negative.length > 0 && (
              <div>
                <p className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Flags
                </p>
                <ul className="space-y-1">
                  {riskScore.factors.negative.map((factor, idx) => (
                    <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" onClick={calculateRisk} className="w-full">
              Recalculate Risk
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

