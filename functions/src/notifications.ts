/**
 * Customer Notifications System
 * Sends notifications for payment reminders, overdue loans, etc.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { enforceQuota } from './usage-ledger';
import { isInternalEmail } from './internal-bypass';
import { getAgencyName, getByteBerryFooter } from './utils/email-utils';

const db = admin.firestore();

// Email transporter - lazy initialization to avoid deployment timeouts
const getTransporter = () => {
  const emailConfig = functions.config().email;
  if (!emailConfig?.user || !emailConfig?.password) {
    console.warn('Email configuration not set. Email sending will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  });
};

interface NotificationData {
  userId: string;
  type: 'payment_reminder' | 'payment_due' | 'overdue' | 'defaulted' | 'payment_received' | 'loan_approved' | 'loan_rejected';
  loanId: string;
  message: string;
  email?: string;
  agencyId?: string;
}

export const sendNotifications = functions.https.onCall(
  async (data: NotificationData, context: any): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, type, loanId, message, email } = data;

    try {
      // Determine agencyId to enforce quota (prefer explicit; fallback to loan lookup)
      let agencyId: string | undefined = data.agencyId;

      if (!agencyId && loanId) {
        try {
          const loanSnap = await db.collection('loans').doc(loanId).get();
          if (loanSnap.exists) {
            const loan = loanSnap.data() as any;
            if (loan?.agencyId) {
              agencyId = String(loan.agencyId);
            }
          }
        } catch {}
      }

      if (agencyId && !isInternalEmail(context)) {
        await enforceQuota(agencyId, 'notificationsSent', 1);
      } else if (!agencyId) {
        console.warn('sendNotifications: agencyId not provided and not derivable from loanId; skipping quota enforcement');
      }

      // Create in-app notification
      const notificationRef = db.collection(`users/${userId}/notifications`).doc();
      await notificationRef.set({
        type,
        loanId,
        message,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send email if email provided
      if (email) {
        const transporter = getTransporter();
        if (transporter) {
          const emailConfig = functions.config().email;
          const fromEmail = emailConfig?.user || 'noreply@tengaloans.com';
          
          // Get agency name for sender name
          let agencyName = 'TengaLoans';
          if (agencyId) {
            agencyName = await getAgencyName(agencyId);
          }
          
          const fromAddress = `${agencyName} <${fromEmail}>`;
          const subject = getEmailSubject(type, agencyName);
          
          await transporter.sendMail({
            from: fromAddress,
            to: email,
            subject,
            html: getEmailTemplate(type, message, agencyName),
          });
        }
      }

      // Send FCM notification if token exists
      const userRef = db.doc(`users/${userId}`);
      const userSnap = await userRef.get();
      const fcmToken = userSnap.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: getNotificationTitle(type),
            body: message,
          },
          data: {
            type,
            loanId,
          },
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Notification error:', error);
      throw new functions.https.HttpsError('internal', 'Notification failed', error.message);
    }
  }
);

// Scheduled function to send payment reminders
export const sendPaymentReminders = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight UTC
  .timeZone('UTC')
  .onRun(async (context: any) => {
    console.log('Sending payment reminders...');

    try {
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;
        const loansSnapshot = await db
          .collection(`agencies/${agencyId}/loans`)
          .where('status', 'in', ['active', 'approved'])
          .get();

        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        for (const loanDoc of loansSnapshot.docs) {
          const loanId = loanDoc.id;
          const repaymentsSnapshot = await db
            .collection(`agencies/${agencyId}/loans/${loanId}/repayments`)
            .where('status', '==', 'pending')
            .get();

          for (const repaymentDoc of repaymentsSnapshot.docs) {
            const repayment = repaymentDoc.data();
            const dueDate = repayment.dueDate?.toDate();

            if (dueDate) {
              // 3 days before due date
              if (dueDate <= threeDaysFromNow && dueDate > now) {
                await sendNotificationForRepayment(agencyId, loanId, repayment, 'payment_reminder');
              }
              // Due today
              if (
                dueDate.toDateString() === now.toDateString() &&
                repayment.status === 'pending'
              ) {
                await sendNotificationForRepayment(agencyId, loanId, repayment, 'payment_due');
              }
              // Overdue
              if (dueDate < now && repayment.status === 'pending') {
                await sendNotificationForRepayment(agencyId, loanId, repayment, 'overdue');
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      throw error;
    }
  });

async function sendNotificationForRepayment(
  agencyId: string,
  loanId: string,
  repayment: any,
  type: string
) {
  // Meter notification per send
  try {
    await enforceQuota(agencyId, 'notificationsSent', 1);
  } catch (e) {
    console.warn('Notification quota exceeded or unavailable for agency', agencyId, e);
    return;
  }
  // Get loan and customer info
  const loanRef = db.doc(`agencies/${agencyId}/loans/${loanId}`);
  const loanSnap = await loanRef.get();
  const loan = loanSnap.data();

  if (!loan) return;

  const customerRef = db.doc(`agencies/${agencyId}/customers/${loan.customerId}`);
  const customerSnap = await customerRef.get();
  const customer = customerSnap.data();

  if (!customer) return;

  // Find user by customer
  const usersQuery = await db.collection('users').where('customerId', '==', loan.customerId).get();
  if (usersQuery.empty) return;

  const userId = usersQuery.docs[0].id;
  const user = usersQuery.docs[0].data();

  const message = getNotificationMessage(type, loan, repayment);
  const email = customer.email || user.email;

  // Create notification directly
  const notificationRef = db.collection(`users/${userId}/notifications`).doc();
  await notificationRef.set({
    type: type as any,
    loanId,
    message,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send email if available
  if (email) {
    try {
      const transporter = getTransporter();
      if (transporter) {
        const emailConfig = functions.config().email;
        const fromEmail = emailConfig?.user || 'noreply@tengaloans.com';
        
        // Get agency name for sender name
        const agencyName = await getAgencyName(agencyId);
        const fromAddress = `${agencyName} <${fromEmail}>`;
        
        await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: getEmailSubject(type, agencyName),
          html: getEmailTemplate(type, message, agencyName),
        });
      }
    } catch (error) {
      console.error('Email send error:', error);
    }
  }
}

function getEmailSubject(type: string, agencyName: string = 'TengaLoans'): string {
  const subjects: Record<string, string> = {
    payment_reminder: `Payment Reminder – ${agencyName}`,
    payment_due: `Payment Due Today – ${agencyName}`,
    overdue: `Overdue Payment Notice – ${agencyName}`,
    defaulted: `Loan Defaulted – ${agencyName}`,
    payment_received: `Payment Received – ${agencyName}`,
    loan_approved: `Loan Approved – ${agencyName}`,
    loan_rejected: `Loan Application Update – ${agencyName}`,
  };
  return subjects[type] || `Notification from ${agencyName}`;
}

function getEmailTemplate(type: string, message: string, agencyName: string = 'TengaLoans'): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 1px solid #e5e5e5;
          padding-bottom: 20px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #006BFF;
        }
        .content {
          color: #4a4a4a;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${agencyName}</div>
        </div>
        <div class="content">
          <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 15px;">${getEmailSubject(type, agencyName)}</h2>
          <p>${message}</p>
          <p style="margin-top: 20px;">Thank you for using ${agencyName}.</p>
        </div>
        ${getByteBerryFooter()}
      </div>
    </body>
    </html>
  `;
}

function getNotificationTitle(type: string): string {
  const titles: Record<string, string> = {
    payment_reminder: 'Payment Reminder',
    payment_due: 'Payment Due Today',
    overdue: 'Overdue Payment',
    defaulted: 'Loan Defaulted',
    payment_received: 'Payment Received',
    loan_approved: 'Loan Approved',
    loan_rejected: 'Loan Update',
  };
  return titles[type] || 'Notification';
}

function getNotificationMessage(type: string, loan: any, repayment: any): string {
  const dueDate = repayment.dueDate?.toDate?.() || new Date();
  const amount = repayment.amountDue || 0;

  const messages: Record<string, string> = {
    payment_reminder: `Reminder: Payment of ${amount.toLocaleString()} ZMW is due in 3 days (${dueDate.toLocaleDateString()})`,
    payment_due: `Payment of ${amount.toLocaleString()} ZMW is due today for loan ${loan.id}`,
    overdue: `Your payment of ${amount.toLocaleString()} ZMW is overdue. Please contact us immediately.`,
    defaulted: `Your loan ${loan.id} has been marked as defaulted. Please contact us urgently.`,
    payment_received: `Payment of ${amount.toLocaleString()} ZMW has been received for loan ${loan.id}`,
    loan_approved: `Congratulations! Your loan application has been approved.`,
    loan_rejected: `Your loan application has been reviewed. Please contact us for details.`,
  };
  return messages[type] || 'You have a new notification from TengaLoans';
}

