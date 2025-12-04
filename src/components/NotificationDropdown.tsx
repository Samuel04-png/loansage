import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bell, Mail, X, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { formatDateSafe } from '../lib/utils';
import { Link } from 'react-router-dom';

export function NotificationDropdown() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch pending invitations
  const { data: invitations } = useQuery({
    queryKey: ['pending-invitations', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return [];

      try {
        const invitationsRef = collection(db, 'agencies', profile.agency_id, 'invitations');
        // Try with orderBy first, fallback to without if index missing
        let q;
        try {
          q = firestoreQuery(
            invitationsRef,
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
        } catch (error) {
          // If orderBy fails (no index), try without it
          q = firestoreQuery(
            invitationsRef,
            where('status', '==', 'pending'),
            limit(10)
          );
        }
        const snapshot = await getDocs(q);
        const invites = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          expiresAt: doc.data().expiresAt?.toDate?.() || doc.data().expires_at,
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().created_at,
        }));
        
        // Sort manually if orderBy failed
        return invites.sort((a: any, b: any) => {
          const aDate = a.createdAt instanceof Date ? a.createdAt : a.createdAt ? new Date(a.createdAt) : new Date(0);
          const bDate = b.createdAt instanceof Date ? b.createdAt : b.createdAt ? new Date(b.createdAt) : new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      } catch (error) {
        console.warn('Failed to fetch invitations:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id && isOpen,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch notifications (if using Firestore notifications)
  const { data: notifications } = useQuery({
    queryKey: ['notifications', profile?.id, profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id || !profile?.id) return [];

      try {
        const notificationsRef = collection(db, 'agencies', profile.agency_id, 'notifications');
        const q = firestoreQuery(
          notificationsRef,
          where('userId', '==', profile.id),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().created_at,
        }));
      } catch (error) {
        console.warn('Failed to fetch notifications:', error);
        return [];
      }
    },
    enabled: !!profile?.agency_id && !!profile?.id && isOpen,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const pendingInvitations = invitations?.filter((inv: any) => {
    const expiresAt = inv.expiresAt instanceof Date 
      ? inv.expiresAt 
      : inv.expiresAt?.toDate?.() 
      ? inv.expiresAt.toDate() 
      : inv.expiresAt ? new Date(inv.expiresAt) : null;
    return expiresAt && expiresAt > new Date();
  }) || [];

  const unreadNotifications = notifications?.filter((n: any) => !n.readAt && !n.read_at) || [];
  const totalUnread = pendingInvitations.length + unreadNotifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        )}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {totalUnread > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {totalUnread}
                </Badge>
              )}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Invitations Section */}
            {pendingInvitations.length > 0 && (
              <div className="border-b border-slate-200">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    Pending Invitations ({pendingInvitations.length})
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {pendingInvitations.map((inv: any) => {
                    const expiresAt = inv.expiresAt instanceof Date 
                      ? inv.expiresAt 
                      : inv.expiresAt?.toDate?.() 
                      ? inv.expiresAt.toDate() 
                      : inv.expiresAt ? new Date(inv.expiresAt) : null;
                    const isExpiringSoon = expiresAt && (expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000;

                    return (
                      <Link
                        key={inv.id}
                        to="/admin/invitations"
                        onClick={() => setIsOpen(false)}
                        className="block p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-5 h-5 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900">
                              Employee Invitation
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              Invite sent to <span className="font-medium">{inv.email}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {expiresAt ? (
                                <>
                                  Expires {formatDateSafe(expiresAt)}
                                  {isExpiringSoon && (
                                    <Badge variant="warning" className="ml-2 text-xs">Expiring Soon</Badge>
                                  )}
                                </>
                              ) : (
                                'No expiry date'
                              )}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {unreadNotifications.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    System Notifications ({unreadNotifications.length})
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {unreadNotifications.map((notification: any) => (
                    <Link
                      key={notification.id}
                      to={notification.link || '#'}
                      onClick={() => setIsOpen(false)}
                      className="block p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900">
                            {notification.title || 'Notification'}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            {notification.message || notification.body || ''}
                          </p>
                          {notification.createdAt && (
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDateSafe(notification.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {pendingInvitations.length === 0 && unreadNotifications.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No new notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {(pendingInvitations.length > 0 || unreadNotifications.length > 0) && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <Link to="/admin/invitations">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsOpen(false)}
                >
                  View All Invitations
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

