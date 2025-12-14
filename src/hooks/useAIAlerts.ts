/**
 * Hook for managing AI alerts
 */

import { useState, useEffect, useCallback } from 'react';
import { useAgency } from './useAgency';
import { useAuth } from './useAuth';
import { createNotification } from '../lib/firebase/notifications';

export interface AIAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  dismissed?: boolean;
  action?: {
    label: string;
    type: string;
    data: any;
  };
  loanId?: string;
  customerId?: string;
}

export function useAIAlerts() {
  const { agency } = useAgency();
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<AIAlert[]>([]);

  // Load alerts from localStorage
  useEffect(() => {
    if (!profile?.agency_id) return;

    const stored = localStorage.getItem(`ai-alerts-${profile.agency_id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAlerts(parsed.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })));
      } catch (error) {
        console.error('Failed to load alerts:', error);
      }
    }
  }, [profile?.agency_id]);

  // Save alerts to localStorage
  useEffect(() => {
    if (!profile?.agency_id) return;
    localStorage.setItem(`ai-alerts-${profile.agency_id}`, JSON.stringify(alerts));
  }, [alerts, profile?.agency_id]);

  const addAlert = useCallback(async (alert: Omit<AIAlert, 'id' | 'timestamp'>) => {
    const newAlert: AIAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      dismissed: false,
    };

    // Check for duplicates before adding
    setAlerts((prev) => {
      const exists = prev.some(
        (a) =>
          a.title === newAlert.title &&
          a.message === newAlert.message &&
          !a.dismissed
      );
      if (exists) return prev;
      
      // Add to localStorage
      const updated = [newAlert, ...prev].slice(0, 50);
      return updated;
    });

    // Also create Firestore notification so it appears in NotificationDropdown
    if (profile?.agency_id && profile?.id) {
      try {
        // Build notification data, only including defined fields
        const notificationData: any = {
          agencyId: profile.agency_id,
          userId: profile.id,
          type: 'system',
          title: alert.title,
          message: alert.message,
          priority: alert.type === 'critical' ? 'urgent' : alert.type === 'warning' ? 'high' : 'medium',
          read: false,
        };

        // Only include loanId if it's defined
        if (alert.loanId) {
          notificationData.loanId = alert.loanId;
          notificationData.actionUrl = `/admin/loans/${alert.loanId}`;
        }
        
        // Only include customerId if it's defined
        if (alert.customerId) {
          notificationData.customerId = alert.customerId;
          if (!notificationData.actionUrl) {
            notificationData.actionUrl = `/admin/customers/${alert.customerId}`;
          }
        }

        await createNotification(notificationData);
      } catch (error) {
        console.warn('Failed to create Firestore notification:', error);
        // Continue even if Firestore notification fails - localStorage alert still works
      }
    }

    return newAlert.id;
  }, [profile?.agency_id, profile?.id]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, dismissed: true } : alert
      )
    );
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, dismissed: true })));
  }, []);

  const alertCount = alerts.filter((a) => !a.dismissed).length;

  return {
    alerts: alerts.filter((a) => !a.dismissed),
    alertCount,
    addAlert,
    dismissAlert,
    clearAllAlerts,
  };
}

