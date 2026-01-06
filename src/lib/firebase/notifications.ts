/**
 * Notification System
 * Creates and manages system notifications
 */

import { collection, addDoc, query, where, orderBy, limit, onSnapshot, updateDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export interface NotificationData {
  type: 'payment_due' | 'payment_overdue' | 'loan_default' | 'loan_issued' | 'collateral_updated' | 'system' | 'approval_required';
  title: string;
  message: string;
  userId?: string;
  customerId?: string;
  loanId?: string;
  agencyId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification
 */
export async function createNotification(data: NotificationData): Promise<string> {
  const notificationsRef = collection(db, 'agencies', data.agencyId, 'notifications');
  
  const notificationData = {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(notificationsRef, notificationData);
  return docRef.id;
}

/**
 * Create user-specific notification
 * Checks user notification preferences before sending
 */
export async function createUserNotification(
  userId: string,
  data: Omit<NotificationData, 'userId' | 'agencyId'>
): Promise<string | null> {
  // Check user notification preferences
  try {
    const { doc: getDocRef, getDoc } = await import('firebase/firestore');
    const userRef = getDocRef(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      // Check if notifications are disabled in user settings
      // Default to true (enabled) if setting doesn't exist
      const notificationsEnabled = userData.settings?.notifications_enabled !== false;
      
      if (!notificationsEnabled) {
        console.log(`Notifications disabled for user ${userId}, skipping notification`);
        return null;
      }
    }
  } catch (error) {
    // If we can't check preferences, default to sending (fail open)
    console.warn('Could not check user notification preferences, sending notification:', error);
  }
  
  const notificationsRef = collection(db, 'users', userId, 'notifications');
  
  const notificationData = {
    ...data,
    userId,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(notificationsRef, notificationData);
  return docRef.id;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  agencyId: string,
  notificationId: string
): Promise<void> {
  const notificationRef = doc(db, 'agencies', agencyId, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark user notification as read
 */
export async function markUserNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Subscribe to agency notifications
 */
export function subscribeToAgencyNotifications(
  agencyId: string,
  callback: (notifications: any[]) => void,
  options: { limit?: number; unreadOnly?: boolean } = {}
): () => void {
  if (!agencyId) {
    callback([]);
    return () => {};
  }

  const notificationsRef = collection(db, 'agencies', agencyId, 'notifications');
  let q = query(notificationsRef, orderBy('createdAt', 'desc'));

  if (options.unreadOnly) {
    q = query(q, where('read', '==', false));
  }

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(notifications);
    },
    (error) => {
      console.error('Error listening to notifications:', error);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to user notifications
 */
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: any[]) => void,
  options: { limit?: number; unreadOnly?: boolean } = {}
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const notificationsRef = collection(db, 'users', userId, 'notifications');
  let q = query(notificationsRef, orderBy('createdAt', 'desc'));

  if (options.unreadOnly) {
    q = query(q, where('read', '==', false));
  }

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(notifications);
    },
    (error) => {
      console.error('Error listening to user notifications:', error);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Create payment due notification
 */
export async function notifyPaymentDue(
  agencyId: string,
  userId: string,
  loanId: string,
  customerId: string,
  amount: number,
  dueDate: Date
): Promise<void> {
  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  await createUserNotification(userId, {
    type: 'payment_due',
    title: 'Payment Due Soon',
    message: `You have a payment of ${amount.toLocaleString()} ZMW due in ${daysUntilDue} day(s).`,
    loanId,
    customerId,
    priority: daysUntilDue <= 3 ? 'high' : 'medium',
    actionUrl: `/customer/loans/${loanId}`,
    metadata: { amount, dueDate: dueDate.toISOString() },
  });
}

/**
 * Create overdue payment notification
 */
export async function notifyPaymentOverdue(
  agencyId: string,
  userId: string,
  loanId: string,
  customerId: string,
  amount: number,
  daysOverdue: number
): Promise<void> {
  await createUserNotification(userId, {
    type: 'payment_overdue',
    title: 'Payment Overdue',
    message: `Your payment of ${amount.toLocaleString()} ZMW is ${daysOverdue} day(s) overdue.`,
    loanId,
    customerId,
    priority: daysOverdue > 7 ? 'urgent' : 'high',
    actionUrl: `/customer/loans/${loanId}`,
    metadata: { amount, daysOverdue },
  });
}

/**
 * Create loan default notification
 */
export async function notifyLoanDefault(
  agencyId: string,
  loanId: string,
  customerId: string,
  loanAmount: number
): Promise<void> {
  await createNotification({
    type: 'loan_default',
    title: 'Loan Defaulted',
    message: `Loan ${loanId} has been marked as defaulted. Amount: ${loanAmount.toLocaleString()} ZMW`,
    agencyId,
    loanId,
    customerId,
    priority: 'urgent',
    actionUrl: `/admin/loans/${loanId}`,
    metadata: { loanAmount },
  });
}

