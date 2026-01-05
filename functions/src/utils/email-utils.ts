/**
 * Shared Email Utilities
 * Provides reusable functions for email branding and templates
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Get the "Powered by Byte & Berry" footer HTML
 * This footer should be appended to all transactional emails
 */
export function getByteBerryFooter(): string {
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; font-family: sans-serif; color: #666; font-size: 12px; text-align: center; background-color: #f9f9f9;">
      <p><strong>Powered by Byte & Berry</strong><br>
      Delivering smart, scalable, and user-friendly digital solutions.</p>
      
      <p style="font-size: 11px; color: #888; line-height: 1.5;">
        Byte&Berry is a privately held technology company dedicated to delivering smart, scalable, and user-friendly digital solutions. 
        We specialize in software development, web and mobile applications, business systems, and digital branding.
      </p>

      <p>
        <a href="http://byteandberry.com/" style="color: #0066cc; text-decoration: none;">🌐 byteandberry.com</a>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <span>📞 +260 760 580 949</span>
      </p>
    </div>
  `;
}

/**
 * Get agency name from agencyId
 * Returns the agency name or a default fallback
 */
export async function getAgencyName(agencyId: string): Promise<string> {
  try {
    const agencyRef = db.doc(`agencies/${agencyId}`);
    const agencySnap = await agencyRef.get();
    
    if (agencySnap.exists) {
      const agencyData = agencySnap.data();
      return agencyData?.name || 'TengaLoans';
    }
    
    return 'TengaLoans';
  } catch (error) {
    console.warn('Failed to fetch agency name:', error);
    return 'TengaLoans';
  }
}

/**
 * Get agency email sender name
 * Returns the custom emailSenderName if set, otherwise returns agency name
 */
export async function getAgencySenderName(agencyId: string): Promise<string> {
  try {
    const agencyRef = db.doc(`agencies/${agencyId}`);
    const agencySnap = await agencyRef.get();
    
    if (agencySnap.exists) {
      const agencyData = agencySnap.data();
      return agencyData?.emailSenderName || agencyData?.name || 'TengaLoans';
    }
    
    return 'TengaLoans';
  } catch (error) {
    console.warn('Failed to fetch agency sender name:', error);
    return 'TengaLoans';
  }
}

/**
 * Build complete email HTML with Byte & Berry footer
 * Wraps the body content in a standard email template and appends the footer
 */
export function buildEmailHtmlWithFooter(
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
