import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Bell, Check, X } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface NotificationCenterProps {
  onClose?: () => void;
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter((n: any) => !n.read_at).length || 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification: any) => (
              <div
                key={notification.id}
                className={`p-4 border-b border-slate-100 hover:bg-slate-50 ${
                  !notification.read_at ? 'bg-primary-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">
                      {notification.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <button
                      onClick={() => markAsRead.mutate(notification.id)}
                      className="ml-2 text-slate-400 hover:text-primary-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

