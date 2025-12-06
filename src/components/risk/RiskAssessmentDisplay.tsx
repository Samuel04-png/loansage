/**
 * Risk Assessment Display Component
 * Shows comprehensive risk analysis for loans
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, CheckCircle2, AlertCircle, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { assessLoanRisk, type RiskAssessmentOutput } from '../../lib/ai/risk-assessment-engine';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface RiskAssessmentDisplayProps {
  riskData: RiskAssessmentOutput;
  showDetails?: boolean;
}

export function RiskAssessmentDisplay({ riskData, showDetails = true }: RiskAssessmentDisplayProps) {
  const getRiskColor = (category: string) => {
    switch (category) {
      case 'Low':
        return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20';
      case 'Medium':
        return 'bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20';
      case 'High':
        return 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20';
      case 'Critical':
        return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category) {
      case 'Low':
        return CheckCircle2;
      case 'Medium':
        return AlertCircle;
      case 'High':
        return AlertTriangle;
      case 'Critical':
        return Shield;
      default:
        return AlertCircle;
    }
  };

  const RiskIcon = getRiskIcon(riskData.riskCategory);

  return (
    <Card className="rounded-2xl border border-neutral-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#006BFF]" />
            Risk Assessment
          </CardTitle>
          <Badge className={cn('font-semibold', getRiskColor(riskData.riskCategory))}>
            <RiskIcon className="w-3 h-3 mr-1" />
            {riskData.riskCategory} Risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Score */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Risk Score
            </p>
            <p className={cn(
              'text-2xl font-bold',
              riskData.riskScore <= 25 ? 'text-[#22C55E]' :
              riskData.riskScore <= 50 ? 'text-[#FACC15]' :
              riskData.riskScore <= 75 ? 'text-[#F97316]' :
              'text-[#EF4444]'
            )}>
              {riskData.riskScore}/100
            </p>
          </div>

          <div className="p-4 bg-[#EF4444]/5 rounded-xl border border-[#EF4444]/10">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Default Probability
            </p>
            <p className="text-2xl font-bold text-[#EF4444]">
              {riskData.defaultProbability.toFixed(1)}%
            </p>
          </div>

          <div className="p-4 bg-[#006BFF]/5 rounded-xl border border-[#006BFF]/10">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Suggested Max Loan
            </p>
            <p className="text-2xl font-bold text-[#006BFF]">
              {riskData.suggestedMaxLoan.toLocaleString()} ZMW
            </p>
          </div>

          <div className="p-4 bg-[#22C55E]/5 rounded-xl border border-[#22C55E]/10">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Collateral Sufficiency
            </p>
            <p className="text-2xl font-bold text-[#22C55E]">
              {riskData.collateralSufficiency.toFixed(1)}%
            </p>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Risk Breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">Risk Breakdown</h4>
              <div className="space-y-3">
                {Object.entries(riskData.breakdown).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="font-semibold text-neutral-900">{value}/100</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          value <= 10 ? 'bg-[#22C55E]' :
                          value <= 20 ? 'bg-[#FACC15]' :
                          value <= 30 ? 'bg-[#F97316]' :
                          'bg-[#EF4444]'
                        )}
                        style={{ width: `${Math.min(100, value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Factors */}
            <div className="grid md:grid-cols-2 gap-4">
              {riskData.factors.positive.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                    Positive Factors
                  </h4>
                  <ul className="space-y-1">
                    {riskData.factors.positive.map((factor, index) => (
                      <li key={index} className="text-xs text-neutral-600 flex items-start gap-2">
                        <span className="text-[#22C55E] mt-1">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {riskData.factors.negative.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                    Risk Factors
                  </h4>
                  <ul className="space-y-1">
                    {riskData.factors.negative.map((factor, index) => (
                      <li key={index} className="text-xs text-neutral-600 flex items-start gap-2">
                        <span className="text-[#EF4444] mt-1">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {riskData.factors.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#006BFF]" />
                  Recommendations
                </h4>
                <ul className="space-y-1">
                  {riskData.factors.recommendations.map((rec, index) => (
                    <li key={index} className="text-xs text-neutral-600 flex items-start gap-2">
                      <span className="text-[#006BFF] mt-1">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

