/**
 * Customer Notifications System
 * Sends notifications for payment reminders, overdue loans, etc.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

const db = admin.firestore();

// Email transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || '',
    pass: functions.config().email?.password || '',
  },
});

interface NotificationData {
  userId: string;
  type: 'payment_reminder' | 'payment_due' | 'overdue' | 'defaulted' | 'payment_received' | 'loan_approved' | 'loan_rejected';
  loanId: string;
  message: string;
  email?: string;
}

export const sendNotifications = functions.https.onCall(
  async (data: NotificationData, context: any): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, type, loanId, message, email } = data;

    try {
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
        const subject = getEmailSubject(type);
        await transporter.sendMail({
          from: functions.config().email?.user || 'noreply@loansage.com',
          to: email,
          subject,
          html: getEmailTemplate(type, message),
        });
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
  if (email && functions.config().email?.user) {
    try {
      await transporter.sendMail({
        from: functions.config().email?.user || 'noreply@loansage.com',
        to: email,
        subject: getEmailSubject(type),
        html: getEmailTemplate(type, message),
      });
    } catch (error) {
      console.error('Email send error:', error);
    }
  }
}

function getEmailSubject(type: string): string {
  const subjects: Record<string, string> = {
    payment_reminder: 'Payment Reminder - LoanSage',
    payment_due: 'Payment Due Today - LoanSage',
    overdue: 'Overdue Payment Notice - LoanSage',
    defaulted: 'Loan Defaulted - LoanSage',
    payment_received: 'Payment Received - LoanSage',
    loan_approved: 'Loan Approved - LoanSage',
    loan_rejected: 'Loan Application Update - LoanSage',
  };
  return subjects[type] || 'Notification from LoanSage';
}

function getEmailTemplate(type: string, message: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${getEmailSubject(type)}</h2>
        <p>${message}</p>
        <p>Thank you for using LoanSage.</p>
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
  return messages[type] || 'You have a new notification from LoanSage';
}

