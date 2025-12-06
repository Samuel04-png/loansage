/**
 * Profit Projection Card Component
 * Displays 3-scenario profit projection with heatmap visualization
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { calculateProfitProjection, ProfitProjectionInput, generateProfitHeatmap } from '../../lib/ai/profit-projection';

interface ProfitProjectionCardProps {
  input: ProfitProjectionInput;
}

export function ProfitProjectionCard({ input }: ProfitProjectionCardProps) {
  const projection = calculateProfitProjection(input);
  const heatmap = generateProfitHeatmap(projection);

  const scenarios = projection.scenarios;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Profit Projection Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Normal Repayment Scenario */}
          <div className={`p-4 rounded-lg border-2 ${
            scenarios[0].color === 'green' ? 'bg-green-50 border-green-300' :
            scenarios[0].color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Normal Repayment</h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">Total Profit</p>
                <p className="text-2xl font-bold text-green-700">
                  {scenarios[0].totalProfit.toLocaleString()} ZMW
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Profit Margin</p>
                <p className="text-lg font-semibold text-green-600">
                  {scenarios[0].profitMargin.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Revenue per Day</p>
                <p className="text-sm font-medium text-gray-700">
                  {scenarios[0].revenuePerDay.toLocaleString()} ZMW
                </p>
              </div>
            </div>
            <Badge className={`mt-3 ${
              scenarios[0].riskLevel === 'low' ? 'bg-green-600' :
              scenarios[0].riskLevel === 'medium' ? 'bg-yellow-600' :
              'bg-red-600'
            }`}>
              {scenarios[0].riskLevel.toUpperCase()} RISK
            </Badge>
          </div>

          {/* Late Repayment Scenario */}
          <div className={`p-4 rounded-lg border-2 ${
            scenarios[1].color === 'green' ? 'bg-green-50 border-green-300' :
            scenarios[1].color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Late Repayment</h3>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">Total Profit</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {scenarios[1].totalProfit.toLocaleString()} ZMW
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Additional Revenue</p>
                <p className="text-lg font-semibold text-yellow-600">
                  +{((scenarios[1].details.lateFees || 0) + (scenarios[1].details.penalties || 0)).toLocaleString()} ZMW
                </p>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Late Fees: {(scenarios[1].details.lateFees || 0).toLocaleString()} ZMW</p>
                <p>• Penalties: {(scenarios[1].details.penalties || 0).toLocaleString()} ZMW</p>
              </div>
            </div>
            <Badge className={`mt-3 ${
              scenarios[1].riskLevel === 'low' ? 'bg-green-600' :
              scenarios[1].riskLevel === 'medium' ? 'bg-yellow-600' :
              'bg-red-600'
            }`}>
              {scenarios[1].riskLevel.toUpperCase()} RISK
            </Badge>
          </div>

          {/* Default Scenario */}
          <div className={`p-4 rounded-lg border-2 ${
            scenarios[2].color === 'green' ? 'bg-green-50 border-green-300' :
            scenarios[2].color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
            'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Default Scenario</h3>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">Estimated Loss</p>
                <p className="text-2xl font-bold text-red-700">
                  {Math.abs(scenarios[2].totalProfit).toLocaleString()} ZMW
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Collateral Recovery</p>
                <p className="text-lg font-semibold text-red-600">
                  {(scenarios[2].details.collateralRecovery || 0).toLocaleString()} ZMW
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Loss</p>
                <p className="text-sm font-medium text-red-700">
                  {(scenarios[2].details.totalLoss || 0).toLocaleString()} ZMW
                </p>
              </div>
            </div>
            <Badge className="mt-3 bg-red-600">
              {scenarios[2].riskLevel.toUpperCase()} RISK
            </Badge>
          </div>
        </div>

        {/* Heatmap Visualization */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-3">Profit Heatmap</h4>
          <div className="flex items-center justify-between gap-2">
            {heatmap.data.map((item, idx) => (
              <div key={idx} className="flex-1">
                <div className="text-center mb-2">
                  <p className="text-xs font-medium text-gray-700">{item.scenario}</p>
                  <p className={`text-lg font-bold ${
                    item.color === 'green' ? 'text-green-600' :
                    item.color === 'yellow' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {item.profit > 0 ? '+' : ''}{item.profit.toLocaleString()} ZMW
                  </p>
                </div>
                <div
                  className={`h-8 rounded ${
                    item.color === 'green' ? 'bg-green-400' :
                    item.color === 'yellow' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`}
                  style={{
                    opacity: item.profit > 0 
                      ? Math.min(1, (item.profit - heatmap.min) / (heatmap.max - heatmap.min || 1))
                      : 0.5
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

