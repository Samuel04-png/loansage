/**
 * Welcome Email System
 * Sends welcome email to new users when they create an account for the first time
 * Also supports future announcement emails
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

/**
 * Welcome Email Function
 * Triggers when a new user is created via Firebase Authentication
 * Sends welcome email only once per user
 */
export const sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName } = user;

  try {
    if (!email) {
      console.log(`User ${uid} has no email, skipping welcome email`);
      return;
    }

    // Check if user document exists in Firestore
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    let userData = userSnap.exists ? userSnap.data() : null;

    // If user document doesn't exist, create it
    if (!userSnap.exists) {
      await userRef.set({
        id: uid,
        email: email,
        full_name: displayName || null,
        role: 'admin', // Default role, can be updated later
        is_active: true,
        welcomeEmailSent: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      userData = { welcomeEmailSent: false };
    }

    // Check if welcome email was already sent
    if (userData?.welcomeEmailSent === true) {
      console.log(`Welcome email already sent for user ${uid}`);
      return;
    }

    // Send welcome email
    const emailSent = await sendWelcomeEmailToUser(email, displayName || 'User', uid);

    // Update user document
    await userRef.update({
      welcomeEmailSent: true,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log email send
    await logEmailSend(uid, email, 'welcome', emailSent ? 'sent' : 'failed', null);

    console.log(`Welcome email ${emailSent ? 'sent' : 'failed'} to ${email}`);
  } catch (error: any) {
    console.error('Error in sendWelcomeEmail:', error);
    // Log the error but don't throw - don't block user signup
    try {
      await logEmailSend(uid, email || 'unknown', 'welcome', 'failed', error.message || 'Unknown error');
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }
  }
});

/**
 * Send Welcome Email to User
 */
async function sendWelcomeEmailToUser(
  email: string,
  displayName: string,
  uid: string
): Promise<boolean> {
  try {
    if (!functions.config().email?.user) {
      console.warn('Email configuration not set. Skipping email send.');
      return false;
    }

    const emailSubject = '🎉 Welcome to TengaLoans — You\'re officially in!';
    const emailHtml = getWelcomeEmailTemplate(displayName);

    await transporter.sendMail({
      from: functions.config().email.user || 'noreply@tengaloans.com',
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });

    return true;
  } catch (error: any) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Welcome Email HTML Template
 */
function getWelcomeEmailTemplate(displayName: string): string {
  const userName = displayName || 'there';
  const dashboardUrl = process.env.APP_URL || 'https://tengaloans.com';
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
        .features {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 6px;
          margin: 25px 0;
        }
        .features ul {
          list-style: none;
          padding-left: 0;
        }
        .features li {
          padding: 8px 0;
          padding-left: 25px;
          position: relative;
        }
        .features li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #22C55E;
          font-weight: bold;
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
        .reassurance {
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
          <h1>Welcome, ${userName}! 🎉</h1>
        </div>

        <div class="content">
          <p>Congratulations on choosing <strong>TengaLoans</strong> — your intelligent loan management platform!</p>
          
          <p>You're now part of a platform designed to streamline your microfinance operations with AI-powered insights and automation.</p>
        </div>

        <div class="features">
          <h2 style="margin-top: 0; color: #1a1a1a;">What You Can Do:</h2>
          <ul>
            <li><strong>Loan Tracking:</strong> Monitor all loans in real-time with comprehensive dashboards</li>
            <li><strong>Risk Assessment:</strong> AI-driven risk analysis to make informed lending decisions</li>
            <li><strong>Repayment Monitoring:</strong> Automated reminders and payment tracking</li>
            <li><strong>Smart Insights:</strong> Get actionable insights powered by machine learning</li>
          </ul>
        </div>

        <div class="reassurance">
          <p style="margin: 0;"><strong>🔒 Your Data is Secure</strong><br>
          We use enterprise-grade security to protect your information. No charges are made without your explicit confirmation.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}/admin/dashboard" class="cta-button">Go to Dashboard →</a>
        </div>

        <div class="footer">
          <p>Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #006BFF;">${supportEmail}</a></p>
          <p style="margin-top: 15px;">
            <a href="${dashboardUrl}/admin/settings" style="color: #6b7280; text-decoration: none;">Manage email preferences</a>
          </p>
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
  uid: string,
  email: string,
  type: 'welcome' | 'announcement',
  status: 'sent' | 'failed',
  error: string | null
): Promise<void> {
  try {
    await db.collection('emailLogs').add({
      uid,
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

/**
 * Send Announcement Email (Future Use)
 * Callable function for admins to send announcement emails
 */
export const sendAnnouncementEmail = functions.https.onCall(
  async (data: {
    announcementId: string;
    subject: string;
    content: string;
    targetAudience: 'all' | 'admin' | 'employee' | 'customer';
  }, context: any) => {
    // Verify admin access
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userRef = db.doc(`users/${context.auth.uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can send announcements');
    }

    try {
      const { subject, content, targetAudience } = data;

      // Get target users based on audience
      let usersQuery;
      if (targetAudience === 'all') {
        usersQuery = await db.collection('users').where('is_active', '==', true).get();
      } else {
        usersQuery = await db.collection('users')
          .where('is_active', '==', true)
          .where('role', '==', targetAudience === 'employee' ? 'employee' : targetAudience)
          .get();
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const userDoc of usersQuery.docs) {
        const user = userDoc.data();
        if (!user.email) continue;

        try {
          await transporter.sendMail({
            from: functions.config().email?.user || 'noreply@tengaloans.com',
            to: user.email,
            subject: subject || 'Update from TengaLoans',
            html: getAnnouncementEmailTemplate(content),
          });

          await logEmailSend(userDoc.id, user.email, 'announcement', 'sent', null);
          sentCount++;
        } catch (error: any) {
          await logEmailSend(userDoc.id, user.email, 'announcement', 'failed', error.message);
          failedCount++;
        }
      }

      return {
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: usersQuery.size,
      };
    } catch (error: any) {
      console.error('Announcement email error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send announcements', error.message);
    }
  }
);

/**
 * Announcement Email Template
 */
function getAnnouncementEmailTemplate(content: string): string {
  const dashboardUrl = process.env.APP_URL || 'https://tengaloans.com';
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
          <div class="logo">TengaLoans</div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Questions? Contact us at <a href="mailto:${supportEmail}" style="color: #006BFF;">${supportEmail}</a></p>
          <p style="margin-top: 15px;">
            <a href="${dashboardUrl}/admin/settings" style="color: #6b7280; text-decoration: none;">Manage email preferences</a>
          </p>
          <p style="margin-top: 10px; font-size: 11px;">
            © ${new Date().getFullYear()} TengaLoans. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
