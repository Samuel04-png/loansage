/**
 * Send Invitation Email Function
 * Sends invitation emails when invitations are created
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

// Email transporter (configure with your email service)
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

/**
 * Send Invitation Email
 * Callable function to send invitation emails
 */
export const sendInvitationEmail = functions.https.onCall(
  async (data: {
    agencyId: string;
    invitationId: string;
    email: string;
    role: string;
    inviteUrl: string;
    note?: string;
    agencyName?: string;
  }, context: any) => {
    // Verify admin access
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const { agencyId, invitationId, email, role, inviteUrl, note, agencyName } = data;

      const transporter = getTransporter();
      if (!transporter) {
        console.warn('Email transporter not configured, skipping email send');
        return { success: false, message: 'Email not configured' };
      }

      // Get agency name if not provided
      let finalAgencyName = agencyName || 'TengaLoans';
      if (!agencyName && agencyId) {
        try {
          const db = admin.firestore();
          const agencyDoc = await db.doc(`agencies/${agencyId}`).get();
          if (agencyDoc.exists) {
            finalAgencyName = agencyDoc.data()?.name || finalAgencyName;
          }
        } catch (error) {
          console.warn('Could not fetch agency name:', error);
        }
      }

      const roleDisplayName = role === 'customer' 
        ? 'Customer' 
        : role.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

      const emailSubject = `You've been invited to join ${finalAgencyName} as a ${roleDisplayName}`;
      const emailHtml = getInvitationEmailTemplate({
        agencyName: finalAgencyName,
        role: roleDisplayName,
        inviteUrl,
        note,
      });

      // Use custom "from" name if configured, otherwise use the email address
      const fromEmail = functions.config().email?.user || 'noreply@tengaloans.com';
      const fromName = functions.config().email?.name || 'TengaLoans';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });

      // Update invitation to mark email as sent
      try {
        const db = admin.firestore();
        await db.doc(`agencies/${agencyId}/invitations/${invitationId}`).update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        console.warn('Could not update invitation email status:', updateError);
      }

      // Log email send
      await logEmailSend(agencyId, invitationId, email, 'invitation', 'sent', null);

      return { success: true, message: 'Invitation email sent successfully' };
    } catch (error: any) {
      console.error('Error sending invitation email:', error);
      
      // Log the error
      try {
        await logEmailSend(
          data.agencyId,
          data.invitationId,
          data.email,
          'invitation',
          'failed',
          error.message || 'Unknown error'
        );
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }

      throw new functions.https.HttpsError('internal', 'Failed to send invitation email', error.message);
    }
  }
);

/**
 * Invitation Email HTML Template
 */
function getInvitationEmailTemplate({
  agencyName,
  role,
  inviteUrl,
  note,
}: {
  agencyName: string;
  role: string;
  inviteUrl: string;
  note?: string;
}): string {
  const supportEmail = 'support@tengaloans.com';

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
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #006BFF;
          margin-bottom: 10px;
        }
        h1 {
          color: #1a1a1a;
          font-size: 24px;
          margin: 20px 0;
        }
        .content {
          color: #4a4a4a;
          margin: 20px 0;
        }
        .invite-box {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 6px;
          margin: 25px 0;
          border-left: 4px solid #006BFF;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #006BFF 0%, #4F46E5 100%);
          color: #ffffff;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 25px 0;
          text-align: center;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .note-box {
          background-color: #f0f9ff;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          border-left: 4px solid #006BFF;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">TengaLoans</div>
          <h1>You've Been Invited! 🎉</h1>
        </div>

        <div class="content">
          <p>You've been invited to join <strong>${agencyName}</strong> as a <strong>${role}</strong>.</p>
          
          ${note ? `
            <div class="note-box">
              <p style="margin: 0;"><strong>Message from ${agencyName}:</strong><br>${note}</p>
            </div>
          ` : ''}

          <div class="invite-box">
            <p style="margin: 0 0 15px 0;"><strong>What's Next?</strong></p>
            <p style="margin: 0;">Click the button below to accept your invitation and create your account. This invitation will expire in 7 days.</p>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" class="cta-button">Accept Invitation →</a>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #006BFF; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>

        <div class="footer">
          <p>Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #006BFF;">${supportEmail}</a></p>
          <p style="margin-top: 10px; font-size: 11px;">
            © ${new Date().getFullYear()} TengaLoans. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Log Email Send to Firestore
 */
async function logEmailSend(
  agencyId: string,
  invitationId: string,
  email: string,
  type: string,
  status: 'sent' | 'failed',
  error: string | null
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('emailLogs').add({
      agencyId,
      invitationId,
      email,
      type,
      status,
      error,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log email send:', error);
  }
}

