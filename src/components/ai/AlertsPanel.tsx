/**
 * Alerts Panel Component
 * 
 * Displays AI-generated alerts with filtering and lifecycle management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
// Using native select for compatibility - can be replaced with shadcn Select if available
import { AlertCircle, CheckCircle2, XCircle, Filter, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/config';
import { format } from 'date-fns';

interface Alert {
  id: string;
  agencyId: string;
  loanId: string;
  type: 'risk' | 'compliance' | 'reminder' | 'warning';
  severity: 'low' | 'medium' | 'high';
  source: 'ai';
  rule: string;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: Timestamp;
  acknowledgedAt?: Timestamp;
  resolvedAt?: Timestamp;
  expiresAt?: Timestamp;
}

interface AlertsPanelProps {
  agencyId: string;
  loanId?: string; // Optional: filter by specific loan
}

export function AlertsPanel({ agencyId, loanId }: AlertsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', agencyId, loanId, statusFilter, severityFilter],
    queryFn: async () => {
      const alertsRef = collection(db, `agencies/${agencyId}/alerts`);
      let q = query(alertsRef, orderBy('createdAt', 'desc'));

      if (loanId) {
        q = query(q, where('loanId', '==', loanId));
      }

      if (statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      }

      const snapshot = await getDocs(q);
      const alertsData: Alert[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        // Apply severity filter in memory (since we can't have multiple where clauses easily)
        if (severityFilter === 'all' || data.severity === severityFilter) {
          alertsData.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt as Timestamp,
            acknowledgedAt: data.acknowledgedAt as Timestamp | undefined,
            resolvedAt: data.resolvedAt as Timestamp | undefined,
            expiresAt: data.expiresAt as Timestamp | undefined,
          } as Alert);
        }
      });

      return alertsData;
    },
    enabled: !!agencyId,
  });

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const acknowledgeAlertFn = httpsCallable(functions, 'acknowledgeAlert');
      await acknowledgeAlertFn({ agencyId, alertId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', agencyId] });
      toast.success('Alert acknowledged');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to acknowledge alert');
    },
  });

  // Resolve alert mutation
  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const resolveAlertFn = httpsCallable(functions, 'resolveAlert');
      await resolveAlertFn({ agencyId, alertId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', agencyId] });
      toast.success('Alert resolved');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve alert');
    },
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['ID', 'Loan ID', 'Type', 'Severity', 'Rule', 'Message', 'Status', 'Created At', 'Acknowledged At', 'Resolved At'];
    const rows = alerts.map(alert => [
      alert.id,
      alert.loanId,
      alert.type,
      alert.severity,
      alert.rule,
      alert.message,
      alert.status,
      alert.createdAt ? format(alert.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
      alert.acknowledgedAt ? format(alert.acknowledgedAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
      alert.resolvedAt ? format(alert.resolvedAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts-${agencyId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'risk':
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'compliance':
        return <XCircle className="w-4 h-4" />;
      case 'reminder':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI Alerts</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="all">All Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No alerts found</div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(alert.type)}
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline">{alert.type}</Badge>
                      <Badge variant="outline">{alert.status}</Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">{alert.message}</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Rule: {alert.rule}</div>
                      <div>Loan ID: {alert.loanId}</div>
                      <div>
                        Created: {format(alert.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                      {alert.acknowledgedAt && (
                        <div>
                          Acknowledged: {format(alert.acknowledgedAt.toDate(), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                      )}
                      {alert.resolvedAt && (
                        <div>
                          Resolved: {format(alert.resolvedAt.toDate(), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                      )}
                      {alert.expiresAt && (
                        <div>
                          Expires: {format(alert.expiresAt.toDate(), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'open' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveMutation.mutate(alert.id)}
                          disabled={resolveMutation.isPending}
                        >
                          Resolve
                        </Button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveMutation.mutate(alert.id)}
                        disabled={resolveMutation.isPending}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

