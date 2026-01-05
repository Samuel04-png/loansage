/**
 * Customer Lifecycle Cloud Functions
 * Handles automated customer onboarding and invitation flow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { getAgencyPlan, enforceQuota } from './usage-ledger';
import * as crypto from 'crypto';
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
// ENTERPRISE TEMPLATE SYSTEM
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
  inviteUrl?: string;
  [key: string]: string | undefined;
}

/**
 * Get notification template - Enterprise agencies can have custom templates
 */
async function getNotificationTemplate(
  agencyId: string,
  templateType: string
): Promise<NotificationTemplate | null> {
  try {
    const plan = await getAgencyPlan(agencyId);
    
    // Only enterprise agencies can have custom templates
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
    
    return null; // Use default template
  } catch (e) {
    console.warn('Failed to fetch custom template, using default:', e);
    return null;
  }
}

/**
 * Replace template variables with actual values
 */
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

/**
 * Default notification templates
 */
const DEFAULT_TEMPLATES: Record<string, NotificationTemplate> = {
  customer_welcome: {
    subject: "Welcome to {{agencyName}} – Set Up Your Account",
    body: `
      <p>Hello {{customerName}},</p>
      <p>You have been added as a customer at <strong>{{agencyName}}</strong>.</p>
      <p>Click the button below to set up your account and access your customer portal:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{inviteUrl}}" style="display: inline-block; background: linear-gradient(135deg, #006BFF 0%, #4F46E5 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Set Up My Account →</a>
      </div>
      <p style="color: #6b7280; font-size: 12px;">This invitation expires in 48 hours.</p>
    `,
  },
  loan_approved: {
    subject: "Great News! Your Loan #{{loanNumber}} Has Been Approved",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Your loan application <strong>#{{loanNumber}}</strong> has been <span style="color: #22C55E; font-weight: bold;">approved</span>!</p>
      <p>Loan Amount: <strong>{{amount}}</strong></p>
      <p>Please log in to your customer portal to review and sign the loan agreement.</p>
    `,
  },
  loan_disbursed: {
    subject: "Funds Sent – Loan #{{loanNumber}}",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Great news! Funds of <strong>{{amount}}</strong> have been disbursed for your loan <strong>#{{loanNumber}}</strong>.</p>
      <p>Please check your designated account for the transfer.</p>
    `,
  },
  loan_settled: {
    subject: "Congratulations! Loan #{{loanNumber}} Fully Paid Off",
    body: `
      <p>Hello {{customerName}},</p>
      <p>Congratulations! 🎉 Your loan <strong>#{{loanNumber}}</strong> has been <span style="color: #22C55E; font-weight: bold;">fully paid off</span>.</p>
      <p>Thank you for being a valued customer of <strong>{{agencyName}}</strong>.</p>
    `,
  },
  payment_reminder: {
    subject: "Payment Reminder – {{amount}} Due on {{dueDate}}",
    body: `
      <p>Hello {{customerName}},</p>
      <p>This is a friendly reminder that your payment of <strong>{{amount}}</strong> for loan <strong>#{{loanNumber}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
      <p>Please ensure timely payment to avoid any late fees.</p>
    `,
  },
};

/**
 * Build email HTML with template
 */
function buildEmailHtml(
  agencyName: string,
  bodyContent: string
): string {
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
// CUSTOMER ONBOARDING TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate secure invitation token
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Trigger: When a new customer is created
 * Generates invitation token and sends welcome email
 */
export const onCustomerCreate = functions.firestore
  .document('agencies/{agencyId}/customers/{customerId}')
  .onCreate(async (snapshot, context) => {
    const { agencyId, customerId } = context.params;
    const customerData = snapshot.data();

    try {
      console.log(`New customer created: ${customerId} in agency ${agencyId}`);

      // Check if customer has valid contact info
      const email = customerData.email;
      const phone = customerData.phone;
      
      if (!email && !phone) {
        console.warn(`Customer ${customerId} has no email or phone. Skipping invitation.`);
        return;
      }

      // Get agency details
      const agencyRef = db.doc(`agencies/${agencyId}`);
      const agencySnap = await agencyRef.get();
      const agencyData = agencySnap.data();
      const agencyName = agencyData?.name || 'TengaLoans';

      // Generate invitation token
      const token = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48-hour expiration

      // Create invitation document
      const invitationRef = db.collection(`agencies/${agencyId}/customer_invitations`).doc();
      await invitationRef.set({
        customerId,
        email: email || null,
        phone: phone || null,
        token,
        status: 'pending',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update customer document with invitation status
      await snapshot.ref.update({
        invitationSent: true,
        invitationId: invitationRef.id,
        invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send email if available
      if (email) {
        // Enforce notification quota
        try {
          await enforceQuota(agencyId, 'notificationsSent', 1);
        } catch (quotaError) {
          console.warn(`Notification quota exceeded for agency ${agencyId}:`, quotaError);
          return;
        }

        const appUrl = process.env.APP_URL || 'https://app.tengaloans.com';
        const inviteUrl = `${appUrl}/customer/accept-invite?token=${token}`;

        // Get template (custom for Enterprise, default otherwise)
        const customTemplate = await getNotificationTemplate(agencyId, 'customer_welcome');
        const template = customTemplate || DEFAULT_TEMPLATES.customer_welcome;

        const variables: TemplateVariables = {
          customerName: customerData.fullName || customerData.firstName || 'Valued Customer',
          agencyName,
          inviteUrl,
        };

        const subject = replaceTemplateVariables(template.subject, variables);
        const bodyContent = replaceTemplateVariables(template.body, variables);
        const html = buildEmailHtml(agencyName, bodyContent);

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

          await logEmailSend(agencyId, customerId, email, 'customer_welcome', 'sent', null);
          console.log(`Welcome email sent to ${email} for customer ${customerId}`);
        }
      }

      // TODO: SMS notification if phone is available but no email
      // This would require Twilio integration

    } catch (error: any) {
      console.error('Error in onCustomerCreate:', error);
      await logEmailSend(
        agencyId,
        customerId,
        customerData.email || 'unknown',
        'customer_welcome',
        'failed',
        error.message
      );
    }
  });

// ═══════════════════════════════════════════════════════════════════════════════
// INVITATION TOKEN VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface VerifyTokenResponse {
  valid: boolean;
  customerId?: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  agencyName?: string;
  error?: string;
}

/**
 * Callable function to verify customer invitation token
 * Returns customer details if token is valid
 */
export const verifyInvitationToken = functions.https.onCall(
  async (data: { token: string }): Promise<VerifyTokenResponse> => {
    const { token } = data;

    if (!token) {
      return { valid: false, error: 'Token is required' };
    }

    try {
      // Search for invitation with this token across all agencies
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;
        const agencyData = agencyDoc.data();

        const invitationsQuery = await db
          .collection(`agencies/${agencyId}/customer_invitations`)
          .where('token', '==', token)
          .where('status', '==', 'pending')
          .limit(1)
          .get();

        if (!invitationsQuery.empty) {
          const invitationDoc = invitationsQuery.docs[0];
          const invitation = invitationDoc.data();

          // Check if token is expired
          const expiresAt = invitation.expiresAt?.toDate();
          if (expiresAt && expiresAt < new Date()) {
            await invitationDoc.ref.update({ status: 'expired' });
            return { valid: false, error: 'Invitation has expired. Please contact your lender.' };
          }

          // Get customer details
          const customerRef = db.doc(`agencies/${agencyId}/customers/${invitation.customerId}`);
          const customerSnap = await customerRef.get();
          
          if (!customerSnap.exists) {
            return { valid: false, error: 'Customer record not found.' };
          }

          const customerData = customerSnap.data();

          return {
            valid: true,
            customerId: invitation.customerId,
            email: invitation.email || customerData?.email,
            phone: invitation.phone || customerData?.phone,
            agencyId,
            agencyName: agencyData.name || 'TengaLoans',
          };
        }
      }

      return { valid: false, error: 'Invalid or expired invitation token.' };
    } catch (error: any) {
      console.error('Error verifying invitation token:', error);
      return { valid: false, error: 'Failed to verify token. Please try again.' };
    }
  }
);

/**
 * Complete customer invitation - link Firebase Auth user to customer
 */
export const completeCustomerInvitation = functions.https.onCall(
  async (
    data: { token: string },
    context
  ): Promise<{ success: boolean; error?: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { token } = data;
    const userId = context.auth.uid;

    try {
      // Find and validate invitation
      const agenciesSnapshot = await db.collection('agencies').get();

      for (const agencyDoc of agenciesSnapshot.docs) {
        const agencyId = agencyDoc.id;

        const invitationsQuery = await db
          .collection(`agencies/${agencyId}/customer_invitations`)
          .where('token', '==', token)
          .where('status', '==', 'pending')
          .limit(1)
          .get();

        if (!invitationsQuery.empty) {
          const invitationDoc = invitationsQuery.docs[0];
          const invitation = invitationDoc.data();

          // Check expiration
          const expiresAt = invitation.expiresAt?.toDate();
          if (expiresAt && expiresAt < new Date()) {
            return { success: false, error: 'Invitation has expired.' };
          }

          // Link user to customer
          const customerRef = db.doc(`agencies/${agencyId}/customers/${invitation.customerId}`);
          await customerRef.update({
            userId,
            status: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Update user document with customer role
          const userRef = db.doc(`users/${userId}`);
          await userRef.set(
            {
              role: 'customer',
              customerId: invitation.customerId,
              agencyId,
              isActive: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // Mark invitation as accepted
          await invitationDoc.ref.update({
            status: 'accepted',
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            acceptedByUserId: userId,
          });

          console.log(`Customer invitation completed: ${invitation.customerId} -> ${userId}`);
          return { success: true };
        }
      }

      return { success: false, error: 'Invalid invitation token.' };
    } catch (error: any) {
      console.error('Error completing customer invitation:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
