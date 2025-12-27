import * as functions from 'firebase-functions';

/**
 * Returns true if the authenticated caller uses an internal email domain.
 * Only works for callable functions where context.auth is available.
 */
export function isInternalEmail(context: functions.https.CallableContext): boolean {
  try {
    const email = (context.auth?.token as any)?.email as string | undefined;
    return !!email && email.toLowerCase().endsWith('@byteandberry.com');
  } catch {
    return false;
  }
}


