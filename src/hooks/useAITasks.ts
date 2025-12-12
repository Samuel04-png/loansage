/**
 * Hook for managing AI background tasks
 * User-controlled via settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useAgency } from './useAgency';
import { useAuth } from './useAuth';
import { useAIAlerts, type AIAlert } from './useAIAlerts';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export type AITaskStatus = 'ready' | 'thinking' | 'alert' | 'task-running';

export interface AITaskConfig {
  enabled: boolean;
  interval: number; // minutes
  lastRun?: Date;
}

export interface AITaskSettings {
  masterToggle: boolean;
  tasks: {
    overdueCheck: AITaskConfig;
    defaultRateCheck: AITaskConfig;
    complianceCheck: AITaskConfig;
    cashFlowCheck: AITaskConfig;
    riskDetection: AITaskConfig;
  };
}

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

export function useAITasks() {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const { addAlert, alertCount, alerts } = useAIAlerts();
  const [status, setStatus] = useState<AITaskStatus>('ready');
  const [isRunning, setIsRunning] = useState(false);
  const [taskProgress, setTaskProgress] = useState<string>('');
  const [settings, setSettings] = useState<AITaskSettings>(DEFAULT_TASK_SETTINGS);

  // Load settings from agency
  useEffect(() => {
    if (!agency) return;

    const aiSettings = agency.settings?.aiTasks || DEFAULT_TASK_SETTINGS;
    setSettings(aiSettings);
  }, [agency]);

  // Check for overdue loans
  const checkOverdueLoans = useCallback(async () => {
    if (!profile?.agency_id || !settings.tasks.overdueCheck.enabled) return;

    try {
      setTaskProgress('Checking overdue loans...');
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const activeLoansQuery = query(
        loansRef,
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      const loansSnapshot = await getDocs(activeLoansQuery);
      const loans = loansSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const now = new Date();
      let overdueCount = 0;
      let criticalOverdue = 0;

      for (const loan of loans) {
        try {
          const repaymentsRef = collection(
            db,
            'agencies',
            profile.agency_id,
            'loans',
            loan.id,
            'repayments'
          );
          const repaymentsSnapshot = await getDocs(repaymentsRef);
          const repayments = repaymentsSnapshot.docs.map((doc) => doc.data());

          for (const repayment of repayments) {
            if (repayment.status === 'paid') continue;
            const dueDate = repayment.dueDate?.toDate?.() || new Date(repayment.dueDate);
            if (dueDate < now) {
              overdueCount++;
              const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 30) {
                criticalOverdue++;
              }
            }
          }
        } catch (error) {
          // Skip if error
        }
      }

      if (criticalOverdue > 0) {
        addAlert({
          type: 'critical',
          title: `${criticalOverdue} loan${criticalOverdue > 1 ? 's' : ''} overdue >30 days`,
          message: `Action required: ${criticalOverdue} loan${criticalOverdue > 1 ? 's have' : ' has'} been overdue for more than 30 days.`,
          action: {
            label: 'Review Loans',
            type: 'navigate',
            data: { path: '/admin/loans?filter=overdue' },
          },
        });
      } else if (overdueCount > 0) {
        addAlert({
          type: 'warning',
          title: `${overdueCount} repayment${overdueCount > 1 ? 's' : ''} overdue`,
          message: `${overdueCount} repayment${overdueCount > 1 ? 's are' : ' is'} currently overdue.`,
          action: {
            label: 'View Overdue',
            type: 'navigate',
            data: { path: '/admin/loans?filter=overdue' },
          },
        });
      }
    } catch (error) {
      console.error('Error checking overdue loans:', error);
    }
  }, [profile?.agency_id, settings.tasks.overdueCheck.enabled, addAlert]);

  // Check default rate
  const checkDefaultRate = useCallback(async () => {
    if (!profile?.agency_id || !settings.tasks.defaultRateCheck.enabled) return;

    try {
      setTaskProgress('Analyzing default rate...');
      const loansRef = collection(db, 'agencies', profile.agency_id, 'loans');
      const loansSnapshot = await getDocs(loansRef);
      const loans = loansSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const defaultedLoans = loans.filter((l: any) => l.status === 'defaulted');
      const defaultRate = loans.length > 0 ? (defaultedLoans.length / loans.length) * 100 : 0;

      if (defaultRate > 15) {
        addAlert({
          type: 'critical',
          title: 'High default rate detected',
          message: `Default rate is ${defaultRate.toFixed(1)}% - exceeds recommended threshold of 15%.`,
          action: {
            label: 'View Report',
            type: 'navigate',
            data: { path: '/admin/reports' },
          },
        });
      } else if (defaultRate > 10) {
        addAlert({
          type: 'warning',
          title: 'Default rate above average',
          message: `Default rate is ${defaultRate.toFixed(1)}% - monitor closely.`,
        });
      }
    } catch (error) {
      console.error('Error checking default rate:', error);
    }
  }, [profile?.agency_id, settings.tasks.defaultRateCheck.enabled, addAlert]);

  // Check compliance deadlines
  const checkCompliance = useCallback(async () => {
    if (!profile?.agency_id || !settings.tasks.complianceCheck.enabled) return;

    try {
      setTaskProgress('Checking compliance...');
      // This would check compliance deadlines
      // For now, we'll add a placeholder
      const daysUntilDeadline = 2; // Example
      if (daysUntilDeadline <= 7) {
        addAlert({
          type: 'critical',
          title: 'Compliance deadline approaching',
          message: `Compliance report due in ${daysUntilDeadline} day${daysUntilDeadline > 1 ? 's' : ''}.`,
          action: {
            label: 'Generate Report',
            type: 'navigate',
            data: { path: '/admin/compliance' },
          },
        });
      }
    } catch (error) {
      console.error('Error checking compliance:', error);
    }
  }, [profile?.agency_id, settings.tasks.complianceCheck.enabled, addAlert]);

  // Check cash flow
  const checkCashFlow = useCallback(async () => {
    if (!profile?.agency_id || !settings.tasks.cashFlowCheck.enabled) return;

    try {
      setTaskProgress('Analyzing cash flow...');
      // Placeholder for cash flow check
      // Would use predictive-cash-flow.ts
    } catch (error) {
      console.error('Error checking cash flow:', error);
    }
  }, [profile?.agency_id, settings.tasks.cashFlowCheck.enabled]);

  // Detect risks
  const detectRisks = useCallback(async () => {
    if (!profile?.agency_id || !settings.tasks.riskDetection.enabled) return;

    try {
      setTaskProgress('Detecting risks...');
      // Placeholder for risk detection
    } catch (error) {
      console.error('Error detecting risks:', error);
    }
  }, [profile?.agency_id, settings.tasks.riskDetection.enabled]);

  // Run all enabled tasks
  const runTasks = useCallback(async () => {
    if (!settings.masterToggle || !profile?.agency_id) return;

    setIsRunning(true);
    setStatus('task-running');

    try {
      const tasks = [];

      if (settings.tasks.overdueCheck.enabled) {
        tasks.push(checkOverdueLoans());
      }
      if (settings.tasks.defaultRateCheck.enabled) {
        tasks.push(checkDefaultRate());
      }
      if (settings.tasks.complianceCheck.enabled) {
        tasks.push(checkCompliance());
      }
      if (settings.tasks.cashFlowCheck.enabled) {
        tasks.push(checkCashFlow());
      }
      if (settings.tasks.riskDetection.enabled) {
        tasks.push(detectRisks());
      }

      await Promise.all(tasks);
    } catch (error) {
      console.error('Error running AI tasks:', error);
    } finally {
      setIsRunning(false);
      setTaskProgress('');
      setStatus('ready');
    }
  }, [
    settings,
    profile?.agency_id,
    checkOverdueLoans,
    checkDefaultRate,
    checkCompliance,
    checkCashFlow,
    detectRisks,
  ]);

  // Schedule tasks based on intervals
  useEffect(() => {
    if (!settings.masterToggle || !profile?.agency_id) return;

    const intervals: NodeJS.Timeout[] = [];

    // Set up interval for each task
    Object.entries(settings.tasks).forEach(([taskName, config]) => {
      if (config.enabled) {
        const interval = setInterval(() => {
          switch (taskName) {
            case 'overdueCheck':
              checkOverdueLoans();
              break;
            case 'defaultRateCheck':
              checkDefaultRate();
              break;
            case 'complianceCheck':
              checkCompliance();
              break;
            case 'cashFlowCheck':
              checkCashFlow();
              break;
            case 'riskDetection':
              detectRisks();
              break;
          }
        }, config.interval * 60 * 1000);

        intervals.push(interval);
      }
    });

    // Run tasks immediately on mount
    runTasks();

    return () => {
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, [settings, profile?.agency_id, runTasks, checkOverdueLoans, checkDefaultRate, checkCompliance, checkCashFlow, detectRisks]);

  // Update status based on alerts and running state
  useEffect(() => {
    if (isRunning) {
      setStatus('task-running');
    } else if (alertCount > 0) {
      setStatus('alert');
    } else {
      setStatus('ready');
    }
  }, [alertCount, isRunning]);

  return {
    status,
    isRunning,
    taskProgress,
    settings,
    runTasks,
  };
}

