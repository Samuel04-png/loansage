import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Bell, Check, X, Trash2, Filter } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../../components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { useAuth } from '../../../hooks/useAuth';
import { format } from 'date-fns';

export function NotificationsPage() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', profile?.agency_id, filter],
    queryFn: async () => {
      if (!profile?.agency_id) return [];
      
      const notificationsRef = collection(db, 'agencies', profile.agency_id, 'notifications');
      let q = query(notificationsRef, orderBy('createdAt', 'desc'));
      
      if (filter === 'unread') {
        q = query(notificationsRef, where('read', '==', false), orderBy('createdAt', 'desc'));
      } else if (filter === 'read') {
        q = query(notificationsRef, where('read', '==', true), orderBy('createdAt', 'desc'));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));
    },
    enabled: !!profile?.agency_id,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAsRead = async (id: string) => {
    // TODO: Implement mark as read
  };

  const markAllAsRead = async () => {
    // TODO: Implement mark all as read
  };

  const deleteNotification = async (id: string) => {
    // TODO: Implement delete
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-[#006BFF]" />
            Notifications
          </h1>
          <p className="text-neutral-600 mt-2">Manage your notifications and alerts</p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="gap-2">
            <Check className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Notifications</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                Unread ({unreadCount})
              </Button>
              <Button
                variant={filter === 'read' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('read')}
              >
                Read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-neutral-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No notifications</h3>
              <p className="text-neutral-500">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    notification.read
                      ? 'bg-white border-neutral-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-neutral-900">{notification.title}</h3>
                        {!notification.read && (
                          <Badge variant="default" className="bg-blue-600">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-neutral-400">
                        {format(notification.createdAt, 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNotification(notification.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

