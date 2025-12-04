import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query as firestoreQuery, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Bell, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';
import { formatDateSafe } from '../../../lib/utils';
import toast from 'react-hot-toast';

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const notificationsRef = collection(db, 'users', user.id, 'notifications');
    const q = firestoreQuery(notificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
      setNotifications(notifs);
      queryClient.setQueryData(['notifications', user.id], notifs);
    });

    return () => unsubscribe();
  }, [user?.id, queryClient]);

  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;

    try {
      const notifRef = doc(db, 'users', user.id, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
      toast.success('Notification marked as read');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update notification');
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(
        unread.map(notif => {
          const notifRef = doc(db, 'users', user.id, 'notifications', notif.id);
          return updateDoc(notifRef, { read: true });
        })
      );
      toast.success('All notifications marked as read');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update notifications');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'loan':
        return <DollarSign className="w-5 h-5 text-blue-500" />;
      case 'payment':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'system':
        return <Info className="w-5 h-5 text-slate-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="text-slate-600">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {formatDateSafe(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <Badge variant="default" className="bg-blue-500">New</Badge>
                          )}
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            Mark read
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No notifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

