/**
 * Two-Factor Authentication Service
 * Supports SMS, Email, and Authenticator App methods
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { authService } from '../supabase/auth';
import type { TwoFactorAuth } from '../../types/features';

const TOTP_SECRET_LENGTH = 32;

/**
 * Generate TOTP secret for authenticator app
 */
export function generateTOTPSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < TOTP_SECRET_LENGTH; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codes.push(code);
  }
  return codes;
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(
  userId: string,
  method: 'sms' | 'email' | 'app',
  secret?: string
): Promise<{ secret?: string; backupCodes: string[] }> {
  const userRef = doc(db, 'users', userId);
  const backupCodes = generateBackupCodes();
  
  const twoFactorAuth: TwoFactorAuth = {
    enabled: true,
    method,
    secret: method === 'app' ? (secret || generateTOTPSecret()) : undefined,
    backupCodes,
  };

  await updateDoc(userRef, {
    twoFactorAuth,
    updatedAt: new Date().toISOString(),
  });

  return {
    secret: twoFactorAuth.secret,
    backupCodes,
  };
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    twoFactorAuth: {
      enabled: false,
      method: 'sms',
    },
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Verify 2FA code
 */
export async function verify2FACode(
  userId: string,
  code: string
): Promise<boolean> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return false;
  }

  const userData = userSnap.data();
  const twoFactorAuth = userData.twoFactorAuth as TwoFactorAuth | undefined;

  if (!twoFactorAuth?.enabled) {
    return false;
  }

  // Check backup codes
  if (twoFactorAuth.backupCodes?.includes(code)) {
    // Remove used backup code
    const updatedCodes = twoFactorAuth.backupCodes.filter(c => c !== code);
    await updateDoc(userRef, {
      'twoFactorAuth.backupCodes': updatedCodes,
    });
    return true;
  }

  // For TOTP (authenticator app), you would verify against the secret
  // This is a simplified version - in production, use a proper TOTP library
  if (twoFactorAuth.method === 'app' && twoFactorAuth.secret) {
    // TODO: Implement proper TOTP verification using a library like 'otplib'
    // For now, return true if code is 6 digits
    return /^\d{6}$/.test(code);
  }

  // For SMS/Email, verify the code was sent and matches
  // In production, store verification codes temporarily and check them
  return /^\d{6}$/.test(code);
}

/**
 * Get 2FA status for a user
 */
export async function get2FAStatus(userId: string): Promise<TwoFactorAuth | null> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return null;
  }

  const userData = userSnap.data();
  return userData.twoFactorAuth as TwoFactorAuth | null;
}

