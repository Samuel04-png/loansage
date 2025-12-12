/**
 * AI Task Settings Component
 * User controls for background AI tasks
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Sparkles, AlertCircle, Clock, TrendingUp, Shield, DollarSign } from 'lucide-react';
import { useAgency } from '../../hooks/useAgency';
import { useAuth } from '../../hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import toast from 'react-hot-toast';
import type { AITaskSettings } from '../../hooks/useAITasks';

const DEFAULT_TASK_SETTINGS: AITaskSettings = {
  masterToggle: true,
  tasks: {
    overdueCheck: { enabled: true, interval: 5 },
    defaultRateCheck: { enabled: true, interval: 15 },
    complianceCheck: { enabled: true, interval: 60 },
    cashFlowCheck: { enabled: true, interval: 30 },
    riskDetection: { enabled: true, interval: 10 },
  },
};

const TASK_DESCRIPTIONS = {
  overdueCheck: {
    name: 'Overdue Loan Check',
    description: 'Automatically detect and alert on overdue loans',
    icon: AlertCircle,
    defaultInterval: 5,
  },
  defaultRateCheck: {
    name: 'Default Rate Monitoring',
    description: 'Monitor portfolio default rate and alert if threshold exceeded',
    icon: TrendingUp,
    defaultInterval: 15,
  },
  complianceCheck: {
    name: 'Compliance Deadline Check',
    description: 'Track compliance deadlines and generate alerts',
    icon: Shield,
    defaultInterval: 60,
  },
  cashFlowCheck: {
    name: 'Cash Flow Analysis',
    description: 'Analyze cash flow predictions and detect issues',
    icon: DollarSign,
    defaultInterval: 30,
  },
  riskDetection: {
    name: 'Risk Detection',
    description: 'Detect high-risk loans and anomalies',
    icon: AlertCircle,
    defaultInterval: 10,
  },
};

export function AITaskSettings() {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AITaskSettings>(DEFAULT_TASK_SETTINGS);

  useEffect(() => {
    if (agency?.settings?.aiTasks) {
      setSettings(agency.settings.aiTasks as AITaskSettings);
    }
  }, [agency]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: AITaskSettings) => {
      if (!profile?.agency_id) throw new Error('Agency not found');
      const agencyRef = doc(db, 'agencies', profile.agency_id);
      await updateDoc(agencyRef, {
        'settings.aiTasks': newSettings,
      });
    },
    onSuccess: () => {
      toast.success('AI task settings updated');
      queryClient.invalidateQueries({ queryKey: ['agency', profile?.agency_id] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });

  const handleMasterToggle = (enabled: boolean) => {
    const newSettings = { ...settings, masterToggle: enabled };
    setSettings(newSettings);
    updateSettingsMutation.mutate(newSettings);
  };

  const handleTaskToggle = (taskKey: keyof typeof settings.tasks, enabled: boolean) => {
    const newSettings = {
      ...settings,
      tasks: {
        ...settings.tasks,
        [taskKey]: { ...settings.tasks[taskKey], enabled },
      },
    };
    setSettings(newSettings);
    updateSettingsMutation.mutate(newSettings);
  };

  const handleIntervalChange = (taskKey: keyof typeof settings.tasks, interval: number) => {
    const newSettings = {
      ...settings,
      tasks: {
        ...settings.tasks,
        [taskKey]: { ...settings.tasks[taskKey], interval: Math.max(1, Math.min(1440, interval)) },
      },
    };
    setSettings(newSettings);
    updateSettingsMutation.mutate(newSettings);
  };

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Background Tasks
          </CardTitle>
          <CardDescription>
            Control automated AI tasks that monitor your loan portfolio and generate alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
            <div>
              <Label htmlFor="master-toggle" className="text-base font-semibold">
                Enable AI Background Tasks
              </Label>
              <p className="text-sm text-neutral-600 mt-1">
                Master switch for all AI automated monitoring tasks
              </p>
            </div>
            <Switch
              id="master-toggle"
              checked={settings.masterToggle}
              onCheckedChange={handleMasterToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Individual Task Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Task Configuration</CardTitle>
          <CardDescription>
            Configure individual tasks. Each task runs at the specified interval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(settings.tasks).map(([taskKey, taskConfig]) => {
            const taskInfo = TASK_DESCRIPTIONS[taskKey as keyof typeof TASK_DESCRIPTIONS];
            const Icon = taskInfo.icon;

            return (
              <div
                key={taskKey}
                className="p-4 border border-neutral-200 rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-[#006BFF]/10 rounded-lg">
                      <Icon className="w-5 h-5 text-[#006BFF]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`task-${taskKey}`} className="text-base font-semibold">
                          {taskInfo.name}
                        </Label>
                        {taskConfig.enabled && (
                          <Badge variant="outline" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{taskInfo.description}</p>
                    </div>
                  </div>
                  <Switch
                    id={`task-${taskKey}`}
                    checked={taskConfig.enabled && settings.masterToggle}
                    onCheckedChange={(enabled) => handleTaskToggle(taskKey as any, enabled)}
                    disabled={!settings.masterToggle}
                  />
                </div>

                {taskConfig.enabled && settings.masterToggle && (
                  <div className="pl-11 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`interval-${taskKey}`} className="text-sm">
                        Check Interval:
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`interval-${taskKey}`}
                          type="number"
                          min={1}
                          max={1440}
                          value={taskConfig.interval}
                          onChange={(e) =>
                            handleIntervalChange(
                              taskKey as any,
                              parseInt(e.target.value) || taskInfo.defaultInterval
                            )
                          }
                          className="w-20 h-8"
                        />
                        <span className="text-sm text-neutral-600">minutes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span>
                        Next run: ~{taskConfig.interval} minute{taskConfig.interval !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-900">How It Works</p>
              <p className="text-sm text-blue-700">
                AI tasks run automatically in the background to monitor your loan portfolio.
                When issues are detected, you'll receive alerts in the AI indicator (top-right).
                You can control which tasks run and how frequently they check for issues.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

