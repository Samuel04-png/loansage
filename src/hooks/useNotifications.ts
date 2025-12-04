/**
 * Hook for managing notifications
 */

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { 
  subscribeToAgencyNotifications, 
  subscribeToUserNotifications,
  markNotificationAsRead,
  markUserNotificationAsRead 
} from '../lib/firebase/notifications';

export function useNotifications() {
  const { profile, user } = useAuth();
  const [agencyNotifications, setAgencyNotifications] = useState<any[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.agency_id) return;

    const unsubscribeAgency = subscribeToAgencyNotifications(
      profile.agency_id,
      (notifications) => {
        setAgencyNotifications(notifications);
        updateUnreadCount(notifications, userNotifications);
      },
      { limit: 50 }
    );

    return () => {
      unsubscribeAgency();
    };
  }, [profile?.agency_id]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeUser = subscribeToUserNotifications(
      user.id,
      (notifications) => {
        setUserNotifications(notifications);
        updateUnreadCount(agencyNotifications, notifications);
      },
      { limit: 50 }
    );

    return () => {
      unsubscribeUser();
    };
  }, [user?.id]);

  const updateUnreadCount = (agency: any[], user: any[]) => {
    const unreadAgency = agency.filter((n: any) => !n.read).length;
    const unreadUser = user.filter((n: any) => !n.read).length;
    setUnreadCount(unreadAgency + unreadUser);
  };

  const markAsRead = async (notificationId: string, isUserNotification: boolean = false) => {
    if (!profile?.agency_id) return;

    try {
      if (isUserNotification && user?.id) {
        await markUserNotificationAsRead(user.id, notificationId);
      } else {
        await markNotificationAsRead(profile.agency_id, notificationId);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const allNotifications = [...agencyNotifications, ...userNotifications].sort((a, b) => {
    const aDate = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
    const bDate = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  return {
    notifications: allNotifications,
    agencyNotifications,
    userNotifications,
    unreadCount,
    markAsRead,
  };
}

