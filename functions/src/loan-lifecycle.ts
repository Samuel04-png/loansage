/**
 * Loan Lifecycle Cloud Functions
 * Handles automated notifications for loan status changes
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { getAgencyPlan, enforceQuota } from './usage-ledger';
import { getByteBerryFooter } from './utils/email-utils';

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL UTILITIES (Reusing existing pattern)
// ═══════════════════════════════════════════════════════════════════════════════

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

async function logEmailSend(
  agencyId: string,
  recipientId: string,
  email: string,
  type: string,
  status: 'sent' | 'failed',
  error: string | null
): Promise<void> {
  try {
    await db.collection('emailLogs').add({
      agencyId,
      recipientId,
      email,
      type,
      status,
      error,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to log email send:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE SYSTEM (Enterprise-aware)
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationTemplate {
  subject: string;
  body: string;
}

interface TemplateVariables {
  customerName?: string;
  agencyName?: string;
  loanNumber?: string;
  amount?: string;
  dueDate?: string;
  [key: string]: string | undefined;
}

async function getNotificationTemplate(
  agencyId: string,
  templateType: string
): Promise<NotificationTemplate | null> {
  try {
    const plan = await getAgencyPlan(agencyId);
    
    if (plan === 'enterprise') {
      const templateRef = db.doc(`agencies/${agencyId}/notification_config/templates`);
      const templateSnap = await templateRef.get();
      
      if (templateSnap.exists) {
        const templates = templateSnap.data();
        if (templates?.[templateType]) {
          return templates[templateType] as NotificationTemplate;
        }
      }
    }
    
    return null;
  } catch (e) {
    console.warn('Failed to fetch custom template:', e);
    return null;
  }
}

function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
  }
  
  return result;
}

const DEFAULT_TEMPLATES: Record<string, NotificationTemplate> = {
  loan_approved: {
    subject: "Great News! Your Loan #{{loanNumber}} Has Been Approved",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Your loan application <strong>#{{loanNumber}}</strong> has been <span style="color: #22C55E; font-weight: bold;">approved</span>!</p>
      <p>Loan Amount: <strong>{{amount}}</strong></p>
      <p>Please log in to your customer portal to review and sign the loan agreement.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portalUrl}}" style="display: inline-block; background: linear-gradient(135deg, #006BFF 0%, #4F46E5 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Loan Details →</a>
      </div>
    `,
  },
  loan_disbursed: {
    subject: "Funds Sent – Loan #{{loanNumber}}",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Great news! 🎉 Funds of <strong>{{amount}}</strong> have been disbursed for your loan <strong>#{{loanNumber}}</strong>.</p>
      <p>The funds should arrive in your designated account within 1-3 business days.</p>
      <p>Your first payment will be due on <strong>{{dueDate}}</strong>.</p>
    `,
  },
  loan_settled: {
    subject: "Congratulations! Loan #{{loanNumber}} Fully Paid Off 🎉",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Congratulations! 🎉🎉 Your loan <strong>#{{loanNumber}}</strong> has been <span style="color: #22C55E; font-weight: bold;">fully paid off</span>.</p>
      <p>Thank you for being a valued customer of <strong>{{agencyName}}</strong>.</p>
      <p>We hope to serve you again in the future!</p>
    `,
  },
  loan_rejected: {
    subject: "Update on Your Loan Application #{{loanNumber}}",
    body: `
      <p>Hello {{customerName}},</p>
      <p>We regret to inform you that your loan application <strong>#{{loanNumber}}</strong> could not be approved at this time.</p>
      <p>If you have questions about this decision, please contact <strong>{{agencyName}}</strong> directly.</p>
    `,
  },
};

function buildEmailHtml(agencyName: string, bodyContent: string): string {
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
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${agencyName}</div>
        </div>
        <div class="content">
          ${bodyContent}
        </div>
        ${getByteBerryFooter()}
      </div>
    </body>
    </html>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAN STATUS CHANGE TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════

type LoanStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'overdue' | 'settled' | 'defaulted' | 'closed';

const NOTIFICATION_STATUSES: LoanStatus[] = ['approved', 'rejected', 'disbursed', 'settled'];

/**
 * Format currency amount
 */
function formatAmount(amount: number, currency: string = 'ZMW'): string {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-ZM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Trigger: When a loan status changes
 * Sends appropriate notification to customer
 */
export const onLoanStatusChange = functions.firestore
  .document('agencies/{agencyId}/loans/{loanId}')
  .onUpdate(async (change, context) => {
    const { agencyId, loanId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeStatus = beforeData.status as LoanStatus;
    const afterStatus = afterData.status as LoanStatus;

    // Only proceed if status actually changed to a notification-worthy status
    if (beforeStatus === afterStatus || !NOTIFICATION_STATUSES.includes(afterStatus)) {
      return;
    }

    console.log(`Loan ${loanId} status changed: ${beforeStatus} -> ${afterStatus}`);

    try {
      // Get customer details
      const customerId = afterData.customerId;
      if (!customerId) {
        console.warn(`Loan ${loanId} has no customerId`);
        return;
      }

      const customerRef = db.doc(`agencies/${agencyId}/customers/${customerId}`);
      const customerSnap = await customerRef.get();
      
      if (!customerSnap.exists) {
        console.warn(`Customer ${customerId} not found`);
        return;
      }

      const customerData = customerSnap.data();
      const email = customerData?.email;

      if (!email) {
        console.warn(`Customer ${customerId} has no email`);
        return;
      }

      // Get agency details
      const agencyRef = db.doc(`agencies/${agencyId}`);
      const agencySnap = await agencyRef.get();
      const agencyData = agencySnap.data();
      const agencyName = agencyData?.name || 'TengaLoans';

      // Enforce notification quota
      try {
        await enforceQuota(agencyId, 'notificationsSent', 1);
      } catch (quotaError) {
        console.warn(`Notification quota exceeded for agency ${agencyId}:`, quotaError);
        return;
      }

      // Determine template type
      const templateType = `loan_${afterStatus}`;
      
      // Get template
      const customTemplate = await getNotificationTemplate(agencyId, templateType);
      const template = customTemplate || DEFAULT_TEMPLATES[templateType];

      if (!template) {
        console.warn(`No template found for ${templateType}`);
        return;
      }

      // Build variables
      const appUrl = process.env.APP_URL || 'https://app.tengaloans.com';
      const loanAmount = afterData.loanAmount || afterData.terms?.amount || 0;
      
      // Calculate first payment date (1 month from disbursement)
      let firstPaymentDate = '';
      if (afterStatus === 'disbursed') {
        const disbursementDate = afterData.disbursementDate?.toDate() || new Date();
        const firstPayment = new Date(disbursementDate);
        firstPayment.setMonth(firstPayment.getMonth() + 1);
        firstPaymentDate = formatDate(firstPayment);
      }

      const variables: TemplateVariables = {
        customerName: customerData.fullName || customerData.firstName || 'Valued Customer',
        agencyName,
        loanNumber: afterData.loanNumber || loanId,
        amount: formatAmount(loanAmount),
        dueDate: firstPaymentDate,
        portalUrl: `${appUrl}/customer/loans/${loanId}`,
      };

      const subject = replaceTemplateVariables(template.subject, variables);
      const bodyContent = replaceTemplateVariables(template.body, variables);
      const html = buildEmailHtml(agencyName, bodyContent);

      // Send email
      const transporter = getTransporter();
      if (transporter) {
        const emailConfig = functions.config().email;
        const fromEmail = emailConfig?.user || 'noreply@tengaloans.com';
        const fromName = agencyData?.emailSenderName || agencyName;

        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject,
          html,
        });

        await logEmailSend(agencyId, customerId, email, templateType, 'sent', null);
        console.log(`${afterStatus} notification sent to ${email} for loan ${loanId}`);
      }

      // Create in-app notification
      const userId = customerData.userId;
      if (userId) {
        await db.collection(`users/${userId}/notifications`).add({
          type: templateType,
          loanId,
          agencyId,
          title: getNotificationTitle(afterStatus),
          message: getNotificationMessage(afterStatus, afterData.loanNumber || loanId, formatAmount(loanAmount)),
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

    } catch (error: any) {
      console.error('Error in onLoanStatusChange:', error);
      await logEmailSend(
        agencyId,
        afterData.customerId || 'unknown',
        'unknown',
        `loan_${afterStatus}`,
        'failed',
        error.message
      );
    }
  });

function getNotificationTitle(status: LoanStatus): string {
  const titles: Record<string, string> = {
    approved: '🎉 Loan Approved!',
    rejected: 'Loan Application Update',
    disbursed: '💰 Funds Disbursed!',
    settled: '🎊 Loan Fully Paid!',
  };
  return titles[status] || 'Loan Update';
}

function getNotificationMessage(status: LoanStatus, loanNumber: string, amount: string): string {
  const messages: Record<string, string> = {
    approved: `Great news! Your loan #${loanNumber} for ${amount} has been approved.`,
    rejected: `Your loan application #${loanNumber} has been reviewed. Please contact us for details.`,
    disbursed: `${amount} has been disbursed for your loan #${loanNumber}.`,
    settled: `Congratulations! Your loan #${loanNumber} has been fully paid off.`,
  };
  return messages[status] || `Your loan #${loanNumber} status has been updated.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED PAYMENT REMINDERS (1-day and 3-day before)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enhanced scheduled payment reminders
 * Runs daily at 9 AM CAT (Central Africa Time)
 */
export const enhancedPaymentReminders = functions.pubsub
  .schedule('0 7 * * *') // 7 AM UTC = 9 AM CAT
  .timeZone('Africa/Lusaka')
  .onRun(async () => {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    console.log('Running enhanced payment reminders...');

    try {
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;
        const agencyData = agencyDoc.data();
        const agencyName = agencyData.name || 'TengaLoans';

        // Get pending repayments due in next 3 days
        const repaymentsQuery = await db
          .collectionGroup('repayments')
          .where('status', '==', 'pending')
          .where('agencyId', '==', agencyId)
          .get();

        for (const repaymentDoc of repaymentsQuery.docs) {
          const repayment = repaymentDoc.data();
          const dueDate = repayment.dueDate?.toDate();

          if (!dueDate) continue;

          // Check if due in 1 or 3 days
          const dueDateStr = dueDate.toDateString();
          const oneDayStr = oneDayFromNow.toDateString();
          const threeDaysStr = threeDaysFromNow.toDateString();

          let reminderType: '1_day' | '3_days' | null = null;
          if (dueDateStr === oneDayStr) {
            reminderType = '1_day';
          } else if (dueDateStr === threeDaysStr) {
            reminderType = '3_days';
          }

          if (!reminderType) continue;

          // Check if reminder already sent today
          const reminderSentKey = `reminder_${reminderType}_sent_${now.toDateString()}`;
          if (repayment[reminderSentKey]) continue;

          // Get loan and customer
          const loanRef = db.doc(`agencies/${agencyId}/loans/${repayment.loanId}`);
          const loanSnap = await loanRef.get();
          if (!loanSnap.exists) continue;

          const loanData = loanSnap.data();
          const customerRef = db.doc(`agencies/${agencyId}/customers/${loanData?.customerId}`);
          const customerSnap = await customerRef.get();
          if (!customerSnap.exists) continue;

          const customerData = customerSnap.data();
          const email = customerData?.email;

          if (!email) continue;

          // Enforce quota
          try {
            await enforceQuota(agencyId, 'notificationsSent', 1);
          } catch {
            continue;
          }

          // Send reminder
          const template = DEFAULT_TEMPLATES.payment_reminder || {
            subject: "Payment Reminder – {{amount}} Due on {{dueDate}}",
            body: `<p>Hello {{customerName}},</p><p>Your payment of <strong>{{amount}}</strong> for loan <strong>#{{loanNumber}}</strong> is due on <strong>{{dueDate}}</strong>.</p>`,
          };

          const variables: TemplateVariables = {
            customerName: customerData.fullName || 'Valued Customer',
            agencyName,
            loanNumber: loanData?.loanNumber || repayment.loanId,
            amount: formatAmount(repayment.amountDue || 0),
            dueDate: formatDate(dueDate),
          };

          const subject = replaceTemplateVariables(template.subject, variables);
          const bodyContent = replaceTemplateVariables(template.body, variables);
          const html = buildEmailHtml(agencyName, bodyContent);

          const transporter = getTransporter();
          if (transporter) {
            const emailConfig = functions.config().email;
            const fromEmail = emailConfig?.user || 'noreply@tengaloans.com';
            
            await transporter.sendMail({
              from: `${agencyName} <${fromEmail}>`,
              to: email,
              subject,
              html,
            });

            // Mark reminder as sent
            await repaymentDoc.ref.update({
              [reminderSentKey]: true,
            });

            console.log(`Payment reminder (${reminderType}) sent to ${email}`);
          }
        }
      }

      console.log('Enhanced payment reminders completed');
    } catch (error) {
      console.error('Error in enhancedPaymentReminders:', error);
    }

    return null;
  });
