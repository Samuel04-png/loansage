/**
 * AI Insights Panel Component
 * Displays AI-generated insights, warnings, and suggestions
 */

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Lightbulb, CheckCircle2, XCircle, ArrowRight, Loader2, X } from 'lucide-react';
import { AIInsight } from '../../lib/ai/intelligence-engine';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface AIInsightsPanelProps {
  insights: AIInsight[];
  isLoading?: boolean;
  maxItems?: number;
  onActionClick?: (action: AIInsight['action']) => void;
  storageKey?: string; // Key for localStorage to track dismissed state
}

const severityColors = {
  critical: 'bg-red-50 border-red-200 text-red-900',
  high: 'bg-orange-50 border-orange-200 text-orange-900',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  low: 'bg-blue-50 border-blue-200 text-blue-900',
};

const typeIcons = {
  risk: AlertTriangle,
  warning: AlertTriangle,
  reminder: Info,
  insight: Lightbulb,
  suggestion: CheckCircle2,
};

export function AIInsightsPanel({ insights, isLoading, maxItems = 10, onActionClick, storageKey = 'ai-insights-dismissed' }: AIInsightsPanelProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, [storageKey]);
  
  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };
  
  const displayedInsights = insights.slice(0, maxItems);
  
  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  const handleAction = (action: AIInsight['action']) => {
    if (!action) return;

    if (onActionClick) {
      onActionClick(action);
      return;
    }

    // Default navigation behavior
    switch (action.type) {
      case 'review_loan':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}`);
        }
        break;
      case 'contact_customer':
        if (action.data?.customerId) {
          navigate(`/admin/customers/${action.data.customerId}`);
        }
        break;
      case 'add_payment':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}?tab=repayments`);
        }
        break;
      case 'update_status':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}?tab=overview`);
        }
        break;
      case 'verify_documents':
        if (action.data?.loanId) {
          navigate(`/admin/loans/${action.data.loanId}?tab=documents`);
        }
        break;
      case 'evaluate_collateral':
        if (action.data?.collateralId) {
          navigate(`/admin/collateral/${action.data.collateralId}`);
        }
        break;
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-neutral-200/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Analyzing system data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayedInsights.length === 0) {
    return (
      <Card className="rounded-2xl border border-neutral-200/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 text-neutral-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm">No AI insights at this time. All systems operating normally.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-neutral-200/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="w-5 h-5 text-[#006BFF]" />
            AI Intelligence Insights
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-neutral-100"
            onClick={handleDismiss}
            title="Dismiss insights"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {displayedInsights.map((insight, index) => {
          const Icon = typeIcons[insight.type] || Info;
          const colorClass = severityColors[insight.severity] || severityColors.low;

          return (
            <motion.div
              key={`${insight.loanId || insight.customerId || 'insight'}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card className={cn('rounded-xl border-2 transition-all hover:shadow-md', colorClass)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-2 rounded-lg flex-shrink-0',
                      insight.severity === 'critical' ? 'bg-red-100' :
                      insight.severity === 'high' ? 'bg-orange-100' :
                      insight.severity === 'medium' ? 'bg-yellow-100' :
                      'bg-blue-100'
                    )}>
                      <Icon className={cn(
                        'w-4 h-4',
                        insight.severity === 'critical' ? 'text-red-600' :
                        insight.severity === 'high' ? 'text-orange-600' :
                        insight.severity === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                      <p className="text-sm opacity-90">{insight.message}</p>
                      {insight.action && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => handleAction(insight.action)}
                        >
                          {insight.action.label}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

