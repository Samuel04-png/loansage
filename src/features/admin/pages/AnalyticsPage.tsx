/**
 * Advanced Analytics & Forecasting Page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, FileText, Users } from 'lucide-react';
import { generateRevenueForecast, calculatePortfolioHealth } from '../../../lib/analytics/forecasting';
import type { ForecastData, PortfolioHealth } from '../../../types/features';
import { useTheme } from '../../../components/providers/ThemeProvider';

export function AnalyticsPage() {
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const [forecastMonths, setForecastMonths] = useState(12);

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['revenue-forecast', profile?.agency_id, forecastMonths],
    queryFn: async () => {
      if (!profile?.agency_id) return null;
      return generateRevenueForecast(profile.agency_id, forecastMonths);
    },
    enabled: !!profile?.agency_id,
  });

  const { data: portfolioHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['portfolio-health', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null;
      return calculatePortfolioHealth(profile.agency_id);
    },
    enabled: !!profile?.agency_id,
  });

  if (forecastLoading || healthLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Advanced Analytics</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">Revenue forecasting, portfolio health, and trend analysis</p>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          <Button
            variant={forecastMonths === 6 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setForecastMonths(6)}
          >
            6 Months
          </Button>
          <Button
            variant={forecastMonths === 12 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setForecastMonths(12)}
          >
            12 Months
          </Button>
          <Button
            variant={forecastMonths === 24 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setForecastMonths(24)}
          >
            24 Months
          </Button>
        </div>
      </div>

      {portfolioHealth && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Health</CardTitle>
            <CardDescription>Overall portfolio performance and metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">{portfolioHealth.overallScore}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Overall Health Score</p>
              </div>
              <Badge
                variant={portfolioHealth.overallScore >= 70 ? 'default' : portfolioHealth.overallScore >= 50 ? 'secondary' : 'destructive'}
                className="text-lg px-4 py-2"
              >
                {portfolioHealth.overallScore >= 70 ? 'Healthy' : portfolioHealth.overallScore >= 50 ? 'Moderate' : 'At Risk'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Default Rate</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{(portfolioHealth.metrics.defaultRate * 100).toFixed(1)}%</p>
                <Badge variant="outline" className="mt-1">
                  {portfolioHealth.trends.defaultRate === 'improving' && <TrendingUp className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.defaultRate === 'declining' && <TrendingDown className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.defaultRate}
                </Badge>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Collection Rate</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{(portfolioHealth.metrics.collectionRate * 100).toFixed(1)}%</p>
                <Badge variant="outline" className="mt-1">
                  {portfolioHealth.trends.collectionRate === 'improving' && <TrendingUp className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.collectionRate === 'declining' && <TrendingDown className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.collectionRate}
                </Badge>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Avg Days to Repay</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{portfolioHealth.metrics.averageDaysToRepay}</p>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Portfolio at Risk</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{(portfolioHealth.metrics.portfolioAtRisk * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Profitability</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{(portfolioHealth.metrics.profitability * 100).toFixed(1)}%</p>
                <Badge variant="outline" className="mt-1">
                  {portfolioHealth.trends.profitability === 'improving' && <TrendingUp className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.profitability === 'declining' && <TrendingDown className="w-3 h-3 mr-1" />}
                  {portfolioHealth.trends.profitability}
                </Badge>
              </div>
            </div>

            {portfolioHealth.alerts.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="font-medium text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alerts
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
                  {portfolioHealth.alerts.map((alert, index) => (
                    <li key={index}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {forecast && forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Forecast</CardTitle>
            <CardDescription>Predicted revenue and loan performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={forecast}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={resolvedTheme === 'dark' ? '#374151' : '#E5E7EB'} 
                />
                <XAxis 
                  dataKey="period" 
                  stroke={resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                />
                <YAxis 
                  stroke={resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: resolvedTheme === 'dark' ? '#111827' : 'white',
                    border: resolvedTheme === 'dark' ? '1px solid #374151' : '1px solid #E5E7EB',
                    color: resolvedTheme === 'dark' ? '#F9FAFB' : '#111827',
                    borderRadius: '12px',
                  }}
                />
                <Legend 
                  wrapperStyle={{ 
                    color: resolvedTheme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <Line type="monotone" dataKey="predictedRevenue" stroke="#006BFF" name="Predicted Revenue" />
                <Line type="monotone" dataKey="predictedLoans" stroke="#10b981" name="Predicted Loans" />
                <Line type="monotone" dataKey="predictedDefaults" stroke="#ef4444" name="Predicted Defaults" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

