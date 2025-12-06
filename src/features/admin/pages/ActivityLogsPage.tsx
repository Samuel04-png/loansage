import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Search, FileText, Loader2, User, Calendar } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils';

export function ActivityLogsPage() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', profile?.agency_id, actionFilter],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      const logsRef = collection(db, 'agencies', profile.agency_id, 'audit_logs');
      let q = firestoreQuery(logsRef, orderBy('createdAt', 'desc'), limit(500));

      const snapshot = await getDocs(q);
      let logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));

      // Filter by action if needed
      if (actionFilter !== 'all') {
        logsData = logsData.filter((log: any) =>
          log.action?.toLowerCase().includes(actionFilter.toLowerCase())
        );
      }

      return logsData;
    },
    enabled: !!profile?.agency_id,
  });

  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return <Badge variant="success">Create</Badge>;
    } else if (action.includes('update') || action.includes('edit')) {
      return <Badge variant="default">Update</Badge>;
    } else if (action.includes('delete') || action.includes('remove')) {
      return <Badge variant="destructive">Delete</Badge>;
    } else if (action.includes('login') || action.includes('logout')) {
      return <Badge variant="secondary">Auth</Badge>;
    } else {
      return <Badge variant="outline">{action}</Badge>;
    }
  };

  const filteredLogs = logs?.filter((log: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(search) ||
      log.user?.full_name?.toLowerCase().includes(search) ||
      log.user?.name?.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search) ||
      log.targetId?.toLowerCase().includes(search) ||
      log.targetCollection?.toLowerCase().includes(search) ||
      log.metadata?.toString().toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Activity Logs</h2>
        <p className="text-slate-600">Track all system activities and user actions</p>
      </div>

      <Card>
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by action, user, or entity..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y max-h-[calc(100vh-20rem)] overflow-y-auto">
              {filteredLogs.map((log: any) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">
                          {log.user?.full_name || 'System'}
                        </span>
                        {getActionBadge(log.action)}
                        <span className="text-sm text-slate-500 capitalize">
                          {log.entity_type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{log.action}</p>
                      {log.changes && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded mt-2">
                          <pre className="whitespace-pre-wrap font-mono">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {log.createdAt ? formatDateTime(log.createdAt) : '-'}
                        </span>
                        {log.metadata?.ipAddress && <span>IP: {log.metadata.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No activity logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

