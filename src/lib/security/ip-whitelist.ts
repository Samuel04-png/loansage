/**
 * IP Whitelist Management
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { IPWhitelist } from '../../types/features';

/**
 * Get IP whitelist for an agency
 */
export async function getIPWhitelist(agencyId: string): Promise<IPWhitelist | null> {
  const agencyRef = doc(db, 'agencies', agencyId);
  const agencySnap = await getDoc(agencyRef);
  
  if (!agencySnap.exists()) {
    return null;
  }

  const agencyData = agencySnap.data();
  return agencyData.ipWhitelist as IPWhitelist | null;
}

/**
 * Update IP whitelist for an agency
 */
export async function updateIPWhitelist(
  agencyId: string,
  whitelist: IPWhitelist
): Promise<void> {
  const agencyRef = doc(db, 'agencies', agencyId);
  await updateDoc(agencyRef, {
    ipWhitelist: whitelist,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Check if IP is whitelisted
 */
export function isIPWhitelisted(ip: string, whitelist: IPWhitelist | null): boolean {
  if (!whitelist || !whitelist.enabled) {
    return true; // If whitelist is disabled, allow all IPs
  }

  return whitelist.ips.some(whitelistedIP => {
    // Support CIDR notation (e.g., 192.168.1.0/24)
    if (whitelistedIP.includes('/')) {
      return isIPInCIDR(ip, whitelistedIP);
    }
    return ip === whitelistedIP;
  });
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  
  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request | null): string {
  if (!request) return 'unknown';
  
  // Check various headers for real IP (behind proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

