/**
 * SMS and WhatsApp Notification Service
 * Integrates with Twilio for SMS and WhatsApp Business API
 */

import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { NotificationTemplate, NotificationLog } from '../../types/features';

// Twilio configuration (should be in environment variables)
const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER || '';
const TWILIO_WHATSAPP_NUMBER = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER || '';

/**
 * Replace template variables in message
 */
function replaceVariables(message: string, variables: Record<string, string>): string {
  let result = message;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  return result;
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('Twilio credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          From: TWILIO_PHONE_NUMBER,
          To: to,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.sid };
    } else {
      return { success: false, error: data.message || 'Failed to send SMS' };
    }
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.warn('Twilio WhatsApp credentials not configured');
    return { success: false, error: 'WhatsApp service not configured' };
  }

  try {
    // Format phone number for WhatsApp (must include country code)
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
          To: formattedTo,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.sid };
    } else {
      return { success: false, error: data.message || 'Failed to send WhatsApp message' };
    }
  } catch (error: any) {
    console.error('WhatsApp sending error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Send notification using template
 */
export async function sendNotification(
  agencyId: string,
  templateId: string,
  recipient: string,
  variables: Record<string, string>
): Promise<NotificationLog> {
  // Get template
  const templateRef = doc(db, 'agencies', agencyId, 'notification_templates', templateId);
  const templateSnap = await getDoc(templateRef);
  
  if (!templateSnap.exists()) {
    throw new Error('Template not found');
  }

  const template = templateSnap.data() as NotificationTemplate;
  
  if (!template.isActive) {
    throw new Error('Template is not active');
  }

  // Replace variables in message
  const message = replaceVariables(template.message, variables);

  // Send based on type
  let result: { success: boolean; messageId?: string; error?: string };
  
  if (template.type === 'sms') {
    result = await sendSMS(recipient, message);
  } else if (template.type === 'whatsapp') {
    result = await sendWhatsApp(recipient, message);
  } else {
    // Email would be handled separately
    result = { success: false, error: 'Email notifications handled separately' };
  }

  // Log notification
  const logRef = collection(db, 'agencies', agencyId, 'notification_logs');
  const log: Omit<NotificationLog, 'id'> = {
    templateId,
    recipient,
    type: template.type,
    status: result.success ? 'sent' : 'failed',
    message,
    sentAt: result.success ? new Date() : undefined,
    error: result.error,
  };

  const docRef = await addDoc(logRef, {
    ...log,
    sentAt: log.sentAt?.toISOString(),
  });

  return {
    id: docRef.id,
    ...log,
  };
}

/**
 * Get notification templates
 */
export async function getNotificationTemplates(agencyId: string): Promise<NotificationTemplate[]> {
  const templatesRef = collection(db, 'agencies', agencyId, 'notification_templates');
  const snapshot = await getDocs(templatesRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as NotificationTemplate[];
}

/**
 * Get notification logs
 */
export async function getNotificationLogs(
  agencyId: string,
  limitCount: number = 100
): Promise<NotificationLog[]> {
  const logsRef = collection(db, 'agencies', agencyId, 'notification_logs');
  const q = query(logsRef, orderBy('sentAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    sentAt: doc.data().sentAt?.toDate(),
    deliveredAt: doc.data().deliveredAt?.toDate(),
  })) as NotificationLog[];
}

/**
 * Create default notification templates
 */
export async function createDefaultTemplates(agencyId: string): Promise<void> {
  const templatesRef = collection(db, 'agencies', agencyId, 'notification_templates');
  
  const defaultTemplates: Omit<NotificationTemplate, 'id'>[] = [
    {
      name: 'Payment Due Reminder',
      type: 'sms',
      trigger: 'payment_due',
      message: 'Hello {customerName}, your payment of {amount} is due on {dueDate}. Please make payment to avoid late fees.',
      variables: ['customerName', 'amount', 'dueDate'],
      isActive: true,
    },
    {
      name: 'Payment Overdue Alert',
      type: 'sms',
      trigger: 'payment_overdue',
      message: 'Hello {customerName}, your payment of {amount} is overdue by {daysOverdue} days. Please make payment immediately.',
      variables: ['customerName', 'amount', 'daysOverdue'],
      isActive: true,
    },
    {
      name: 'Loan Approved',
      type: 'whatsapp',
      trigger: 'loan_approved',
      message: 'Congratulations {customerName}! Your loan of {amount} has been approved. You will receive disbursement details shortly.',
      variables: ['customerName', 'amount'],
      isActive: true,
    },
    {
      name: 'Payment Received',
      type: 'sms',
      trigger: 'payment_received',
      message: 'Thank you {customerName}! We have received your payment of {amount}. Your remaining balance is {remainingBalance}.',
      variables: ['customerName', 'amount', 'remainingBalance'],
      isActive: true,
    },
  ];

  for (const template of defaultTemplates) {
    await addDoc(templatesRef, template);
  }
}

